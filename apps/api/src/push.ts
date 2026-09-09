import webpush from "web-push";
import { prisma } from "./db.js";
import { hashToken, newToken } from "./auth.js";
import { httpError } from "./chores.js";

export type ApprovalKind = "chore_claim" | "store_redemption";

export type PushPayload = {
  type: "approval_request" | "clear";
  kind: ApprovalKind;
  subjectId: string;
  tag: string;
  title: string;
  body: string;
  url: string;
  actionToken?: string;
  critical?: boolean;
};

export type PushSendResult = { sent: number; failed: number; dropped: number };

const ACTION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function vapidConfig() {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim() ?? "";
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim() ?? "";
  const subject = process.env.VAPID_SUBJECT?.trim() || "mailto:farmhand@localhost";
  return {
    enabled: Boolean(publicKey && privateKey),
    publicKey,
    privateKey,
    subject,
  };
}

export function approvalTag(kind: ApprovalKind, subjectId: string) {
  return `approval:${kind}:${subjectId}`;
}

export function choreClaimNotificationCopy(opts: {
  playerName: string;
  title: string;
  emoji: string;
  priority: string;
}) {
  const critical = opts.priority === "CRITICAL";
  if (critical) {
    return {
      title: `${opts.emoji} Dog chore — ${opts.title}`,
      body: `${opts.playerName} planted a waiting seed. Approve or deny now.`,
      critical: true,
    };
  }
  return {
    title: `${opts.emoji} ${opts.playerName} · ${opts.title}`,
    body: "A waiting seed needs a grown-up. Approve or deny.",
    critical: false,
  };
}

/** Store redemptions reuse the same request / clear fanout once the catalog ships. */
export function storeRedemptionNotificationCopy(opts: { playerName: string; title: string }) {
  return {
    title: `Store request — ${opts.title}`,
    body: `${opts.playerName} wants this reward. Fulfill or deny.`,
    critical: false,
  };
}

export function buildRequestPayload(opts: {
  kind: ApprovalKind;
  subjectId: string;
  title: string;
  body: string;
  url?: string;
  actionToken: string;
  critical?: boolean;
}): PushPayload {
  return {
    type: "approval_request",
    kind: opts.kind,
    subjectId: opts.subjectId,
    tag: approvalTag(opts.kind, opts.subjectId),
    title: opts.title,
    body: opts.body,
    url: opts.url ?? "/parent/",
    actionToken: opts.actionToken,
    critical: Boolean(opts.critical),
  };
}

export function buildClearPayload(kind: ApprovalKind, subjectId: string): PushPayload {
  return {
    type: "clear",
    kind,
    subjectId,
    tag: approvalTag(kind, subjectId),
    title: "Taken care of",
    body: "Another grown-up already approved or denied this.",
    url: "/parent/",
  };
}

export function isGonePushStatus(statusCode: number | undefined) {
  return statusCode === 404 || statusCode === 410;
}

function configureWebPush() {
  const vapid = vapidConfig();
  if (!vapid.enabled) return false;
  webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);
  return true;
}

async function actionTokenFor(adminId: string, kind: ApprovalKind, subjectId: string) {
  const token = newToken();
  const expiresAt = new Date(Date.now() + ACTION_TTL_MS);
  await prisma.pushActionToken.upsert({
    where: {
      adminId_subjectKind_subjectId: {
        adminId,
        subjectKind: kind,
        subjectId,
      },
    },
    create: {
      adminId,
      subjectKind: kind,
      subjectId,
      tokenHash: hashToken(token),
      expiresAt,
    },
    update: {
      tokenHash: hashToken(token),
      expiresAt,
    },
  });
  return token;
}

async function sendToSubscription(
  sub: { id: string; endpoint: string; p256dh: string; auth: string },
  payload: PushPayload,
  urgency: "high" | "normal",
) {
  const ttl = payload.type === "clear" ? 300 : 86_400;
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload),
      { TTL: ttl, urgency },
    );
    return "sent" as const;
  } catch (err) {
    const statusCode = (err as { statusCode?: number }).statusCode;
    if (isGonePushStatus(statusCode)) {
      await prisma.pushSubscription.deleteMany({ where: { id: sub.id } });
      return "dropped" as const;
    }
    console.warn("web push failed", sub.endpoint.slice(0, 48), (err as Error).message);
    return "failed" as const;
  }
}

