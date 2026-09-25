/**
 * Surgical honest-skip patches (idempotent). UTF-8 Node writes.
 * Usage: node <dropin>/patch_api.mjs <repoRoot>
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

// ---- Prisma schema: SKIPPED enum ----
if (exists("apps/api/prisma/schema.prisma")) {
  let t = read("apps/api/prisma/schema.prisma");
  if (!t.includes("SKIPPED")) {
    t = t.replace(
      /enum ChoreClaimStatus \{\s*PENDING\s*APPROVED\s*DENIED\s*\}/,
      "enum ChoreClaimStatus {\n  PENDING\n  APPROVED\n  DENIED\n  SKIPPED\n}",
    );
    if (!t.includes("SKIPPED")) {
      t = t.replace(
        /(enum ChoreClaimStatus \{[^}]*)(DENIED)/,
        "$1$2\n  SKIPPED",
      );
    }
    write("apps/api/prisma/schema.prisma", t);
  } else {
    log("OK schema already has SKIPPED");
  }
}

// ---- shared index: export choreSkip ----
if (exists("packages/shared/src/index.ts")) {
  let t = read("packages/shared/src/index.ts");
  if (!t.includes("choreSkip")) {
    if (!t.endsWith("\n")) t += "\n";
    t += 'export * from "./choreSkip.js";\n';
    write("packages/shared/src/index.ts", t);
  } else {
    log("OK shared index exports choreSkip");
  }
}

// ---- shared package.json test script ----
if (exists("packages/shared/package.json")) {
  let pj = read("packages/shared/package.json");
  if (!pj.includes("choreSkip.test")) {
    let pj2 = pj.replace(
      'src/choreCatalog.test.ts',
      'src/choreCatalog.test.ts src/choreSkip.test.ts',
    );
    if (pj2 === pj) {
      pj2 = pj.replace(/("test"\s*:\s*"[^"]+)"/, '$1 src/choreSkip.test.ts"');
    }
    write("packages/shared/package.json", pj2);
  } else {
    log("OK shared package.json lists choreSkip.test");
  }
}

// ---- seedChoreCatalog: sync allowsSkip on existing rows ----
if (exists("apps/api/src/chores.ts")) {
  let t = read("apps/api/src/chores.ts");
  if (!t.includes("SYNC_ALLOWS_SKIP")) {
    const marker = "  const extras = await prisma.chore.findMany();";
    if (t.includes(marker)) {
      t = t.replace(
        marker,
        `  // SYNC_ALLOWS_SKIP — align DB flags with catalog (idempotent)
  {
    const { CHORE_CATALOG: catalogRows } = await import("@farmhand/shared");
    for (const row of catalogRows) {
      await prisma.chore.updateMany({
        where: { slug: row.slug },
        data: { allowsSkip: row.allowsSkip },
      });
    }
  }
  const extras = await prisma.chore.findMany();`,
      );
    } else {
      log("WARN: seed extras marker not found — skip allowsSkip sync");
    }
  }

  // FamilyOpenJob.allowsSkip
  if (t.includes("export type FamilyOpenJob") && !/export type FamilyOpenJob = \{[\s\S]*?allowsSkip/.test(t)) {
    t = t.replace(
      "requiresSelfie: boolean;",
      "requiresSelfie: boolean;\n  allowsSkip: boolean;",
    );
  }
  // Only first FamilyOpenJob-ish push — insert allowsSkip next to requiresSelfie in jobs.push
  if (!t.includes("allowsSkip: chore.allowsSkip")) {
    const pushAnchor = "requiresSelfie: chore.requiresSelfie,";
    if (t.includes(pushAnchor)) {
      t = t.replace(pushAnchor, "requiresSelfie: chore.requiresSelfie,\n      allowsSkip: chore.allowsSkip,");
    }
  }
  write("apps/api/src/chores.ts", t);
}

// ---- player routes: POST /api/chores/:id/skip ----
if (exists("apps/api/src/routes/player.ts")) {
  let t = read("apps/api/src/routes/player.ts");
  t = ensureImport(t, 'import { skipChore } from "../choreSkip.js";', "choreSkip.js");
  if (!t.includes("/api/chores/:id/skip")) {
    const route = `
  app.post("/api/chores/:id/skip", async (request, reply) => {
    const session = await requirePlayer(request, reply);
    if (!session) return;
    const { id } = request.params as { id: string };
    const config = await loadConfig();
    try {
      const result = await skipChore({
        playerId: session.playerId,
        choreId: id,
        timezone: config.timezone,
      });
      const chores = await listPlayerChores(session.playerId, config.timezone);
      return {
        player: publicPlayer(result.player, config, true),
        claim: { id: result.claim.id, status: result.claim.status, slot: null },
        shardsGranted: result.shardsGranted,
        chores,
        toast: \`Not needed · +\${result.shardsGranted} \uD83D\uDD36\`,
      };
    } catch (err) {
      const e = err as Error & { statusCode?: number };
      return reply.code(e.statusCode ?? 400).send({ error: e.message });
    }
  });

`;
    if (t.includes('app.post("/api/chores/:id/claim"')) {
      t = t.replace('  app.post("/api/chores/:id/claim", async (request, reply) => {', route + '  app.post("/api/chores/:id/claim", async (request, reply) => {');
    } else {
      log("WARN: claim route not found — append skip near chores");
      const idx = t.indexOf('app.get("/api/chores"');
      if (idx >= 0) t = t.slice(0, idx) + route + t.slice(idx);
    }
  }
  // ensure listPlayerChores + publicPlayer imports already present (claim uses them)
  write("apps/api/src/routes/player.ts", t);
}

// ---- player api.ts types + skipChore client ----
if (exists("apps/player/src/api.ts")) {
  let t = read("apps/player/src/api.ts");
  if (!t.includes("allowsSkip")) {
    t = t.replace(
      /requiresSelfie:\s*boolean;\n(\s*)includeInPath/,
      "requiresSelfie: boolean;\n  allowsSkip?: boolean;\n$1includeInPath",
    );
    if (!t.includes("allowsSkip")) {
      t = t.replace(
        /requiresSelfie:\s*boolean;/,
        "requiresSelfie: boolean;\n  allowsSkip?: boolean;",
      );
    }
  }
  // FamilyJob allowsSkip
  if (t.includes("export type FamilyJob") && !t.match(/export type FamilyJob = \{[^}]*allowsSkip/s)) {
    t = t.replace(
      /(export type FamilyJob = \{[^}]*requiresSelfie:\s*boolean;)/,
      "$1\n  allowsSkip?: boolean;",
    );
  }
  if (!t.includes("skipChore:")) {
    t = t.replace(
      /claimChore:\s*\(id: string, body\?: \{ image\?: string \}\) =>\s*\n?\s*request<\{ player: GardenPlayer; claim: \{ id: string; status: string; slot: number \| null \}; unlocks\?: AccoladeUnlock\[\] \}>\(\s*`\/api\/chores\/\$\{id\}\/claim`,\s*\{[\s\S]*?\},\s*\),/,
      (m) =>
        m +
        `
  skipChore: (id: string) =>
    request<{
      player: GardenPlayer;
      claim: { id: string; status: string; slot: number | null };
      shardsGranted: number;
      chores?: PublicChore[];
      toast?: string;
    }>(\`/api/chores/\${id}/skip\`, { method: "POST", body: "{}" }),`,
    );
    if (!t.includes("skipChore:")) {
      t = t.replace(
        'claimChore:',
        `skipChore: (id: string) =>
    request<{
      player: GardenPlayer;
      claim: { id: string; status: string; slot: number | null };
      shardsGranted: number;
      chores?: PublicChore[];
      toast?: string;
    }>(\`/api/chores/\${id}/skip\`, { method: "POST", body: "{}" }),
  claimChore:`,
      );
    }
  }
  write("apps/player/src/api.ts", t);
}

// ---- Garden.tsx: wire onSkip ----
if (exists("apps/player/src/screens/Garden.tsx")) {
  let t = read("apps/player/src/screens/Garden.tsx");
  if (!t.includes("api.skipChore") && t.includes("onClaim={async (chore)")) {
    t = t.replace(
      /onClaim=\{async \(chore\) => \{[\s\S]*?return data\.player;\s*\}\}\s*\n\s*onNeedPhoto=/,
      (m) => {
        if (m.includes("onSkip")) return m;
        return m.replace(
          "onNeedPhoto=",
          `onSkip={async (chore) => {
            const data = await api.skipChore(chore.id);
            if (data.chores) setChores(data.chores);
            applyGarden(data.player);
            setError(data.toast || "Not needed · +1 shard");
            window.setTimeout(() => setError((cur) => (cur === (data.toast || "Not needed · +1 shard") ? "" : cur)), 2800);
            return data.player;
          }}
          onNeedPhoto=`,
        );
      },
    );
    // fallback simpler insert after onClaim block's closing
    if (!t.includes("api.skipChore")) {
      t = t.replace(
        `onNeedPhoto={(chore) => setOverlay({ type: "chore-photo", chore })}`,
        `onSkip={async (chore) => {
            const data = await api.skipChore(chore.id);
            if (data.chores) setChores(data.chores);
            applyGarden(data.player);
            setError(data.toast || "Not needed · +1 shard");
            window.setTimeout(() => setError((cur) => (cur === (data.toast || "Not needed · +1 shard") ? "" : cur)), 2800);
            return data.player;
          }}
          onNeedPhoto={(chore) => setOverlay({ type: "chore-photo", chore })}`,
      );
    }
    write("apps/player/src/screens/Garden.tsx", t);
  } else {
    log("OK Garden skip wiring or missing JobBoard");
  }
}

// ---- FarmJobFlow: wire onSkip ----
if (exists("apps/player/src/components/FarmJobFlow.tsx")) {
  let t = read("apps/player/src/components/FarmJobFlow.tsx");
  if (!t.includes("api.skipChore")) {
    t = t.replace(
      /onNeedPhoto=\{\(chore\) => \{/,
      `onSkip={async (chore) => {
            const data = await api.skipChore(chore.id);
            if (data.chores) setChores(data.chores);
            applyGarden(data.player);
            setError(data.toast || "Not needed · +1 shard");
            window.setTimeout(() => setError((cur) => (cur === (data.toast || "Not needed · +1 shard") ? "" : cur)), 2800);
            return data.player;
          }}
          onNeedPhoto={(chore) => {`,
    );
    write("apps/player/src/components/FarmJobFlow.tsx", t);
  } else {
    log("OK FarmJobFlow already has skip");
  }
}

// ---- FarmDashboard: ensure FarmChoreClaim gets jobs with allowsSkip (no change if already) ----
log("patch_api.mjs done");
