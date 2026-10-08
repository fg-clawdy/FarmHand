/**
 * Dismiss Parent approval notifications without leaving a replacement banner.
 *
 * Chrome counts notifications that are still visible *after* the push handler
 * finishes (PushMessagingNotificationManager::DidCountVisibleNotifications).
 * Showing a notification and closing it before the handler returns does not
 * satisfy that check. On Android the close also loses a race with
 * NotificationManager, so the replacement stays in the shade — that is how
 * "Taken care of" was sticking. A clear on Chromium therefore only closes
 * the matching notification and relies on Chrome's silent-push budget (and
 * on the exemption when a Parent tab is already visible).
 *
 * Safari revokes push permission if a push handler never calls
 * showNotification. Those clients show a blank stand-in, wait until the
 * platform has posted it, then close it. A second pass catches a late post.
 */

export const CLEAR_POST_DELAY_MS = 1000;
export const CLEAR_RETRY_DELAY_MS = 500;

/** Non-empty so picky clients accept it, but not a readable banner. */
export const CLEAR_STAND_IN_TITLE = "\u200b";

const APPROVAL_TAG = /^approval:(chore_claim|store_redemption):(.+)$/;

export function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function approvalNotificationKey(kind, subjectId) {
  return `${kind}:${subjectId}`;
}

export function mustPresentClearNotification(ua = "", hints = {}) {
  const agent = String(ua || "");
  if (/iPhone|iPad|iPod/i.test(agent)) return true;
  const chromium = /Chrome|Chromium|CriOS|FxiOS|Edg\/|OPR\/|SamsungBrowser/.test(agent);
  // iPadOS 13+ reports a desktop Macintosh UA. Touch points mark that as iPad,
  // but a touch-screen Mac running Chrome should stay on the Chromium path.
  if ((hints.maxTouchPoints || 0) > 1 && /Macintosh/.test(agent) && !chromium) return true;
  return /Safari\//.test(agent) && !chromium;
}

export function approvalIdentity(note) {
  const data = note?.data || {};
  if ((data.kind === "chore_claim" || data.kind === "store_redemption") && data.subjectId) {
    return approvalNotificationKey(data.kind, data.subjectId);
  }
  const match = APPROVAL_TAG.exec(note?.tag || "");
  if (!match) return null;
  return approvalNotificationKey(match[1], match[2]);
}

export function notificationMatchesRequest(note, request) {
  if (!note || !request) return false;
  const tag = request.tag || "";
  if (tag && note.tag === tag) return true;
  const subjectId = request.subjectId || "";
  if (!subjectId) return false;
  const data = note.data || {};
  if (data.subjectId !== subjectId) return false;
  const kind = request.kind || "";
  if (kind && data.kind && data.kind !== kind) return false;
  return true;
}

/** True when this notification should not stay in the shade. */
export function isStaleApprovalNotification(note, pendingKeys) {
  const data = note?.data || {};
  if (data.type === "clear" || data.ephemeral === true) return true;
  const title = typeof note?.title === "string" ? note.title : "";
  if (title === "Taken care of") return true;
  const key = approvalIdentity(note);
  if (!key) return false;
  return !pendingKeys.has(key);
}

async function listedNotifications(registration) {
  try {
    return await registration.getNotifications();
  } catch {
    return [];
  }
}

export async function closeMatching(registration, request) {
  const notes = await listedNotifications(registration);
  let closed = 0;
  for (const note of notes) {
    if (!notificationMatchesRequest(note, request)) continue;
    try {
      note.close();
      closed += 1;
    } catch {
      // Keep going so one platform rejection does not skip the rest.
    }
  }
  return closed;
}

/** Drop banners left by the old clear handler ("Taken care of" / type clear). */
export async function closeLeftoverClearNotifications(registration) {
  const notes = await listedNotifications(registration);
  let closed = 0;
  for (const note of notes) {
    const data = note?.data || {};
    const title = typeof note?.title === "string" ? note.title : "";
    if (data.type !== "clear" && data.ephemeral !== true && title !== "Taken care of") continue;
    try {
      note.close();
      closed += 1;
    } catch {
      // ignore
    }
  }
  return closed;
}

export async function closeStaleApprovalNotifications(registration, pending) {
  const keys =
    pending instanceof Set
      ? pending
      : new Set((pending || []).map((row) => approvalNotificationKey(row.kind, row.subjectId)));
  const notes = await listedNotifications(registration);
  let closed = 0;
  for (const note of notes) {
    if (!isStaleApprovalNotification(note, keys)) continue;
    try {
      note.close();
      closed += 1;
    } catch {
      // ignore
    }
  }
  return closed;
}

export async function dismissClearPush(registration, payload, options = {}) {
  const presentStandIn = options.presentStandIn === true;
  const wait = options.wait ?? delay;
  const postDelayMs = options.postDelayMs ?? CLEAR_POST_DELAY_MS;
  const retryDelayMs = options.retryDelayMs ?? CLEAR_RETRY_DELAY_MS;

  await closeMatching(registration, payload);
  if (!presentStandIn) return;

  try {
    await registration.showNotification(CLEAR_STAND_IN_TITLE, {
      body: "",
      tag: payload.tag,
      silent: true,
      renotify: false,
      data: {
        type: "clear",
        kind: payload.kind,
        subjectId: payload.subjectId,
        tag: payload.tag,
        ephemeral: true,
      },
      icon: "/parent/icon.svg",
    });
  } catch {
    return;
  }

  // Wait until the OS has posted the stand-in. Closing in the same turn as
  // showNotification is dropped on Android and on some iOS builds.
  await wait(postDelayMs);
  await closeMatching(registration, payload);
  await wait(retryDelayMs);
  await closeMatching(registration, payload);
}
