/**
 * Mapping layer between the Venice `/decisions` ("Jev") response envelope and a
 * stable internal shape. The exact JSON schema of `noul` / `choice` / `score`
 * answers can vary, so this module is deliberately tolerant: it reads the known
 * keys and falls back to the standard-text-model ("reasoner") JSON output when
 * the judge is absent.
 */

export type NoulAnswer = { kind: "noul"; probability: number };
export type ChoiceAnswer = { kind: "choice"; label: string; distribution: Record<string, number> };
export type ScoreAnswer = { kind: "score"; rating: string; scores: Record<string, number> };
export type DecisionAnswer = NoulAnswer | ChoiceAnswer | ScoreAnswer;

/** A single mapped answer plus its confidence. */
export type DecisionResult = {
  answer: DecisionAnswer;
  /** 0..1; for `noul` this is the yes-probability itself unless the source
   *  reports an explicit confidence. */
  confidence: number;
  usage?: unknown;
};

function isObj(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function distributionFrom(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (isObj(raw)) {
    for (const [key, value] of Object.entries(raw)) {
      const n = toNumber(value);
      if (n !== null) out[key] = n;
    }
  }
  return out;
}

function clampProbability(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * Map a single answer object to a DecisionResult. Accepts the documented
 * shapes (`{ type, noul }`, `{ type, choice, distribution }`,
 * `{ type, score, scores }`) plus common aliases.
 */
export function mapAnswerObject(raw: unknown, usage?: unknown): DecisionResult | null {
  if (!isObj(raw)) return null;
  const type = raw.type;

  const noulRaw = raw.noul ?? raw.probability ?? raw.yes ?? raw.p;
  const isNoul =
    type === "noul" ||
    (noulRaw !== undefined && type !== "choice" && type !== "score" && raw.choice == null);
  if (isNoul) {
    const probability = toNumber(noulRaw);
    if (probability === null) return null;
    return {
      answer: { kind: "noul", probability: clampProbability(probability) },
      confidence: toNumber(raw.confidence ?? raw.probabilityOfYes) ?? clampProbability(probability),
      usage: usage ?? raw.usage,
    };
  }

  const choiceRaw = raw.choice ?? raw.label ?? raw.value;
  if (type === "choice" || (choiceRaw !== undefined && type !== "score")) {
    const distribution = distributionFrom(raw.distribution ?? raw.probabilities ?? raw.prospects ?? raw.options);
    if (Object.keys(distribution).length === 0) return null;
    const peak = Object.values(distribution).reduce((a, b) => Math.max(a, b), 0);
    return {
      answer: { kind: "choice", label: String(choiceRaw ?? ""), distribution },
      confidence: toNumber(raw.confidence) ?? peak,
      usage: usage ?? raw.usage,
    };
  }

  const scoreRaw = raw.score ?? raw.rating ?? raw.label;
  if (type === "score" || scoreRaw !== undefined) {
    const scores = distributionFrom(raw.scores ?? raw.distribution ?? raw.probabilities);
    const peak = Object.values(scores).reduce((a, b) => Math.max(a, b), 0);
    return {
      answer: { kind: "score", rating: String(scoreRaw ?? ""), scores },
      confidence: toNumber(raw.confidence) ?? (Object.values(scores).length ? peak : 0),
      usage: usage ?? raw.usage,
    };
  }

  return null;
}

/**
 * Map a full `/decisions` response to a DecisionResult, optionally selecting a
 * specific question key. Supports the `{ model, answers: {...}, usage }`
 * envelope and a bare-from-LLM shape.
 */
export function mapDecision(raw: unknown, questionKey?: string): DecisionResult | null {
  if (!isObj(raw)) return null;
  const usage = raw.usage;
  const answers = raw.answers ?? raw.data ?? raw;

  if (isObj(answers)) {
    if (questionKey) {
      const target = (answers as Record<string, unknown>)[questionKey];
      if (target !== undefined) {
        const mapped = mapAnswerObject(target, usage);
        if (mapped) return mapped;
      } else {
        const direct = mapAnswerObject(answers, usage);
        if (direct) return direct;
      }
    } else {
      for (const value of Object.values(answers as Record<string, unknown>)) {
        const mapped = mapAnswerObject(value, usage);
        if (mapped) return mapped;
      }
    }
  }

  return mapAnswerObject(answers, usage);
}

/**
 * Fallback: map the reasoner LLM's `{ triage, knob, severity, confidence }`
 * output into the same decision shape (triage as an `noul` probability).
 */
export function decisionFromLlmJson(parsed: unknown): DecisionResult | null {
  if (!isObj(parsed)) return null;

  const confidence = toNumber(parsed.confidence) ?? 0;

  let probability: number;
  if (typeof parsed.triage === "boolean") {
    probability = parsed.triage ? 1 : 0;
  } else {
    const n = toNumber(parsed.triage ?? parsed.probability ?? parsed.yes);
    if (n === null) return null;
    probability = clampProbability(n);
  }

  return {
    answer: { kind: "noul", probability },
    confidence,
    usage: { knob: parsed.knob ?? null, severity: parsed.severity ?? null },
  };
}