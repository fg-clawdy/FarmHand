/** Kid profile picture presets (shared API + player). */
export type AvatarKind = "mascot" | "preset" | "selfie";

export type AvatarPreset = {
  id: string;
  emoji: string;
  label: string;
};

export const AVATAR_PRESETS: readonly AvatarPreset[] = [
  { id: "sun", emoji: "☀️", label: "Sunny" },
  { id: "seedling", emoji: "🌱", label: "Seedling" },
  { id: "star", emoji: "⭐", label: "Star" },
  { id: "rainbow", emoji: "🌈", label: "Rainbow" },
  { id: "tractor", emoji: "🚜", label: "Tractor" },
  { id: "dog", emoji: "🐶", label: "Pup" },
] as const;

export const AVATAR_PRESET_IDS = AVATAR_PRESETS.map((p) => p.id);

export function isAvatarPresetId(id: string): boolean {
  return AVATAR_PRESET_IDS.includes(id);
}

export function avatarPresetById(id: string): AvatarPreset | undefined {
  return AVATAR_PRESETS.find((p) => p.id === id);
}

/** Public URL for a player's avatar, or null when using mascot art. */
export function avatarPublicUrl(player: {
  avatarKind?: string | null;
  avatarPreset?: string | null;
  avatarSelfieFile?: string | null;
}): string | null {
  const kind = player.avatarKind ?? "mascot";
  if (kind === "preset" && player.avatarPreset && isAvatarPresetId(player.avatarPreset)) {
    return `/avatars/${player.avatarPreset}.svg`;
  }
  if (kind === "selfie" && player.avatarSelfieFile) {
    const base = player.avatarSelfieFile.replace(/^.*[/\\]/, "");
    if (!base || base.includes("..")) return null;
    return `/api/profile/avatar-selfie/${encodeURIComponent(base)}`;
  }
  return null;
}
