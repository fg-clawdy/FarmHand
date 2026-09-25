/**
 * Surgical HEAT patches for FarmHand API/player files (idempotent).
 * Run from repo root: node tmp/fh-heat-dropin/patch_api.mjs
 * Or: node <dropin>/patch_api.mjs <repoRoot>
 */
import fs from "node:fs";
import path from "node:path";

const repo = path.resolve(process.argv[2] || process.cwd());
const log = (m) => console.log(m);

function read(rel) {
  return fs.readFileSync(path.join(repo, rel), "utf8");
}
function write(rel, text) {
  fs.writeFileSync(path.join(repo, rel), text);
  log(`PATCHED ${rel}`);
}
function exists(rel) {
  return fs.existsSync(path.join(repo, rel));
}

function ensureImport(text, importLine, marker) {
  if (text.includes(marker)) return text;
  // insert after last import
  const lines = text.split(/\r?\n/);
  let lastImport = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^import\s/.test(lines[i])) lastImport = i;
  }
  if (lastImport >= 0) {
    lines.splice(lastImport + 1, 0, importLine);
    return lines.join("\n");
  }
  return importLine + "\n" + text;
}

// ---- chores.ts ----
if (exists("apps/api/src/chores.ts")) {
  let t = read("apps/api/src/chores.ts");
  t = ensureImport(
    t,
    'import { bumpHeatOnClaim, loadHeatByChoreId } from "./choreHeat.js";',
    "choreHeat.js",
  );

  if (!t.includes("heatByChoreId?: Record<string, number>")) {
    t = t.replace(
      "raceTakenKeys: Set<string>;\n  },\n)",
      "raceTakenKeys: Set<string>;\n    heatByChoreId?: Record<string, number>;\n  },\n)",
    );
    // also try CRLF / alternate formatting
    if (!t.includes("heatByChoreId?: Record<string, number>")) {
      t = t.replace(
        /raceTakenKeys:\s*Set<string>;/,
        "raceTakenKeys: Set<string>;\n    heatByChoreId?: Record<string, number>;",
      );
    }
  }

  if (!t.includes("heatScore:")) {
    t = t.replace(
      /flyerUrl:\s*wantedFlyerPublicUrl\(chore\.slug\),\s*\n\s*\};/,
      "flyerUrl: wantedFlyerPublicUrl(chore.slug),\n    heatScore: opts.heatByChoreId?.[chore.id] ?? 0,\n  };",
    );
  }

  if (!t.includes("await loadHeatByChoreId()")) {
    t = t.replace(
      /const raceTakenKeys = new Set\(raceSlots\.map\(\(row\) => `\$\{row\.choreId\}:\$\{row\.periodKey\}`\)\);/,
      'const raceTakenKeys = new Set(raceSlots.map((row) => `${row.choreId}:${row.periodKey}`));\n  const heatByChoreId = await loadHeatByChoreId();',
    );
  }

  if (!t.includes("heatByChoreId })") && t.includes("claimedPeriodKeys, raceTakenKeys })")) {
    t = t.replace(
      "claimedPeriodKeys, raceTakenKeys })",
      "claimedPeriodKeys, raceTakenKeys, heatByChoreId })",
    );
  }

  if (!t.includes("HEAT_CLAIM_BUMP") && !t.includes("bumpHeatOnClaim({")) {
    if (t.includes("return await prisma.$transaction(")) {
      t = t.replace("return await prisma.$transaction(", "const result = await prisma.$transaction(", 1);
      const closeAnchor = `      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 12_000 },
    );
    } catch (err) {`;
      const closeNew = `      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 12_000 },
    );
      // HEAT_CLAIM_BUMP — after successful commit (do not run inside serializable tx)
      void bumpHeatOnClaim({ choreId: result.chore.id, playerId: result.playerId }).catch(() => undefined);
      return result;
    } catch (err) {`;
      if (t.includes(closeAnchor)) t = t.replace(closeAnchor, closeNew);
    }
  }

  write("apps/api/src/chores.ts", t);
}

