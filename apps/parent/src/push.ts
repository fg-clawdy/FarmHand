export type PushConfig = {
  enabled: boolean;
  publicKey: string | null;
  subscribed: boolean;
};

export function pushSupported() {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export function isSecurePushContext() {
  if (window.isSecureContext) return true;
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1";
}

export async function registerParentSW() {
  if (!("serviceWorker" in navigator)) return null;
  return navigator.serviceWorker.register("/parent/sw.js", { scope: "/parent/", type: "module" });
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

export async function enableParentPush(publicKey: string) {
  const reg = await registerParentSW();
  if (!reg) throw new Error("This browser cannot install the parent app worker.");
  await navigator.serviceWorker.ready;
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notifications are blocked for this site.");
  const subscription = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });
  const json = subscription.toJSON();
  return {
    endpoint: json.endpoint ?? subscription.endpoint,
    keys: {
      p256dh: json.keys?.p256dh ?? "",
      auth: json.keys?.auth ?? "",
    },
  };
}

export async function currentPushEndpoint() {
  const reg = await navigator.serviceWorker.getRegistration("/parent/");
  const sub = await reg?.pushManager.getSubscription();
  return sub?.endpoint ?? null;
}

export async function disableParentPush() {
  const reg = await navigator.serviceWorker.getRegistration("/parent/");
  const sub = await reg?.pushManager.getSubscription();
  const endpoint = sub?.endpoint ?? null;
  await sub?.unsubscribe();
  return endpoint;
}

export type ApprovalSubject = {
  kind: "chore_claim" | "store_redemption";
  subjectId: string;
};

export function pendingApprovalSubjects(inbox: {
  claims?: { id: string }[] | null;
  redemptions?: { id: string }[] | null;
}): ApprovalSubject[] {
  return [
    ...(inbox.claims ?? []).map((row) => ({ kind: "chore_claim" as const, subjectId: row.id })),
    ...(inbox.redemptions ?? []).map((row) => ({ kind: "store_redemption" as const, subjectId: row.id })),
  ];
}

/** Close shade entries for requests that are no longer waiting on a grown-up. */
export async function syncApprovalNotifications(pending: ApprovalSubject[]) {
  try {
    if (!("serviceWorker" in navigator)) return;
    const reg = await navigator.serviceWorker.getRegistration("/parent/");
    if (!reg || typeof reg.getNotifications !== "function") return;
    const { closeStaleApprovalNotifications } = await import("../public/push-clear.js");
    await closeStaleApprovalNotifications(reg, pending);
  } catch {
    // Push is optional. The inbox still works when notifications are unavailable.
  }
}
