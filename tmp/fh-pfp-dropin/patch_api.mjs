/**
 * FarmHand PFP drop-in — surgical UTF-8 patches (idempotent).
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
  fs.writeFileSync(path.join(repo, rel), text, "utf8");
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

// ---- Prisma Player avatar fields ----
if (exists("apps/api/prisma/schema.prisma")) {
  let t = read("apps/api/prisma/schema.prisma");
  if (!t.includes("avatarKind")) {
    t = t.replace(
      /(mascot\s+Mascot\s*\n)/,
      "$1  avatarKind               String          @default(\"mascot\")\n  avatarPreset             String?\n  avatarSelfieFile         String?\n",
    );
    if (!t.includes("avatarKind")) {
      t = t.replace(
        /(selfieSeedGrantDate\s+String\?\s*\n)/,
        "$1  avatarKind               String          @default(\"mascot\")\n  avatarPreset             String?\n  avatarSelfieFile         String?\n",
      );
    }
    write("apps/api/prisma/schema.prisma", t);
  } else {
    log("OK schema already has avatarKind");
  }
}

// ---- shared index export ----
if (exists("packages/shared/src/index.ts")) {
  let t = read("packages/shared/src/index.ts");
  if (!t.includes("avatars")) {
    if (!t.endsWith("\n")) t += "\n";
    t += 'export * from "./avatars.js";\n';
    write("packages/shared/src/index.ts", t);
  } else {
    log("OK shared index exports avatars");
  }
}

// ---- shared package.json test ----
if (exists("packages/shared/package.json")) {
  let pj = read("packages/shared/package.json");
  if (!pj.includes("avatars.test")) {
    let pj2 = pj.replace(/("test"\s*:\s*"[^"]+)"/, '$1 src/avatars.test.ts"');
    write("packages/shared/package.json", pj2);
  } else {
    log("OK shared package.json lists avatars.test");
  }
}

// ---- FarmPlayerCard types ----
if (exists("packages/shared/src/types.ts")) {
  let t = read("packages/shared/src/types.ts");
  if (t.includes("export type FarmPlayerCard") && !/export type FarmPlayerCard = \{[\s\S]*?avatarKind/.test(t)) {
    t = t.replace(
      /(export type FarmPlayerCard = \{[\s\S]*?mascot: Mascot;)/,
      "$1\n  avatarKind?: string;\n  avatarPreset?: string | null;\n  avatarUrl?: string | null;",
    );
    write("packages/shared/src/types.ts", t);
  } else {
    log("OK FarmPlayerCard has avatar fields (or missing type)");
  }
}

// ---- game.ts publicPlayer ----
if (exists("apps/api/src/game.ts")) {
  let t = read("apps/api/src/game.ts");
  t = ensureImport(t, 'import { avatarFieldsPublic } from "./avatar.js";', 'avatarFieldsPublic');
  if (!t.includes("avatarKind?:") && t.includes("export function publicPlayer")) {
    t = t.replace(
      /(export function publicPlayer\(player: \{[\s\S]*?mascot: string;)/,
      "$1\n  avatarKind?: string | null;\n  avatarPreset?: string | null;\n  avatarSelfieFile?: string | null;",
    );
  }
  if (!t.includes("...avatarFieldsPublic") && t.includes("mascot: player.mascot,")) {
    t = t.replace(
      "mascot: player.mascot,",
      "mascot: player.mascot,\n    ...avatarFieldsPublic(player),",
    );
  }
  write("apps/api/src/game.ts", t);
}

// ---- farm.ts cards ----
if (exists("apps/api/src/routes/farm.ts")) {
  let t = read("apps/api/src/routes/farm.ts");
  t = ensureImport(t, 'import { avatarFieldsPublic } from "../avatar.js";', "avatarFieldsPublic");
  if (!t.includes("...avatarFieldsPublic(player)")) {
    t = t.replace(
      "mascot: player.mascot,",
      "mascot: player.mascot,\n          ...avatarFieldsPublic(player),",
    );
  }
  write("apps/api/src/routes/farm.ts", t);
}

// ---- profile.ts ----
if (exists("apps/api/src/profile.ts")) {
  let t = read("apps/api/src/profile.ts");
  t = ensureImport(t, 'import { avatarFieldsPublic } from "./avatar.js";', "avatarFieldsPublic");
  if (!t.includes("...avatarFieldsPublic(player)")) {
    t = t.replace(
      /player: \{\s*id: player\.id,\s*name: player\.name,\s*mascot: player\.mascot,\s*garden:/,
      "player: {\n      id: player.id,\n      name: player.name,\n      mascot: player.mascot,\n      ...avatarFieldsPublic(player),\n      garden:",
    );
  }
  write("apps/api/src/profile.ts", t);
}

// ---- player routes: avatar endpoints ----
if (exists("apps/api/src/routes/player.ts")) {
  let t = read("apps/api/src/routes/player.ts");
  t = ensureImport(
    t,
    'import { AVATAR_PRESETS } from "@farmhand/shared";',
    "AVATAR_PRESETS",
  );
  t = ensureImport(
    t,
    'import {\n  avatarSelfieFilePath,\n  decodeAndInspectAvatarImage,\n  isPlayerAvatarSelfieBasename,\n  validateAvatarBody,\n  writeAvatarSelfieJpeg,\n} from "../avatar.js";',
    "validateAvatarBody",
  );

  if (!t.includes('app.get("/api/avatar/presets"')) {
    const insert = `
  app.get("/api/avatar/presets", async () => ({ presets: AVATAR_PRESETS }));

  app.post("/api/avatar", async (request, reply) => {
    const session = await requirePlayer(request, reply);
    if (!session) return;
    try {
      const body = validateAvatarBody(request.body);
      let data;
      if (body.kind === "mascot") {
        data = {
          avatarKind: "mascot",
          avatarPreset: null,
          avatarSelfieFile: null,
        };
      } else if (body.kind === "preset") {
        data = {
          avatarKind: "preset",
          avatarPreset: body.presetId!,
          avatarSelfieFile: null,
        };
      } else {
        const buf = decodeAndInspectAvatarImage(body.image);
        const saved = await writeAvatarSelfieJpeg({ buf, playerId: session.playerId });
        data = {
          avatarKind: "selfie",
          avatarPreset: null,
          avatarSelfieFile: saved.basename,
        };
      }
      const player = await prisma.player.update({
        where: { id: session.playerId },
        data,
        include: { plots: { orderBy: { slot: "asc" } } },
      });
      const config = await loadConfig();
      return { player: publicPlayer(player, config, true) };
    } catch (err) {
      const e = err as Error & { statusCode?: number };
      return reply.code(e.statusCode ?? 400).send({ error: e.message });
    }
  });

  app.get("/api/profile/avatar-selfie/:file", async (request, reply) => {
    const session = await requirePlayer(request, reply);
    if (!session) return;
    const file = decodeURIComponent((request.params as { file: string }).file);
    if (!isPlayerAvatarSelfieBasename(session.playerId, file)) {
      return reply.code(404).send({ error: "That photo isn't here." });
    }
    const full = avatarSelfieFilePath(file);
    try {
      await fsPromises.access(full, fsConstants.R_OK);
    } catch {
      return reply.code(404).send({ error: "That photo isn't here." });
    }
    reply.header("Content-Type", "image/jpeg");
    reply.header("Cache-Control", "private, max-age=120");
    return reply.send(createReadStream(full));
  });
`;
    // Insert before profile selfies route or at end of playerRoutes before closing
    if (t.includes('app.get("/api/profile/selfies/:file"')) {
      t = t.replace('app.get("/api/profile/selfies/:file"', insert + '\n  app.get("/api/profile/selfies/:file"');
    } else if (t.includes('app.get("/api/profile"')) {
      t = t.replace('app.get("/api/profile"', insert + '\n  app.get("/api/profile"');
    } else {
      t = t.replace(/\n\}\s*$/, insert + "\n}\n");
    }
    write("apps/api/src/routes/player.ts", t);
  } else {
    log("OK player avatar routes present");
  }
}

// ---- player api.ts client ----
if (exists("apps/player/src/api.ts")) {
  let t = read("apps/player/src/api.ts");
  if (!t.includes("avatarKind")) {
    t = t.replace(
      /(export type GardenPlayer = \{[\s\S]*?mascot: FarmPlayerCard\["mascot"\];)/,
      "$1\n  avatarKind?: string;\n  avatarPreset?: string | null;\n  avatarUrl?: string | null;",
    );
  }
  if (!t.includes("avatarKind") && t.includes("KidProfile")) {
    t = t.replace(
      /player: \{ id: string; name: string; mascot: GardenPlayer\["mascot"\]; garden: string \}/,
      'player: { id: string; name: string; mascot: GardenPlayer["mascot"]; garden: string; avatarKind?: string; avatarPreset?: string | null; avatarUrl?: string | null }',
    );
  } else if (t.includes("KidProfile") && !/KidProfile = \{[\s\S]*?avatarKind/.test(t)) {
    t = t.replace(
      /player: \{ id: string; name: string; mascot: GardenPlayer\["mascot"\]; garden: string \}/,
      'player: { id: string; name: string; mascot: GardenPlayer["mascot"]; garden: string; avatarKind?: string; avatarPreset?: string | null; avatarUrl?: string | null }',
    );
  }
  if (!t.includes("setAvatar:")) {
    t = t.replace(
      /profile: \(\) => request<KidProfile>\("\/api\/profile"\),?\n\};/,
      `profile: () => request<KidProfile>("/api/profile"),
  setAvatar: (
    body:
      | { kind: "mascot" }
      | { kind: "preset"; presetId: string }
      | { kind: "selfie"; image: string },
  ) =>
    request<{ player: GardenPlayer }>("/api/avatar", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  avatarPresets: () =>
    request<{ presets: Array<{ id: string; emoji: string; label: string }> }>("/api/avatar/presets"),
};
`,
    );
  }
  write("apps/player/src/api.ts", t);
}

// ---- styles.css append ----
if (exists("apps/player/src/styles.css")) {
  let t = read("apps/player/src/styles.css");
  if (!t.includes(".kid-claim-grid")) {
    const fragPath = path.join(path.dirname(new URL(import.meta.url).pathname), "apps/player/src/styles.avatar.css");
    // On Windows pathname may need decode; also support argv dropin sibling
    let frag = "";
    const candidates = [
      fragPath,
      path.join(path.dirname(process.argv[1]), "apps/player/src/styles.avatar.css"),
    ];
    for (const c of candidates) {
      try {
        frag = fs.readFileSync(c, "utf8");
        break;
      } catch {
        /* try next */
      }
    }
    if (frag) {
      if (!t.endsWith("\n")) t += "\n";
      t += frag;
      write("apps/player/src/styles.css", t);
    } else {
      log("WARN styles.avatar.css not found");
    }
  } else {
    log("OK styles already have kid-claim-grid");
  }
}