// ---- player.ts board-events ----
if (exists("apps/api/src/routes/player.ts")) {
  let t = read("apps/api/src/routes/player.ts");
  t = ensureImport(t, 'import { recordChoreBoardEvent } from "../choreHeat.js";', "choreHeat.js");

  if (!t.includes("/api/chores/board-events")) {
    const route = `
  // HEAT: fire-and-forget board events (open/dismiss/impression). Claim is recorded server-side.
  app.post("/api/chores/board-events", async (request, reply) => {
    const body = (request.body ?? {}) as {
      eventType?: string;
      source?: string;
      choreId?: string | null;
      suggestedSlot?: boolean | null;
      meta?: unknown;
    };
    const allowedType = new Set(["BOARD_OPEN", "CLAIM", "DISMISS", "RIGHT_NOW_IMPRESSION"]);
    const allowedSource = new Set(["GARDEN_JOB_BOARD", "FARM_CORKBOARD"]);
    if (!body.eventType || !allowedType.has(body.eventType)) {
      return reply.code(400).send({ error: "Invalid eventType." });
    }
    if (!body.source || !allowedSource.has(body.source)) {
      return reply.code(400).send({ error: "Invalid source." });
    }
    // CLAIM is authoritative on the claim path — ignore client CLAIM to avoid double-count.
    if (body.eventType === "CLAIM") {
      return { ok: true, ignored: true };
    }
    const session = await getPlayerSession(request);
    try {
      await recordChoreBoardEvent({
        eventType: body.eventType as "BOARD_OPEN" | "DISMISS" | "RIGHT_NOW_IMPRESSION",
        source: body.source as "GARDEN_JOB_BOARD" | "FARM_CORKBOARD",
        choreId: body.choreId ?? null,
        playerId: session?.playerId ?? null,
        suggestedSlot: body.suggestedSlot ?? null,
        meta: (body.meta ?? undefined) as never,
      });
      return { ok: true };
    } catch (err) {
      request.log.warn({ err }, "board event record failed");
      return { ok: false };
    }
  });

`;
    if (!t.includes('app.get("/api/chores"')) {
      log("WARN: /api/chores GET not found — append board-events at end of playerRoutes");
    } else {
      t = t.replace('  app.get("/api/chores", async (request, reply) => {', route + '  app.get("/api/chores", async (request, reply) => {');
    }
  }
  write("apps/api/src/routes/player.ts", t);
}

// ---- admin.ts ----
if (exists("apps/api/src/routes/admin.ts")) {
  let t = read("apps/api/src/routes/admin.ts");
  t = ensureImport(t, 'import { recomputeAllChoreHeat } from "../choreHeat.js";', "recomputeAllChoreHeat");
  if (!t.includes("/api/admin/chores/heat/refresh")) {
    // insert before final closing of export function
    const idx = t.lastIndexOf("\n}");
    if (idx !== -1) {
      const route = `

  app.post("/api/admin/chores/heat/refresh", async (request, reply) => {
    const session = await requireAdmin(request, reply);
    if (!session) return;
    const result = await recomputeAllChoreHeat();
    return { ok: true, ...result };
  });
`;
      t = t.slice(0, idx) + route + t.slice(idx);
    }
  }
  write("apps/api/src/routes/admin.ts", t);
}

// ---- index.ts ----
if (exists("apps/api/src/index.ts")) {
  let t = read("apps/api/src/index.ts");
  t = ensureImport(
    t,
    'import { startChoreHeatNightlySchedule } from "./choreHeat.js";',
    "startChoreHeatNightlySchedule",
  );
  if (!t.includes("startChoreHeatNightlySchedule(")) {
    if (!t.endsWith("\n")) t += "\n";
    t += "startChoreHeatNightlySchedule(app.log);\n";
  }
  write("apps/api/src/index.ts", t);
}

// ---- api.ts PublicChore.heatScore ----
if (exists("apps/player/src/api.ts")) {
  let t = read("apps/player/src/api.ts");
  if (!t.includes("heatScore")) {
    t = t.replace(
      /flyerUrl\?:\s*string;\s*\n\}/,
      "flyerUrl?: string;\n  /** Farm-wide HEAT 0–100 from ChoreHeat (optional). */\n  heatScore?: number;\n}",
    );
  }
  write("apps/player/src/api.ts", t);
}

log("patch_api.mjs done");
