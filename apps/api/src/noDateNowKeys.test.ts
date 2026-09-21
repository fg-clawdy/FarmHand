import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * Stage 1 invariant: no idempotency key in the API source code may
 * contain `Date.now()`. Keys must be stable (derived from log IDs,
 * caller-supplied request UUIDs, or composite unique constraints).
 *
 * This test greps the source tree for the banned pattern.
 */

function grepFiles(pattern: RegExp, excludeDirs: string[] = []): string[] {
  const hits: string[] = [];

  function walk(dir: string) {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!excludeDirs.includes(entry.name) && !entry.name.startsWith(".")) {
          walk(full);
        }
      } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
        try {
          const content = readFileSync(full, "utf-8");
          const lines = content.split("\n");
          for (let i = 0; i < lines.length; i += 1) {
            if (pattern.test(lines[i]!)) {
              hits.push(`${full}:${i + 1}: ${lines[i]!.trim()}`);
            }
          }
        } catch {
          // skip unreadable
        }
      }
    }
  }

  walk(resolve(import.meta.dirname ?? ".", "."));
  return hits;
}

describe("Idempotency key hygiene", () => {
  it("no idempotency key contains Date.now()", () => {
    // Pattern: any line that contains Date.now() and also mentions
    // "idempotencyKey" or "key" nearby (within 3 lines before/after).
    // For simplicity we look for Date.now() anywhere, then filter.
    const hits = grepFiles(/Date\.now\(\)/);

    // Now filter to only lines that are plausibly in an idempotency-key context.
    // We look at the surrounding file context.
    const keyHits = hits.filter((hit) => {
      // Read the file and check if the Date.now() line is near
      // an "idempotencyKey" string within 3 lines
      const [filePath, lineStr] = hit.split(":");
      if (!filePath || !lineStr) return false;
      const lineNum = parseInt(lineStr, 10);
      if (isNaN(lineNum)) return false;

      try {
        const lines = readFileSync(filePath, "utf-8").split("\n");
        const start = Math.max(0, lineNum - 4);
        const end = Math.min(lines.length, lineNum + 3);
        const context = lines.slice(start, end).join("\n");
        return context.includes("idempotencyKey") || context.includes("idempotency");
      } catch {
        return false;
      }
    });

    if (keyHits.length > 0) {
      assert.fail(
        `Found ${keyHits.length} idempotency key(s) using Date.now():\n${keyHits.join("\n")}\n\n` +
        "Replace with stable keys (log IDs, caller-supplied request UUIDs, or composite unique constraints).",
      );
    }
  });

  it("Date.now() is not used in any star ledger key construction", () => {
    // Broader scan: any file that imports appendStarEvent and also uses Date.now()
    const hits = grepFiles(/Date\.now\(\)/);
    const starFiles = hits.filter((hit) => {
      const [filePath] = hit.split(":");
      if (!filePath) return false;
      try {
        const content = readFileSync(filePath, "utf-8");
        return content.includes("appendStarEvent") || content.includes("StarLedgerEvent");
      } catch {
        return false;
      }
    });

    if (starFiles.length > 0) {
      assert.fail(
        `Found ${starFiles.length} file(s) that reference star ledger AND use Date.now():\n${starFiles.join("\n")}\n\n` +
        "All star ledger idempotency keys must be stable.",
      );
    }
  });
});