// ---- jobBoard getCurrentJob (needed by FarmDashboard claim path) ----
if (exists("apps/player/src/pixi/jobBoard.ts")) {
  let t = read("apps/player/src/pixi/jobBoard.ts");
  if (!t.includes("getCurrentJob(")) {
    t = t.replace(
      "debugHit(",
      `/** Chore currently shown on the Wanted flyer (Farm stake tap target). */
  getCurrentJob(): WantedJob | null {
    return this.jobs[this.index] ?? null;
  }

  debugHit(`,
    );
    write("apps/player/src/pixi/jobBoard.ts", t);
  } else {
    log("OK jobBoard has getCurrentJob");
  }
}

// ---- FarmQa card defaults ----
if (exists("apps/player/src/screens/FarmQa.tsx")) {
  let t = read("apps/player/src/screens/FarmQa.tsx");
  if (!t.includes("avatarKind") && t.includes("function card(")) {
    t = t.replace(
      /mascot: "cow",/,
      `mascot: "cow",\n    avatarKind: "mascot",\n    avatarPreset: null,\n    avatarUrl: null,`,
    );
    write("apps/player/src/screens/FarmQa.tsx", t);
  } else {
    log("OK FarmQa or already patched");
  }
}


// ---- Optional skip client fields (idempotent; skip-shard may already have them) ----
if (exists("apps/player/src/api.ts")) {
  let t = read("apps/player/src/api.ts");
  if (
    t.includes("requiresSelfie: boolean;\n  includeInPath") &&
    !t.includes("requiresSelfie: boolean;\n  allowsSkip?: boolean;\n  includeInPath")
  ) {
    t = t.replace(
      "requiresSelfie: boolean;\n  includeInPath",
      "requiresSelfie: boolean;\n  allowsSkip?: boolean;\n  includeInPath",
    );
  }
  if (t.includes("export type FamilyJob") && !/export type FamilyJob = \{[^}]*allowsSkip/s.test(t)) {
    t = t.replace(
      /(export type FamilyJob = \{[^}]*requiresSelfie: boolean;)/,
      "$1\n  allowsSkip?: boolean;",
    );
  }
  if (!t.includes("skipChore:")) {
    t = t.replace(
      /setAvatar:/,
      `skipChore: (id: string) =>
    request<{ player: GardenPlayer; claim: { id: string; status: string } }>(\`/api/chores/\${id}/skip\`, {
      method: "POST",
      body: JSON.stringify({}),
    }),
  setAvatar:`,
    );
  }
  write("apps/player/src/api.ts", t);
}

log("=== patch_api.mjs done ===");
