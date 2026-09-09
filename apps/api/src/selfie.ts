import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export const SELFIE_MAX_BYTES = 6 * 1024 * 1024;
export const SELFIE_MIN_BYTES = 800;
export const SELFIE_MIN_EDGE = 64;

export function selfieDropDir() {
  return process.env.SELFIE_DROP_DIR || path.resolve("data/selfies");
}

export function decodeSelfiePayload(raw: unknown): Buffer {
  if (Buffer.isBuffer(raw)) return raw;
  if (typeof raw !== "string" || !raw.trim()) {
    throw Object.assign(new Error("We need a photo. Try the camera again."), { statusCode: 400 });
  }
  const trimmed = raw.trim();
  const comma = trimmed.indexOf(",");
  const b64 = trimmed.startsWith("data:") && comma >= 0 ? trimmed.slice(comma + 1) : trimmed;
  try {
    return Buffer.from(b64, "base64");
  } catch {
    throw Object.assign(new Error("That photo didn't look right. Try again."), { statusCode: 400 });
  }
}

/** Walk JPEG markers for SOF0/SOF2 width and height. */
export function inspectJpeg(buf: Buffer): { width: number; height: number } {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) {
    throw Object.assign(new Error("That photo didn't look right. Try again."), { statusCode: 400 });
  }
  if (buf.length < SELFIE_MIN_BYTES || buf.length > SELFIE_MAX_BYTES) {
    throw Object.assign(new Error("Hold the tablet a little steadier and try again."), { statusCode: 400 });
  }
  let i = 2;
  while (i < buf.length - 8) {
    if (buf[i] !== 0xff) {
      i += 1;
      continue;
    }
    const marker = buf[i + 1];
    if (marker === 0xd8 || marker === 0xd9) {
      i += 2;
      continue;
    }
    if (marker === 0x00 || marker === 0xff) {
      i += 1;
      continue;
    }
    const size = buf.readUInt16BE(i + 2);
    if (size < 2) break;
    const sof = marker === 0xc0 || marker === 0xc1 || marker === 0xc2;
    if (sof && i + 8 < buf.length) {
      const height = buf.readUInt16BE(i + 5);
      const width = buf.readUInt16BE(i + 7);
      if (width < SELFIE_MIN_EDGE || height < SELFIE_MIN_EDGE) {
        throw Object.assign(new Error("Scoot back so we can see your whole face."), { statusCode: 400 });
      }
      return { width, height };
    }
    i += 2 + size;
  }
  throw Object.assign(new Error("That photo didn't look right. Try again."), { statusCode: 400 });
}

export function planSelfieReward(
  player: { selfieUnlockDate?: string | null; selfieSeedGrantDate?: string | null },
  today: string,
) {
  const alreadyUnlocked = player.selfieUnlockDate === today;
  const grantSeed = player.selfieSeedGrantDate !== today;
  return { alreadyUnlocked, grantSeed };
}

function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 32) || "kid";
}

export async function writeSelfieJpeg(opts: {
  buf: Buffer;
  playerId: string;
  playerName: string;
  today: string;
}) {
  const dir = selfieDropDir();
  await mkdir(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const file = path.join(dir, `${opts.today}_${safeName(opts.playerName)}_${opts.playerId.slice(0, 8)}_${stamp}.jpg`);
  await writeFile(file, opts.buf);
  return file;
}

/** Chore proof photos share the Immich-watched drop dir; they do not unlock watering. */
export async function writeClaimJpeg(opts: {
  buf: Buffer;
  playerName: string;
  choreSlug: string;
  claimId: string;
}) {
  const dir = path.join(selfieDropDir(), "chores");
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, `${opts.choreSlug}_${safeName(opts.playerName)}_${opts.claimId.slice(0, 8)}.jpg`);
  await writeFile(file, opts.buf);
  return file;
}
