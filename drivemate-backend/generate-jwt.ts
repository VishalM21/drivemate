import { signJwt } from "./supabase/functions/_shared/jwt.ts";

async function runQuery(sql: string): Promise<any[]> {
  const command = new Deno.Command("supabase", {
    args: ["db", "query", "--output-format", "json", sql],
    stdout: "piped",
    stderr: "piped",
  });
  const { code, stdout, stderr } = await command.output();
  const errText = new TextDecoder().decode(stderr).trim();
  if (code !== 0) {
    throw new Error(`SQL Error: ${errText}`);
  }
  const outText = new TextDecoder().decode(stdout).trim();
  try {
    const data = JSON.parse(outText);
    return data.rows || [];
  } catch (_e) {
    return [];
  }
}

// 1. Load env variables from supabase/functions/.env
let jwtSecret = "926ae30561448184bc187c5f074e2a28e6c0b7f1e53f0adccbda011a61ed9de0"; // default fallback
try {
  const envText = await Deno.readTextFile("./supabase/functions/.env");
  for (const line of envText.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("JWT_SECRET_KEY=")) {
      jwtSecret = trimmed.split("=")[1].replace(/['"]/g, "").trim();
    }
  }
} catch (_e) {
  console.log("⚠️ Could not load JWT_SECRET_KEY from .env, using default.");
}

// 2. Query Driver User
try {
  const users = await runQuery(`
    SELECT id, phone, role 
    FROM users 
    WHERE phone = '9999999997' 
    LIMIT 1
  `);
  if (users.length === 0) {
    console.error("❌ Driver user not found in database.");
    Deno.exit(1);
  }
  const user = users[0];
  
  // 3. Generate token
  const token = await signJwt(
    { sub: user.id, role: user.role, phone: user.phone },
    jwtSecret,
    1440 // 24 hours expiry
  );
  
  console.log("\n🔑 DRIVER AUTHORIZATION HEADER:");
  console.log("----------------------------------------------------");
  console.log(`Authorization: Bearer ${token}`);
  console.log("----------------------------------------------------");
} catch (e: any) {
  console.error("❌ Error generating JWT:", e.message);
}
Deno.exit(0);
