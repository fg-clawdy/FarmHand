/* FarmHand Parent service worker — Web Push Approve | Deny + store Fulfill | Deny + clear-across-parents. */
const INBOX = "/parent/";
const STORE = "/parent/store";

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  event.waitUntil(handlePush(event));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  if (event.action === "approve" || event.action === "deny" || event.action === "fulfill") {
    event.waitUntil(actFromNotification(data, event.action));
    return;
  }
  event.waitUntil(openParent(data));
});

async function handlePush(event) {
  let payload = { type: "approval_request", title: "FarmHand", body: "Open the parent inbox.", tag: "farmhand", url: INBOX };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    payload.body = event.data ? event.data.text() : payload.body;
  }

  const existing = await self.registration.getNotifications({ tag: payload.tag });
  existing.forEach((note) => note.close());

  if (payload.type === "clear") {
    await self.registration.showNotification(payload.title || "Taken care of", {
      body: payload.body || "Another grown-up already handled this.",
      tag: payload.tag,
      data: payload,
      silent: true,
      icon: "/parent/icon.svg",
    });
    const shown = await self.registration.getNotifications({ tag: payload.tag });
    shown.forEach((note) => note.close());
    return;
  }

  const store = payload.kind === "store_redemption";
  await self.registration.showNotification(payload.title || "FarmHand", {
    body: payload.body,
    tag: payload.tag,
    data: payload,
    icon: "/parent/icon.svg",
    badge: "/parent/icon.svg",
    renotify: true,
    requireInteraction: Boolean(payload.critical),
    actions: store
      ? [
          { action: "fulfill", title: "Fulfill" },
          { action: "deny", title: "Deny" },
        ]
      : [
          { action: "approve", title: "Approve" },
          { action: "deny", title: "Deny" },
        ],
  });
}

async function actFromNotification(data, action) {
  const subjectId = data.subjectId;
  if (!subjectId) {
    await openParent(data);
    return;
  }
  const headers = { "Content-Type": "application/json" };
  if (data.actionToken) headers.Authorization = `Bearer ${data.actionToken}`;
  const store = data.kind === "store_redemption";
  const verb = action === "fulfill" || (store && action === "approve") ? "fulfill" : action;
  const path = store ? `/api/parent/redemptions/${subjectId}/${verb}` : `/api/parent/claims/${subjectId}/${verb}`;
  try {
    const res = await fetch(path, {
      method: "POST",
      credentials: "include",
      headers,
      body: "{}",
    });
    if (!res.ok) {
      await openParent(data);
    }
  } catch {
    await openParent(data);
  }
}

async function openParent(data) {
  const dest = data?.kind === "store_redemption" || (data?.url || "").includes("/store") ? STORE : INBOX;
  const url = new URL(data?.url || dest, self.location.origin).href;
  const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  const existing = windows.find((client) => client.url.startsWith(new URL("/parent/", self.location.origin).href));
  if (existing && "focus" in existing) {
    await existing.focus();
    return;
  }
  if (self.clients.openWindow) await self.clients.openWindow(url);
}
