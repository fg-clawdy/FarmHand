/* FarmHand Parent service worker — Web Push Approve | Deny, and dismiss-on-resolve. */
import {
  closeLeftoverClearNotifications,
  closeMatching,
  closeResolvedTags,
  dismissClearPush,
  mustPresentClearNotification,
} from "./push-clear.js";

const INBOX = "/parent/";
const APPROVALS = "/parent/approvals";
const STORE = "/parent/store";
const RECOMMENDATIONS = "/parent/recommendations";

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      await self.clients.claim();
      await closeLeftoverClearNotifications(self.registration);
    })(),
  );
});

self.addEventListener("push", (event) => {
  event.waitUntil(handlePush(event));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const dismiss = closeMatching(self.registration, {
    tag: event.notification.tag,
    kind: data.kind,
    subjectId: data.subjectId,
  });
  if (event.action === "approve" || event.action === "deny" || event.action === "fulfill") {
    event.waitUntil(
      (async () => {
        await dismiss;
        await actFromNotification(data, event.action);
      })(),
    );
    return;
  }
  event.waitUntil(
    (async () => {
      await dismiss;
      await openParent(data);
    })(),
  );
});

async function handlePush(event) {
  let payload = { type: "approval_request", title: "FarmHand", body: "Open the parent inbox.", tag: "farmhand", url: INBOX };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    payload.body = event.data ? event.data.text() : payload.body;
  }

  if (payload.type === "clear") {
    const nav = self.navigator;
    await dismissClearPush(self.registration, payload, {
      presentStandIn: mustPresentClearNotification(nav?.userAgent || "", {
        maxTouchPoints: nav?.maxTouchPoints || 0,
      }),
    });
    return;
  }

  await showVisible(payload, payload.type === "info" ? {} : {
    requireInteraction: Boolean(payload.critical),
    actions: [
      { action: "approve", title: "Approve" },
      { action: "deny", title: "Deny" },
    ],
  });
}

async function showVisible(payload, extra) {
  await closeResolvedTags(self.registration, payload.resolvedTags);
  const existing = await self.registration.getNotifications({ tag: payload.tag });
  existing.forEach((note) => note.close());
  await self.registration.showNotification(payload.title || "FarmHand", {
    body: payload.body,
    tag: payload.tag,
    data: payload,
    icon: "/parent/icon.svg",
    badge: "/parent/icon.svg",
    renotify: true,
    ...extra,
  });
  await closeResolvedTags(self.registration, payload.resolvedTags, payload.tag);
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
  const verb = action === "fulfill" || (store && action === "approve") ? "approve" : action;
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
  const dest = data?.kind === "store_redemption" || (data?.url || "").includes("/store")
    ? STORE
    : (data?.url || "").includes("/recommendations")
      ? RECOMMENDATIONS
      : (data?.url || "").includes("/approvals")
        ? APPROVALS
        : INBOX;
  const url = new URL(data?.url || dest, self.location.origin).href;
  const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  const existing = windows.find((client) => client.url.startsWith(new URL("/parent/", self.location.origin).href));
  if (existing && "focus" in existing) {
    await existing.focus();
    return;
  }
  if (self.clients.openWindow) await self.clients.openWindow(url);
}
