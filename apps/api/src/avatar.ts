import { promises as fsPromises } from "node:fs";
import path from "node:path";
import { avatarPublicUrl, isAvatarPresetId, type AvatarKind } from "@farmhand/shared";
import { decodeSelfiePayload, inspectJpeg, selfieDropDir } from "./selfie.js";

export { avatarPublicUrl };

export type AvatarPlayerFields = {
  avatarKind?: string | null;
  avatarPreset?: string | null;
  avatarSelfieFile?: string | null;
};

export function avatarFieldsPublic(player: AvatarPlayerFields) {
  const avatarKind = (player.avatarKind as AvatarKind | undefined) ?? "mascot";
  const avatarPreset = player.avatarPreset ?? null;
  const avatarUrl = avatarPublicUrl({
    avatarKind,
    avatarPreset,
    avatarSelfieFile: player.avatarSelfieFile,
  });
  return { avatarKind, avatarPreset, avatarUrl };
}

export function avatarSelfieDir() {
  return path.join(selfieDropDir(), "avatars");
}

export function isPlayerAvatarSelfieBasename(playerId: string, file: string) {
  const base = path.basename(file);
  const needle = `${playerId}-pfp-`;
  return (
    base === file &&
    base.toLowerCase().endsWith(".jpg") &&
    !base.includes("..") &&
    base.startsWith(needle)
  );
}

export function avatarSelfieFilePath(file: string) {
  return path.join(avatarSelfieDir(), path.basename(file));
}

export async function writeAvatarSelfieJpeg(opts: { buf: Buffer; playerId: string }) {
  const dir = avatarSelfieDir();
  await fsPromises.mkdir(dir, { recursive: true });
  const stamp = Date.now();
  const base = `${opts.playerId}-pfp-${stamp}.jpg`;
  const full = path.join(dir, base);
  await fsPromises.writeFile(full, opts.buf);
  return { file: full, basename: base };
}

export function decodeAndInspectAvatarImage(image: unknown) {
  const buf = decodeSelfiePayload(image);
  inspectJpeg(buf);
  return buf;
}

export function validateAvatarBody(body: unknown): {
  kind: AvatarKind;
  presetId?: string;
  image?: string;
} {
  if (!body || typeof body !== "object") {
    throw Object.assign(new Error("Pick a picture style."), { statusCode: 400 });
  }
  const b = body as { kind?: string; presetId?: string; image?: string };
  if (b.kind === "mascot") return { kind: "mascot" };
  if (b.kind === "preset") {
    if (!b.presetId || !isAvatarPresetId(b.presetId)) {
      throw Object.assign(new Error("That avatar isn't available."), { statusCode: 400 });
    }
    return { kind: "preset", presetId: b.presetId };
  }
  if (b.kind === "selfie") {
    if (typeof b.image !== "string" || !b.image.trim()) {
      throw Object.assign(new Error("We need a photo. Try the camera again."), { statusCode: 400 });
    }
    return { kind: "selfie", image: b.image };
  }
  throw Object.assign(new Error("Pick a picture style."), { statusCode: 400 });
}
