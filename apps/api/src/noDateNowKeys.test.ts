import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * Stage 1 invariant: no idempotency key in the API source may be built
 * from `Date.now()`. Keys must be stable (log ids, caller-supplied request
 * ids, or other unique constraints).
 *
 * Comments and this test file are not source. A clock (`Date.now()` used
 * as a number for expiry, rate limits, or windows) is not a key, even
 * when the same file also writes the point ledger.
 */

const SELF_FILE = "noDateNowKeys.test.ts";
const DATE_NOW = /(?<![\w$])Date\.now\(\)/;

type Hit = { line: number; detail: string };
type Binding = { name: string; expr: string; at: number };
type KeyUse = { expr: string; at: number; line: number };
type Frame =
  | { kind: "code"; brace: number }
  | { kind: "sq" }
  | { kind: "dq" }
  | { kind: "tmpl" };

function hasDateNow(text: string): boolean {
  return DATE_NOW.test(text);
}

function lineAt(source: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index && i < source.length; i += 1) {
    if (source[i] === "\n") line += 1;
  }
  return line;
}

function prevNonWs(source: string, index: number): string {
  for (let i = index - 1; i >= 0; i -= 1) {
    const c = source[i]!;
    if (!/\s/.test(c)) return c;
  }
  return "";
}

function skipSpaceAndNewlines(source: string, index: number): number {
  let i = index;
  while (i < source.length && /\s/.test(source[i]!)) i += 1;
  return i;
}

function isIdentStart(c: string | undefined): boolean {
  return c != null && /[A-Za-z_$]/.test(c);
}

function isIdentPart(c: string | undefined): boolean {
  return c != null && /[\w$]/.test(c);
}

/** Blank comments. Strings, templates, and `${...}` code stay, and line breaks stay. */
function stripComments(source: string): string {
  const out: string[] = [];
  const stack: Frame[] = [{ kind: "code", brace: 0 }];
  let i = 0;

  const mode = () => stack[stack.length - 1]!;

  while (i < source.length) {
    const c = source[i]!;
    const d = source[i + 1];
    const frame = mode();

    if (frame.kind === "sq" || frame.kind === "dq") {
      out.push(c);
      i += 1;
      if (c === "\\") {
        if (i < source.length) {
          out.push(source[i]!);
          i += 1;
        }
        continue;
      }
      if ((frame.kind === "sq" && c === "'") || (frame.kind === "dq" && c === '"')) stack.pop();
      continue;
    }

    if (frame.kind === "tmpl") {
      if (c === "\\") {
        out.push(c);
        i += 1;
        if (i < source.length) {
          out.push(source[i]!);
          i += 1;
        }
        continue;
      }
      if (c === "`") {
        stack.pop();
        out.push(c);
        i += 1;
        continue;
      }
      if (c === "$" && d === "{") {
        stack.push({ kind: "code", brace: 0 });
        out.push(c, d);
        i += 2;
        continue;
      }
      out.push(c);
      i += 1;
      continue;
    }

    if (c === "/" && d === "/") {
      out.push(" ", " ");
      i += 2;
      while (i < source.length && source[i] !== "\n") {
        out.push(" ");
        i += 1;
      }
      continue;
    }
    if (c === "/" && d === "*") {
      out.push(" ", " ");
      i += 2;
      while (i < source.length && !(source[i] === "*" && source[i + 1] === "/")) {
        out.push(source[i] === "\n" ? "\n" : " ");
        i += 1;
      }
      if (i < source.length) {
        out.push(" ", " ");
        i += 2;
      }
      continue;
    }
    if (c === "'") {
      stack.push({ kind: "sq" });
      out.push(c);
      i += 1;
      continue;
    }
    if (c === '"') {
      stack.push({ kind: "dq" });
      out.push(c);
      i += 1;
      continue;
    }
    if (c === "`") {
      stack.push({ kind: "tmpl" });
      out.push(c);
      i += 1;
      continue;
    }
    if (c === "{") {
      frame.brace += 1;
      out.push(c);
      i += 1;
      continue;
    }
    if (c === "}") {
      if (frame.brace > 0) frame.brace -= 1;
      else if (stack.length > 1) stack.pop();
      out.push(c);
      i += 1;
      continue;
    }
    out.push(c);
    i += 1;
  }

  return out.join("");
}

