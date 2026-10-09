/**
 * Venice text/decisions client for the read-only balance agent.
 *
 * Mirrors the soft-miss posture of `jarArt.ts`: a missing API key means the
 * caller quietly produces nothing, and network/parse failures are returned as
 * typed `{ ok: false }` results instead of throwing.
 */

const VENICE_BASE = "https://api.venice.ai/api/v1";

function envVar(name: string, fallback = ""): string {
  return (process.env[name] ?? fallback).trim();
}

export type VeniceConfig = {
  apiKey: string;
  decisionModel: string;
  textModel: string;
  explainModel: string;
};

/**
 * Balance tuning keys are namespaced under METRICS_VENICE_* so the shared-goal
 * image key (VENICE_API_KEY) and the tuning key can be rotated independently.
 * The tuning agent requires its own key and never falls back to the image key.
 */
export function readVeniceConfig(): VeniceConfig {
  return {
    apiKey: envVar("METRICS_VENICE_API_KEY"),
    decisionModel: envVar("METRICS_VENICE_DECISION_MODEL", "jev-latest"),
    textModel: envVar("METRICS_VENICE_TEXT_MODEL", "deepseek-v4-pro"),
    explainModel: envVar("METRICS_VENICE_EXPLAIN_MODEL", "deepseek-v4-flash"),
  };
}

/** True when the tuning agent's own key is present (soft-miss gate elsewhere). */
export function metricsVeniceEnabled(): boolean {
  return Boolean(process.env.METRICS_VENICE_API_KEY?.trim());
}

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

/** Extract a JSON object from a model reply (bare object or fenced/code block). */
export function parseJsonObject(raw: string): unknown {
  const text = raw.trim();
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch {
        /* fall through to null */
      }
    }
    return null;
  }
}

type BaseResult<T> = { ok: true; parsed: T } | { ok: false; reason: string };

export type ChatResult = BaseResult<unknown>;

/**
 * Venice `/chat/completions`. Without `json`, `parsed` is the assistant text;
 * with `json`, `parsed` is the object parsed out of the reply.
 */
export async function chat(opts: {
  messages: ChatMessage[];
  model?: string;
  apiKey?: string;
  json?: boolean;
  fetcher?: typeof fetch;
  timeoutMs?: number;
}): Promise<ChatResult> {
  const key = opts.apiKey ?? readVeniceConfig().apiKey;
  if (!key) return { ok: false, reason: "no-key" };
  const fetcher = opts.fetcher ?? fetch;
  const body: Record<string, unknown> = {
    model: opts.model ?? readVeniceConfig().textModel,
    messages: opts.messages,
  };
  if (opts.json) body.response_format = { type: "json_object" };

  let response: Response;
  try {
    response = await fetcher(`${VENICE_BASE}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 90_000),
    });
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : "venice-network" };
  }
  if (!response.ok) return { ok: false, reason: `venice-${response.status}` };

  let json: { choices?: Array<{ message?: { content?: string } }> };
  try {
    json = (await response.json()) as typeof json;
  } catch {
    return { ok: false, reason: "venice-json" };
  }
  const content = json.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) return { ok: false, reason: "venice-empty" };

  if (opts.json) {
    const parsed = parseJsonObject(content);
    if (parsed == null) return { ok: false, reason: "venice-bad-json" };
    return { ok: true, parsed };
  }
  return { ok: true, parsed: content };
}

/**
 * Resolve the reasoning/explainer model IDs from the Venice `traits` catalog so
 * they track the catalog rather than being hard-coded. The reasoner comes from
 * `default_reasoning` and the cheap explainer from `function_calling_default`; a
 * listing failure falls back to the configured ids (no key → configured ids).
 */
export async function resolveTextModels(cfg: {
  apiKey: string;
  textModel?: string;
  explainModel?: string;
}): Promise<{ text: string; explain: string }> {
  const config = readVeniceConfig();
  const fallbackText = cfg.textModel ?? config.textModel ?? "deepseek-v4-pro";
  const fallbackExplain = cfg.explainModel ?? config.explainModel ?? "deepseek-v4-flash";
  const fallback = { text: fallbackText, explain: fallbackExplain };
  if (!cfg.apiKey) return fallback;
  try {
    const response = await fetch(`${VENICE_BASE}/models/traits?type=text`, {
      headers: { Authorization: `Bearer ${cfg.apiKey}` },
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) return fallback;
    const body = (await response.json()) as Record<string, unknown>;
    const data = body.data && typeof body.data === "object" ? (body.data as Record<string, unknown>) : body;
    const text = typeof data.default_reasoning === "string" ? (data.default_reasoning as string) : fallbackText;
    const explain =
      typeof data.function_calling_default === "string"
        ? (data.function_calling_default as string)
        : fallbackExplain;
    return { text, explain };
  } catch {
    return fallback;
  }
}

export type DecisionQuestion = {
  type: "noul" | "choice" | "score";
  instructions?: string;
  options?: string[];
  context?: string;
};

export type DecisionCallResult =
  | { ok: true; raw: unknown }
  | { ok: false; reason: string };

/**
 * Venice `/decisions` (the geometric-evidence judge, "Jev"). The response is
 * intentionally treated as opaque here — `balanceDecision.ts` maps it into a
 * stable internal shape.
 */
export async function decision(opts: {
  state: string;
  questions: Record<string, DecisionQuestion>;
  model?: string;
  apiKey?: string;
  fetcher?: typeof fetch;
  timeoutMs?: number;
}): Promise<DecisionCallResult> {
  const key = opts.apiKey ?? readVeniceConfig().apiKey;
  if (!key) return { ok: false, reason: "no-key" };
  const fetcher = opts.fetcher ?? fetch;
  try {
    const response = await fetcher(`${VENICE_BASE}/decisions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: opts.model ?? readVeniceConfig().decisionModel,
        state: opts.state,
        questions: opts.questions,
      }),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 120_000),
    });
    if (!response.ok) return { ok: false, reason: `venice-${response.status}` };
    const raw: unknown = await response.json();
    return { ok: true, raw };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : "venice-network" };
  }
}