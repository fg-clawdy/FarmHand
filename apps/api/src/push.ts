import webpush from "web-push";
import { prisma } from "./db.js";
import { hashToken, newToken } from "./auth.js";
import { httpError } from "./chores.js";
import {
  PIGGYBACK_TAG_LIMIT,
  createClearDebouncer,
  isWebKitPushClient,
  noteSilentClearSent,
  planClearFanout,
  readSilentClearAts,
  selectPiggybackTags,
  subjectsFromClears,
} from "./pushBudget.js";

export type ApprovalKind = "chore_claim" | "store_redemption";

export type PushSubjectRef = { kind: ApprovalKind; subjectId: string; tag: string };

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
  /** Every tag a coalesced clear should close. `tag` remains the first one. */
  tags?: string[];
  subjects?: PushSubjectRef[];
  /** Resolved requests to close while showing this visible notification. */
  resolvedTags?: string[];
};

/** Informational push (no Approve/Deny actions), e.g. the family jar is full. */
export type InfoPushPayload = {
  type: "info";
  kind: "shared_goal";
  subjectId: string;
  tag: string;
  title: string;
  body: string;
  url: string;
  /** Resolved approval tags to close before this info notification is shown. */
  resolvedTags?: string[];
};

export type PushSendResult = { sent: number; failed: number; dropped: number; skipped: number };

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