export async function notifyApprovalRequest(opts: {
  kind: ApprovalKind;
  subjectId: string;
  title: string;
  body: string;
  url?: string;
  critical?: boolean;
}): Promise<PushSendResult> {
  const result: PushSendResult = { sent: 0, failed: 0, dropped: 0 };
  if (!configureWebPush()) return result;
  const subscriptions = await prisma.pushSubscription.findMany();
  if (subscriptions.length === 0) return result;
  const tokens = new Map<string, string>();
  for (const adminId of new Set(subscriptions.map((row) => row.adminId))) {
    tokens.set(adminId, await actionTokenFor(adminId, opts.kind, opts.subjectId));
  }
  for (const sub of subscriptions) {
    const payload = buildRequestPayload({
      ...opts,
      actionToken: tokens.get(sub.adminId)!,
    });
    const outcome = await sendToSubscription(sub, payload, opts.critical ? "high" : "normal");
    result[outcome] += 1;
  }
  return result;
}

export async function notifyApprovalResolved(opts: {
  kind: ApprovalKind;
  subjectId: string;
}): Promise<PushSendResult> {
  const result: PushSendResult = { sent: 0, failed: 0, dropped: 0 };
  if (!configureWebPush()) return result;
  const payload = buildClearPayload(opts.kind, opts.subjectId);
  const subscriptions = await prisma.pushSubscription.findMany();
  for (const sub of subscriptions) {
    const outcome = await sendToSubscription(sub, payload, "high");
    result[outcome] += 1;
  }
  return result;
}

export async function notifyChoreClaimPending(opts: {
  claimId: string;
  playerName: string;
  title: string;
  emoji: string;
  priority: string;
}) {
  const copy = choreClaimNotificationCopy(opts);
  return notifyApprovalRequest({
    kind: "chore_claim",
    subjectId: opts.claimId,
    title: copy.title,
    body: copy.body,
    critical: copy.critical,
  });
}

export async function notifyChoreClaimResolved(claimId: string) {
  return notifyApprovalResolved({ kind: "chore_claim", subjectId: claimId });
}

/** Hook for later store fulfillment — same tag / action / clear pattern as chores. */
export async function notifyStoreRedemptionPending(opts: {
  redemptionId: string;
  playerName: string;
  title: string;
}) {
  const copy = storeRedemptionNotificationCopy(opts);
  return notifyApprovalRequest({
    kind: "store_redemption",
    subjectId: opts.redemptionId,
    title: copy.title,
    body: copy.body,
    critical: copy.critical,
  });
}

export async function notifyStoreRedemptionResolved(redemptionId: string) {
  return notifyApprovalResolved({ kind: "store_redemption", subjectId: redemptionId });
}

export async function upsertPushSubscription(opts: {
  adminId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
}) {
  if (!opts.endpoint.startsWith("https://") && !opts.endpoint.startsWith("http://127.0.0.1")) {
    throw httpError("That push endpoint does not look right.");
  }
  if (!opts.p256dh || !opts.auth) throw httpError("Push subscription keys are missing.");
  return prisma.pushSubscription.upsert({
    where: { endpoint: opts.endpoint },
    create: {
      adminId: opts.adminId,
      endpoint: opts.endpoint,
      p256dh: opts.p256dh,
      auth: opts.auth,
      userAgent: opts.userAgent ?? "",
    },
    update: {
      adminId: opts.adminId,
      p256dh: opts.p256dh,
      auth: opts.auth,
      userAgent: opts.userAgent ?? "",
    },
  });
}

export async function deletePushSubscription(adminId: string, endpoint: string) {
  await prisma.pushSubscription.deleteMany({ where: { adminId, endpoint } });
}

export async function adminHasPushSubscription(adminId: string) {
  const count = await prisma.pushSubscription.count({ where: { adminId } });
  return count > 0;
}

export async function actorFromActionToken(token: string, kind: ApprovalKind, subjectId: string) {
  const row = await prisma.pushActionToken.findUnique({
    where: { tokenHash: hashToken(token) },
  });
  if (!row || row.expiresAt < new Date()) return null;
  if (row.subjectKind !== kind || row.subjectId !== subjectId) return null;
  return { adminId: row.adminId };
}