function isAssignmentEquals(source: string, index: number): boolean {
  if (source[index] !== "=") return false;
  const prev = source[index - 1];
  const next = source[index + 1];
  if (prev === "=" || prev === "!" || prev === "<" || prev === ">") return false;
  if (next === "=" || next === ">") return false;
  return true;
}

function continuesExpression(source: string, newlineIndex: number): boolean {
  const next = skipSpaceAndNewlines(source, newlineIndex + 1);
  const ch = source[next];
  if (!ch) return false;
  return /[?:.&|+\-*/%<>=!([]/.test(ch) || ch === "`";
}

/** Value expression starting at `start` (whitespace allowed). Stops before `,` `;` `)` `}` at depth 0. */
function readExpression(source: string, start: number): { expr: string; end: number } {
  let i = skipSpaceAndNewlines(source, start);
  const begin = i;
  let paren = 0;
  let bracket = 0;
  let brace = 0;
  const stack: Array<"code" | "sq" | "dq" | "tmpl"> = ["code"];

  while (i < source.length) {
    const c = source[i]!;
    const d = source[i + 1];
    const m = stack[stack.length - 1]!;

    if (m === "sq" || m === "dq") {
      i += 1;
      if (c === "\\") {
        if (i < source.length) i += 1;
        continue;
      }
      if ((m === "sq" && c === "'") || (m === "dq" && c === '"')) stack.pop();
      continue;
    }
    if (m === "tmpl") {
      if (c === "\\") {
        i += 1;
        if (i < source.length) i += 1;
        continue;
      }
      if (c === "`") {
        stack.pop();
        i += 1;
        continue;
      }
      if (c === "$" && d === "{") {
        stack.push("code");
        i += 2;
        continue;
      }
      i += 1;
      continue;
    }

    if (c === "'") {
      stack.push("sq");
      i += 1;
      continue;
    }
    if (c === '"') {
      stack.push("dq");
      i += 1;
      continue;
    }
    if (c === "`") {
      stack.push("tmpl");
      i += 1;
      continue;
    }
    if (c === "(") {
      paren += 1;
      i += 1;
      continue;
    }
    if (c === "[") {
      bracket += 1;
      i += 1;
      continue;
    }
    if (c === "{") {
      brace += 1;
      i += 1;
      continue;
    }
    if (c === ")" && paren > 0) {
      paren -= 1;
      i += 1;
      continue;
    }
    if (c === "]" && bracket > 0) {
      bracket -= 1;
      i += 1;
      continue;
    }
    if (c === "}" && brace > 0) {
      brace -= 1;
      i += 1;
      continue;
    }
    if (c === "}" && stack.length > 1) {
      stack.pop();
      i += 1;
      continue;
    }
    if (paren === 0 && bracket === 0 && brace === 0 && stack.length === 1) {
      if (c === "," || c === ";" || c === ")" || c === "}" || c === "]") break;
      if ((c === "\n" || c === "\r") && i > begin && !continuesExpression(source, i)) break;
    }
    i += 1;
  }

  return { expr: source.slice(begin, i), end: i };
}

/**
 * If `start` is a type annotation, return the index of its assignment `=`.
 * Return null when the colon introduces a value instead (object property).
 */
function typeAssignmentEquals(source: string, start: number): number | null {
  let i = start;
  let angle = 0;
  let paren = 0;
  let bracket = 0;
  let brace = 0;
  const stack: Array<"code" | "sq" | "dq" | "tmpl"> = ["code"];

  while (i < source.length) {
    const c = source[i]!;
    const d = source[i + 1];
    const m = stack[stack.length - 1]!;

    if (m === "sq" || m === "dq") {
      i += 1;
      if (c === "\\") {
        if (i < source.length) i += 1;
        continue;
      }
      if ((m === "sq" && c === "'") || (m === "dq" && c === '"')) stack.pop();
      continue;
    }
    if (m === "tmpl") {
      if (c === "\\") {
        i += 1;
        if (i < source.length) i += 1;
        continue;
      }
      if (c === "`") {
        stack.pop();
        i += 1;
        continue;
      }
      if (c === "$" && d === "{") {
        stack.push("code");
        i += 2;
        continue;
      }
      i += 1;
      continue;
    }

    if (c === "'") {
      stack.push("sq");
      i += 1;
      continue;
    }
    if (c === '"') {
      stack.push("dq");
      i += 1;
      continue;
    }
    if (c === "`") {
      stack.push("tmpl");
      i += 1;
      continue;
    }
    if (c === "<") {
      angle += 1;
      i += 1;
      continue;
    }
    if (c === ">" && angle > 0) {
      angle -= 1;
      i += 1;
      continue;
    }
    if (c === "(") {
      paren += 1;
      i += 1;
      continue;
    }
    if (c === ")" && paren > 0) {
      paren -= 1;
      i += 1;
      continue;
    }
    if (c === "[") {
      bracket += 1;
      i += 1;
      continue;
    }
    if (c === "]" && bracket > 0) {
      bracket -= 1;
      i += 1;
      continue;
    }
    if (c === "{") {
      brace += 1;
      i += 1;
      continue;
    }
    if (c === "}" && brace > 0) {
      brace -= 1;
      i += 1;
      continue;
    }
    if (angle === 0 && paren === 0 && bracket === 0 && brace === 0 && stack.length === 1) {
      if (c === "=" && d !== "=" && d !== ">") return i;
      if (c === "," || c === ";" || c === "}" || c === ")" || c === "\n") return null;
    }
    i += 1;
  }
  return null;
}

const KEYWORDS = new Set([
  "await",
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "debugger",
  "default",
  "delete",
  "do",
  "else",
  "enum",
  "export",
  "extends",
  "false",
  "finally",
  "for",
  "function",
  "if",
  "import",
  "in",
  "instanceof",
  "new",
  "null",
  "return",
  "static",
  "super",
  "switch",
  "this",
  "throw",
  "true",
  "try",
  "typeof",
  "undefined",
  "var",
  "void",
  "while",
  "with",
  "yield",
]);

function identifiersIn(expr: string): string[] {
  const names: string[] = [];
  const seen = new Set<string>();
  let i = 0;
  let prev = "";
  let paren = 0;
  let bracket = 0;
  let brace = 0;
  const stack: Array<"code" | "sq" | "dq" | "tmpl"> = ["code"];

  const push = (name: string) => {
    if (KEYWORDS.has(name) || seen.has(name)) return;
    seen.add(name);
    names.push(name);
  };

  while (i < expr.length) {
    const c = expr[i]!;
    const d = expr[i + 1];
    const m = stack[stack.length - 1]!;

    if (m === "sq" || m === "dq") {
      i += 1;
      if (c === "\\") {
        if (i < expr.length) i += 1;
        continue;
      }
      if ((m === "sq" && c === "'") || (m === "dq" && c === '"')) stack.pop();
      continue;
    }
    if (m === "tmpl") {
      if (c === "\\") {
        i += 1;
        if (i < expr.length) i += 1;
        continue;
      }
      if (c === "`") {
        stack.pop();
        prev = "`";
        i += 1;
        continue;
      }
      if (c === "$" && d === "{") {
        stack.push("code");
        prev = "{";
        i += 2;
        continue;
      }
      i += 1;
      continue;
    }

    if (c === "'") {
      stack.push("sq");
      prev = "'";
      i += 1;
      continue;
    }
    if (c === '"') {
      stack.push("dq");
      prev = '"';
      i += 1;
      continue;
    }
    if (c === "`") {
      stack.push("tmpl");
      prev = "`";
      i += 1;
      continue;
    }
    if (c === "(") {
      paren += 1;
      prev = c;
      i += 1;
      continue;
    }
    if (c === "[") {
      bracket += 1;
      prev = c;
      i += 1;
      continue;
    }
    if (c === "{") {
      brace += 1;
      prev = c;
      i += 1;
      continue;
    }
    if (c === ")" && paren > 0) {
      paren -= 1;
      prev = c;
      i += 1;
      continue;
    }
    if (c === "]" && bracket > 0) {
      bracket -= 1;
      prev = c;
      i += 1;
      continue;
    }
    if (c === "}" && brace > 0) {
      brace -= 1;
      prev = c;
      i += 1;
      continue;
    }
    if (c === "}" && stack.length > 1) {
      stack.pop();
      prev = c;
      i += 1;
      continue;
    }
    if (isIdentStart(c)) {
      const start = i;
      i += 1;
      while (isIdentPart(expr[i])) i += 1;
      const name = expr.slice(start, i);
      if (prev !== ".") push(name);
      prev = name;
      continue;
    }
    if (!/\s/.test(c)) prev = c;
    i += 1;
  }
  return names;
}

function collect(code: string): { bindings: Binding[]; uses: KeyUse[] } {
  const bindings: Binding[] = [];
  const uses: KeyUse[] = [];
  const stack: Frame[] = [{ kind: "code", brace: 0 }];
  let i = 0;

  while (i < code.length) {
    const c = code[i]!;
    const d = code[i + 1];
    const frame = stack[stack.length - 1]!;

    if (frame.kind === "sq" || frame.kind === "dq") {
      i += 1;
      if (c === "\\") {
        if (i < code.length) i += 1;
        continue;
      }
      if ((frame.kind === "sq" && c === "'") || (frame.kind === "dq" && c === '"')) stack.pop();
      continue;
    }
    if (frame.kind === "tmpl") {
      if (c === "\\") {
        i += 1;
        if (i < code.length) i += 1;
        continue;
      }
      if (c === "`") {
        stack.pop();
        i += 1;
        continue;
      }
      if (c === "$" && d === "{") {
        stack.push({ kind: "code", brace: 0 });
        i += 2;
        continue;
      }
      i += 1;
      continue;
    }

    if (c === "'") {
      stack.push({ kind: "sq" });
      i += 1;
      continue;
    }
    if (c === '"') {
      stack.push({ kind: "dq" });
      i += 1;
      continue;
    }
    if (c === "`") {
      stack.push({ kind: "tmpl" });
      i += 1;
      continue;
    }
    if (c === "{") {
      frame.brace += 1;
      i += 1;
      continue;
    }
    if (c === "}") {
      if (frame.brace > 0) frame.brace -= 1;
      else if (stack.length > 1) stack.pop();
      i += 1;
      continue;
    }

    if (isIdentStart(c) && (i === 0 || !isIdentPart(code[i - 1]))) {
      const start = i;
      i += 1;
      while (isIdentPart(code[i])) i += 1;
      const name = code.slice(start, i);
      const dot = prevNonWs(code, start) === ".";
      const k = skipSpaceAndNewlines(code, i);
      if (!dot && !KEYWORDS.has(name) && isAssignmentEquals(code, k)) {
        const read = readExpression(code, k + 1);
        bindings.push({ name, expr: read.expr, at: k + 1 });
        if (name === "idempotencyKey") {
          uses.push({ expr: read.expr, at: k + 1, line: lineAt(code, start) });
        }
        continue;
      }
      if (!dot && code[k] === ":") {
        if (name === "idempotencyKey") {
          const read = readExpression(code, k + 1);
          uses.push({ expr: read.expr, at: k + 1, line: lineAt(code, start) });
          continue;
        }
        const eq = typeAssignmentEquals(code, k + 1);
        if (eq != null && !KEYWORDS.has(name)) {
          const read = readExpression(code, eq + 1);
          bindings.push({ name, expr: read.expr, at: eq + 1 });
        }
        continue;
      }
      if (!dot && name === "idempotencyKey") {
        const ch = code[k];
        if (ch == null || ch === "," || ch === "}" || ch === ")") {
          uses.push({ expr: name, at: start, line: lineAt(code, start) });
        }
      }
      continue;
    }

    i += 1;
  }

  return { bindings, uses };
}

function nearestBinding(bindings: Binding[], name: string, pos: number): Binding | undefined {
  let found: Binding | undefined;
  for (const binding of bindings) {
    if (binding.name === name && binding.at < pos) found = binding;
  }
  return found;
}

function dateNowDependency(expr: string, exprAt: number, bindings: Binding[], seen: Set<string>, depth: number): string | null {
  if (depth > 8) return null;
  if (hasDateNow(expr)) return compact(expr);
  for (const name of identifiersIn(expr)) {
    if (seen.has(name)) continue;
    const binding = nearestBinding(bindings, name, exprAt);
    if (!binding) continue;
    seen.add(name);
    const inner = dateNowDependency(binding.expr, binding.at, bindings, seen, depth + 1);
    seen.delete(name);
    if (inner) return `${name} = ${inner}`;
  }
  return null;
}

function compact(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** `Date.now()` within 3 lines of the word idempotency, in code (comments already removed). */
function proximityHits(code: string): Hit[] {
  const lines = code.split("\n");
  const hits: Hit[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]!;
    if (!hasDateNow(line)) continue;
    const start = Math.max(0, i - 3);
    const end = Math.min(lines.length, i + 4);
    const context = lines.slice(start, end).join("\n");
    if (context.includes("idempotencyKey") || context.includes("idempotency")) {
      hits.push({ line: i + 1, detail: line.trim() });
    }
  }
  return hits;
}

/**
 * An idempotency key expression that calls `Date.now()` or uses a variable
 * assigned from it. Clock calls that never reach a key are ignored.
 */
function keyConstructionHits(code: string): Hit[] {
  const { bindings, uses } = collect(code);
  const hits: Hit[] = [];
  for (const use of uses) {
    const reason = dateNowDependency(use.expr, use.at, bindings, new Set(), 0);
    if (!reason) continue;
    const shown = compact(use.expr);
    const detail = reason === shown ? shown : `${shown} <= ${reason}`;
    hits.push({ line: use.line, detail });
  }
  return hits;
}

function referencesPointLedger(code: string): boolean {
  return code.includes("appendPointEvent") || code.includes("PointLedgerEvent");
}

function walkSources(dir: string, out: { file: string; code: string }[]) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist") continue;
      walkSources(full, out);
      continue;
    }
    if (entry.name === SELF_FILE) continue;
    if (!entry.name.endsWith(".ts") && !entry.name.endsWith(".tsx")) continue;
    const raw = readFileSync(full, "utf-8");
    out.push({ file: full, code: stripComments(raw) });
  }
}

