// Minimal dependency-free assertions (std-compatible subset) so the suite
// runs fully offline. Swap for jsr:@std/assert if you prefer.
export function assert(cond: unknown, msg = "Assertion failed"): asserts cond {
  if (!cond) throw new Error(msg);
}
export function assertEquals(actual: unknown, expected: unknown, msg?: string) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a !== e) throw new Error(msg ?? `assertEquals failed:\n  actual:   ${a}\n  expected: ${e}`);
}
export async function assertRejects(
  fn: () => Promise<unknown>,
  // deno-lint-ignore no-explicit-any
  ErrorClass?: new (...args: any[]) => Error,
  msgIncludes?: string,
): Promise<Error> {
  try {
    await fn();
  } catch (err: unknown) {
    // deno-lint-ignore no-explicit-any
    const e = err as any;
    if (ErrorClass && !(e instanceof ErrorClass)) {
      throw new Error(`Expected ${ErrorClass.name}, got ${String(err)}`);
    }
    if (msgIncludes && !String(e.message).includes(msgIncludes)) {
      throw new Error(`Expected error message to include "${msgIncludes}", got "${e.message}"`);
    }
    return e;
  }
  throw new Error("Expected promise to reject, but it resolved");
}
