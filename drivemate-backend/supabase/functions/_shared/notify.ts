// Best-effort push + notifications-table logging. Mockable in tests.
import type { Db } from "./db.ts";
import { sendPush, PushMessage } from "./firebaseAdmin.ts";

export type Notifier = (db: Db, userId: string, msg: PushMessage) => Promise<void>;

export const defaultNotifier: Notifier = async (db, userId, msg) => {
  const user = await db.getUserById(userId);
  const sent = await sendPush(user?.fcm_token, msg);
  await db.insertNotification({
    user_id: userId, title: msg.title, body: msg.body,
    data: { ...(msg.data ?? {}), pushDelivered: String(sent) },
  });
};