function sourceFiles(): { file: string; code: string }[] {
  const root = resolve(import.meta.dirname ?? ".", ".");
  const out: { file: string; code: string }[] = [];
  walkSources(root, out);
  return out;
}

function render(file: string, hits: Hit[]): string[] {
  return hits.map((hit) => `${file}:${hit.line}: ${hit.detail}`);
}

describe("Idempotency key hygiene", () => {
  it("no idempotency key contains Date.now()", () => {
    const hits: string[] = [];
    for (const source of sourceFiles()) {
      hits.push(...render(source.file, proximityHits(source.code)));
      hits.push(...render(source.file, keyConstructionHits(source.code)));
    }
    if (hits.length > 0) {
      assert.fail(
        `Found ${hits.length} idempotency key(s) using Date.now():\n${hits.join("\n")}\n\n` +
          "Replace with stable keys (log IDs, caller-supplied request UUIDs, or composite unique constraints).",
      );
    }
  });

  it("Date.now() is not used in any point ledger key construction", () => {
    const hits: string[] = [];
    for (const source of sourceFiles()) {
      if (!referencesPointLedger(source.code)) continue;
      hits.push(...render(source.file, keyConstructionHits(source.code)));
    }
    if (hits.length > 0) {
      assert.fail(
        `Found ${hits.length} point ledger key(s) using Date.now():\n${hits.join("\n")}\n\n` +
          "All point ledger idempotency keys must be stable.",
      );
    }
  });
});

