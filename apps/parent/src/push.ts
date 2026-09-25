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
  return navigator.serviceWorker.register("/parent/sw.js", { scope: "/parent/" });
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
