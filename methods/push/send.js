// sendPush — deliver a push notification to all of a user's registered devices.
//
// Callers (createNotification) don't care HOW it's delivered. Tokens are routed
// to a backend by their `provider`:
//   - "expo"   → Expo's push service (POST to exp.host).  ← used now
//   - "native" → our push.kowloon.network gateway (raw APNs/FCM).  ← stubbed
//
// Both can run at once during the eventual Expo→gateway migration; nothing here
// changes for callers when we flip a device from one to the other.

import { PushToken } from "#schema";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_BATCH = 100; // Expo accepts up to 100 messages per request

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// Expo backend. Returns the list of tokens Expo reported as permanently dead
// (DeviceNotRegistered) so we can prune them.
async function sendViaExpo(tokens, payload) {
  const dead = [];
  for (const batch of chunk(tokens, EXPO_BATCH)) {
    const messages = batch.map((to) => ({
      to,
      title: payload.title,
      body: payload.body,
      data: payload.data || {},
      sound: "default",
      channelId: "default", // Android notification channel (created client-side)
    }));
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(messages),
      });
      const json = await res.json().catch(() => null);
      const receipts = json?.data || [];
      receipts.forEach((r, i) => {
        if (r?.status === "error" && r?.details?.error === "DeviceNotRegistered") {
          dead.push(batch[i]);
        }
      });
    } catch (err) {
      console.error("[push] expo send failed:", err.message);
    }
  }
  return dead;
}

// Native backend — the future push.kowloon.network gateway. Stubbed until it
// exists; tokens tagged "native" simply aren't delivered yet.
async function sendViaNative(tokens /*, payload */) {
  if (tokens.length) {
    console.log(`[push] native gateway not implemented yet — skipped ${tokens.length} token(s)`);
  }
  return [];
}

export default async function sendPush(userId, payload) {
  try {
    if (!userId || !payload) return;
    const rows = await PushToken.find({ userId }).select("token provider").lean();
    if (!rows.length) return;

    const expoTokens = rows.filter((r) => r.provider === "expo").map((r) => r.token);
    const nativeTokens = rows.filter((r) => r.provider === "native").map((r) => r.token);

    const dead = [];
    if (expoTokens.length) dead.push(...(await sendViaExpo(expoTokens, payload)));
    if (nativeTokens.length) dead.push(...(await sendViaNative(nativeTokens, payload)));

    if (dead.length) {
      await PushToken.deleteMany({ token: { $in: dead } });
    }
  } catch (err) {
    console.error("sendPush failed:", err.message);
  }
}