describe("idempotency Date.now() matcher", () => {
  it("ignores comments and still flags a key that calls Date.now()", () => {
    const commented = stripComments(`
      /**
       * Stage 1 invariant: no idempotency key may contain Date.now().
       * appendPointEvent PointLedgerEvent
       */
      // idempotencyKey: \`grant:\${playerId}:\${Date.now()}\`
      const idempotencyKey = \`grant:\${playerId}:\${requestId}\`;
    `);
    assert.equal(commented.split("\n").length, `
      /**
       * Stage 1 invariant: no idempotency key may contain Date.now().
       * appendPointEvent PointLedgerEvent
       */
      // idempotencyKey: \`grant:\${playerId}:\${Date.now()}\`
      const idempotencyKey = \`grant:\${playerId}:\${requestId}\`;
    `.split("\n").length);
    assert.equal(hasDateNow(commented), false);
    assert.deepEqual(proximityHits(commented), []);
    assert.deepEqual(keyConstructionHits(commented), []);

    const inline = stripComments(`
      await appendPointEvent(tx, {
        idempotencyKey: \`grant:\${playerId}:\${Date.now()}:\${amount}\`,
      });
    `);
    assert.ok(proximityHits(inline).length > 0);
    assert.ok(keyConstructionHits(inline).length > 0);

    const adjust = stripComments(`
      await appendPointEvent(tx, {
        kind: "ADJUST_ADMIN",
        idempotencyKey: \`adjust:\${id}:\${Date.now()}:\${delta}\`,
      });
    `);
    assert.ok(keyConstructionHits(adjust).length > 0);
  });

  it("follows a Date.now() variable into a key several lines later", () => {
    const code = stripComments(`
      import { appendPointEvent } from "./points.js";
      const stamp = Date.now();
      const playerId = "p";
      const amount = 1;
      const reason = "because";
      await appendPointEvent(tx, {
        playerId,
        kind: "EARN_GRANT",
        amount,
        idempotencyKey: \`grant:\${playerId}:\${stamp}:\${amount}\`,
        source: "admin_grant",
        meta: { reason },
      });
    `);
    const hits = keyConstructionHits(code);
    assert.equal(hits.length, 1);
    assert.match(hits[0]!.detail, /stamp = Date\.now\(\)/);
  });

  it("allows clocks in a file that also writes stable ledger keys", () => {
    const code = stripComments(`
      import { appendPointEvent } from "./points.js";
      // session expiry is a clock, not a key
      const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000);
      const now = Date.now();
      const elapsed = Date.now() - createdAt;
      const requestId = typeof body.requestId === "string" && body.requestId.length > 0
        ? body.requestId
        : null;
      const key = \`grant:\${playerId}:\${requestId}\`;
      await appendPointEvent(tx, {
        idempotencyKey: key,
      });
      const putbackKey = \`putback:\${giveKey}\`;
      await appendPointEvent(tx, {
        idempotencyKey: putbackKey,
      });
      await appendPointEvent(tx, {
        idempotencyKey: \`adjust:\${id}:\${requestId}\`,
      });
      await appendPointEvent(tx, {
        idempotencyKey: \`earn:basket:\${saleId}\`,
      });
    `);
    assert.deepEqual(proximityHits(code), []);
    assert.deepEqual(keyConstructionHits(code), []);
    assert.equal(referencesPointLedger(code), true);
  });
});