/** Store redemptions reuse the same request / clear fanout as chores. */
export function storeRedemptionNotificationCopy(opts: { playerName: string; title: string }) {
  return {
    title: `Store request — ${opts.title}`,
    body: `${opts.playerName} wants this reward. Approve or deny.`,
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

/** Dismiss signal. Subscribed devices close the tagged notification; title and body are unused. */
export function buildClearPayload(kind: ApprovalKind, subjectId: string): PushPayload {
  return buildCoalescedClearPayload([{ kind, subjectId, tag: approvalTag(kind, subjectId) }]);
}

/** One silent push that closes every tag in a debounced burst. */
export function buildCoalescedClearPayload(
  items: Array<{ kind: ApprovalKind; subjectId: string; tag: string }>,
): PushPayload {
  const subjects = subjectsFromClears(items);
  const first = subjects[0];
  if (!first) {
    return {
      type: "clear",
      kind: "chore_claim",
      subjectId: "",
      tag: "",
      tags: [],
      subjects: [],
      title: "",
      body: "",
      url: "/parent/",
    };
  }
  return {
    type: "clear",
    kind: first.kind,
    subjectId: first.subjectId,
    tag: first.tag,
    tags: subjects.map((item) => item.tag),
    subjects,
    title: "",
    body: "",
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

type SubscriptionTarget = { id: string; endpoint: string; p256dh: string; auth: string };

type QueuedClear = {
  deliveryId: string;
  subscriptionId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent: string;
  tag: string;
  kind: ApprovalKind;
  subjectId: string;
};

function emptyPushResult(): PushSendResult {
  return { sent: 0, failed: 0, dropped: 0, skipped: 0 };
}

async function sendToSubscription(
  sub: SubscriptionTarget,
  payload: PushPayload | InfoPushPayload,
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

async function flushSilentClears(subscriptionId: string, rows: QueuedClear[]) {
  if (!rows.length || !configureWebPush()) return;
  const sample = rows[0]!;
  const outcome = await sendToSubscription(
    { id: sample.subscriptionId, endpoint: sample.endpoint, p256dh: sample.p256dh, auth: sample.auth },
    buildCoalescedClearPayload(rows),
    "high",
  );
  if (outcome !== "sent") return;
  const now = new Date();
  await prisma.pushDelivery.updateMany({
    where: { id: { in: rows.map((row) => row.deliveryId) } },
    data: { clearedAt: now },
  });
  if (isWebKitPushClient(sample.userAgent)) return;
  const fresh = await prisma.pushSubscription.findUnique({ where: { id: subscriptionId } });
  if (!fresh) return;
  await prisma.pushSubscription.update({
    where: { id: subscriptionId },
    data: {
      silentClearAts: noteSilentClearSent(readSilentClearAts(fresh.silentClearAts), now.getTime(), sample.userAgent),
    },
  });
}

const clearDebouncer = createClearDebouncer<QueuedClear>({
  onFlush: (subscriptionId, rows) => {
    void flushSilentClears(subscriptionId, rows).catch((err) => {
      console.warn("push clear flush failed", (err as Error).message);
    });
  },
});

async function takePiggyback(subscriptionId: string, exceptTag: string) {
  const stolen = clearDebouncer.steal(subscriptionId);
  const deferred = await prisma.pushDelivery.findMany({
    where: { subscriptionId, deferredAt: { not: null }, clearedAt: null },
    orderBy: { deferredAt: "desc" },
    take: PIGGYBACK_TAG_LIMIT + 20,
  });
  const tags = selectPiggybackTags(
    [...stolen.map((row) => row.tag), ...deferred.map((row) => row.tag)],
    exceptTag,
  );
  return { tags, stolen };
}

async function markCleared(subscriptionId: string, tags: string[]) {
  if (!tags.length) return;
  await prisma.pushDelivery.updateMany({
    where: { subscriptionId, tag: { in: tags } },
    data: { clearedAt: new Date() },
  });
}

async function sendVisible(
  sub: SubscriptionTarget,
  payload: PushPayload | InfoPushPayload,
  urgency: "high" | "normal",
) {
  const { tags, stolen } = await takePiggyback(sub.id, payload.tag);
  const body = tags.length ? { ...payload, resolvedTags: tags } : payload;
  const outcome = await sendToSubscription(sub, body, urgency);
  if (outcome === "sent") await markCleared(sub.id, tags);
  else if (outcome === "failed") for (const row of stolen) clearDebouncer.enqueue(row);
  return outcome;
}

async function rememberDelivery(subId: string, payload: PushPayload) {
  await prisma.pushDelivery.upsert({
    where: { subscriptionId_tag: { subscriptionId: subId, tag: payload.tag } },
    create: {
      subscriptionId: subId,
      tag: payload.tag,
      kind: payload.kind,
      subjectId: payload.subjectId,
      sentAt: new Date(),
    },
    update: {
      kind: payload.kind,
      subjectId: payload.subjectId,
      sentAt: new Date(),
      deferredAt: null,
      clearedAt: null,
    },
  });
}

function pruneOldDeliveries() {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  void prisma.pushDelivery.deleteMany({ where: { sentAt: { lt: cutoff } } }).catch(() => undefined);
}

export async function notifyApprovalRequest(opts: {
  kind: ApprovalKind;
  subjectId: string;
  title: string;
  body: string;
  url?: string;
  critical?: boolean;
}): Promise<PushSendResult> {
  const result = emptyPushResult();
  if (!configureWebPush()) return result;
  const subscriptions = await prisma.pushSubscription.findMany();
  if (subscriptions.length === 0) return result;
  pruneOldDeliveries();
  const tokens = new Map<string, string>();
  for (const adminId of new Set(subscriptions.map((row) => row.adminId))) {
    tokens.set(adminId, await actionTokenFor(adminId, opts.kind, opts.subjectId));
  }
  for (const sub of subscriptions) {
    const payload = buildRequestPayload({
      ...opts,
      actionToken: tokens.get(sub.adminId)!,
    });
    const outcome = await sendVisible(sub, payload, opts.critical ? "high" : "normal");
    result[outcome] += 1;
    if (outcome === "sent") await rememberDelivery(sub.id, payload);
  }
  return result;
}

export async function notifyApprovalResolved(opts: {
  kind: ApprovalKind;
  subjectId: string;
  actorAdminId?: string;
}): Promise<PushSendResult> {
  const result = emptyPushResult();
  if (!configureWebPush()) return result;
  const tag = approvalTag(opts.kind, opts.subjectId);
  const deliveries = await prisma.pushDelivery.findMany({
    where: { tag, kind: opts.kind, subjectId: opts.subjectId, clearedAt: null, deferredAt: null },
    include: { subscription: true },
  });
  if (!deliveries.length) return result;
  const nowMs = Date.now();
  const candidates = deliveries.map((row) => ({
    deliveryId: row.id,
    subscriptionId: row.subscriptionId,
    adminId: row.subscription.adminId,
    userAgent: row.subscription.userAgent,
    endpoint: row.subscription.endpoint,
    p256dh: row.subscription.p256dh,
    auth: row.subscription.auth,
    tag: row.tag,
    kind: row.kind,
    subjectId: row.subjectId,
    sentAt: row.sentAt.getTime(),
    silentClearAts: readSilentClearAts(row.subscription.silentClearAts),
  }));
  const plan = planClearFanout(candidates, { now: nowMs, actorAdminId: opts.actorAdminId });
  await prisma.pushDelivery.updateMany({
    where: { id: { in: deliveries.map((row) => row.id) } },
    data: { deferredAt: new Date(nowMs) },
  });
  result.skipped = plan.defer.length;
  for (const row of plan.send) clearDebouncer.enqueue(row);
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

export async function notifyChoreClaimResolved(claimId: string, actorAdminId?: string) {
  return notifyApprovalResolved({ kind: "chore_claim", subjectId: claimId, actorAdminId });
}

/** Same tag / action / clear pattern as chores. Notification actions are Approve | Deny. */
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
    url: "/parent/store",
    critical: copy.critical,
  });
}

export async function notifyStoreRedemptionResolved(redemptionId: string, actorAdminId?: string) {
  return notifyApprovalResolved({ kind: "store_redemption", subjectId: redemptionId, actorAdminId });
}

export function sharedGoalReadyPayload(goalId: string, title: string): InfoPushPayload {
  return {
    type: "info",
    kind: "shared_goal",
    subjectId: goalId,
    tag: `shared-goal:${goalId}`,
    title: "The family jar is full!",
    body: `${title} is ready. Open Goals to make it happen.`,
    url: "/parent/goals",
  };
}

/** Tell every subscribed grown-up the family jar has filled. */
export async function notifySharedGoalReady(goalId: string, title: string): Promise<PushSendResult> {
  const result = emptyPushResult();
  if (!configureWebPush()) return result;
  const payload = sharedGoalReadyPayload(goalId, title);
  const subscriptions = await prisma.pushSubscription.findMany();
  for (const sub of subscriptions) {
    const outcome = await sendVisible(sub, payload, "normal");
    result[outcome] += 1;
  }
  return result;
}

export function recommendationsReadyPayload(setId: string, count: number): InfoPushPayload {
  return {
    type: "info",
    kind: "shared_goal", // reuse the info kind; only `type` + `url` drive UI
    subjectId: setId,
    tag: `recommendations:${setId}`,
    title: "Balance suggestions ready",
    body:
      count === 1
        ? "1 suggested tuning change is ready to review."
        : `${count} suggested tuning changes are ready to review.`,
    url: `/parent/recommendations/${setId}`,
  };
}

/** Informational (no action buttons) push that a new suggestion set is ready. */
export async function notifyRecommendationsReady(setId: string, count: number): Promise<PushSendResult> {
  const result = emptyPushResult();
  if (!configureWebPush()) return result;
  const payload = recommendationsReadyPayload(setId, count);
  const subscriptions = await prisma.pushSubscription.findMany();
  for (const sub of subscriptions) {
    const outcome = await sendVisible(sub, payload, "normal");
    result[outcome] += 1;
  }
  return result;
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

export async function notifyApprovalsPending(opts: {
  playerName: string;
  pendingCount: number;
}): Promise<PushSendResult> {
  const countLabel = opts.pendingCount === 1 ? "1 chore" : `${opts.pendingCount} chores`;
  return notifyApprovalRequest({
    kind: "chore_claim",
    subjectId: "approvals-nudge",
    title: `${opts.playerName} needs a grown-up`,
    body: `Approvals pending (${countLabel}). Open Approvals to review.`,
    url: "/parent/approvals",
    critical: false,
  });
}
