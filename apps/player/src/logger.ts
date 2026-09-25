export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogContext = Record<string, unknown>;

type ClientErrorPayload = {
  level: "error" | "warn";
  tag: string;
  message: string;
  stack?: string;
  context?: LogContext;
  href?: string;
  userAgent?: string;
  ts: number;
};

const LEVEL_RANK: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const MIN_CONSOLE: LogLevel = "debug";

/** Drop identical reports within this window (ms). */
const DEDUPE_MS = 8_000;
const recent = new Map<string, number>();
let handlersInstalled = false;

function shouldConsole(level: LogLevel) {
  return LEVEL_RANK[level] >= LEVEL_RANK[MIN_CONSOLE];
}

function safeContext(ctx?: LogContext): LogContext | undefined {
  if (!ctx) return undefined;
  const out: LogContext = {};
  for (const [k, v] of Object.entries(ctx)) {
    if (v == null) {
      out[k] = v;
      continue;
    }
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
      out[k] = typeof v === "string" ? v.slice(0, 500) : v;
      continue;
    }
    try {
      out[k] = JSON.parse(JSON.stringify(v));
    } catch {
      out[k] = String(v).slice(0, 200);
    }
  }
  return out;
}

function truncateStack(stack?: string) {
  if (!stack) return undefined;
  return stack.split("\n").slice(0, 12).join("\n").slice(0, 2500);
}

function emit(level: LogLevel, tag: string, message: string, context?: LogContext) {
  const ctx = safeContext(context);
  const line = `[${tag}] ${message}`;
  if (!shouldConsole(level)) return;
  const fn = level === "debug" ? console.debug : level === "info" ? console.info : level === "warn" ? console.warn : console.error;
  if (ctx) fn(line, ctx);
  else fn(line);
}

async function postClientError(payload: ClientErrorPayload) {
  const key = `${payload.tag}|${payload.message}|${payload.stack?.slice(0, 120) ?? ""}`;
  const now = Date.now();
  const prev = recent.get(key) ?? 0;
  if (now - prev < DEDUPE_MS) return;
  recent.set(key, now);
  if (recent.size > 40) {
    for (const [k, t] of recent) {
      if (now - t > DEDUPE_MS * 2) recent.delete(k);
    }
  }
  try {
    await fetch("/api/client-errors", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch {
    /* offline / API down — console already has it */
  }
}

export const log = {
  debug(tag: string, message: string, context?: LogContext) {
    emit("debug", tag, message, context);
  },
  info(tag: string, message: string, context?: LogContext) {
    emit("info", tag, message, context);
  },
  warn(tag: string, message: string, context?: LogContext) {
    emit("warn", tag, message, context);
  },
  error(tag: string, message: string, context?: LogContext) {
    emit("error", tag, message, context);
    const stack = typeof context?.stack === "string" ? context.stack : undefined;
    void postClientError({
      level: "error",
      tag,
      message: message.slice(0, 500),
      stack: truncateStack(stack),
      context: safeContext(context),
      href: typeof location !== "undefined" ? location.href.slice(0, 300) : undefined,
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 300) : undefined,
      ts: Date.now(),
    });
  },
};

/** Install once at boot. Safe to call multiple times. */
export function installGlobalErrorReporting() {
  if (typeof window === "undefined" || handlersInstalled) return;
  handlersInstalled = true;
  window.addEventListener("error", (ev) => {
    const err = ev.error;
    log.error("window.onerror", ev.message || "Unhandled error", {
      stack: err instanceof Error ? err.stack : undefined,
      filename: ev.filename,
      lineno: ev.lineno,
      colno: ev.colno,
    });
  });
  window.addEventListener("unhandledrejection", (ev) => {
    const reason = ev.reason;
    const message =
      reason instanceof Error
        ? reason.message
        : typeof reason === "string"
          ? reason
          : "Unhandled promise rejection";
    log.error("unhandledrejection", message, {
      stack: reason instanceof Error ? reason.stack : undefined,
    });
  });
  log.info("logger", "global error handlers installed");
}
