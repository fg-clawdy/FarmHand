import { avatarPresetById, type AvatarKind, type Mascot } from "@farmhand/shared";
import { MascotArt } from "../art";

export type KidAvatarProps = {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  name?: string;
  mascot: Mascot;
  avatarKind?: AvatarKind | string | null;
  avatarPreset?: string | null;
  avatarUrl?: string | null;
  /** Decorative only when nested in a labeled button. */
  decorative?: boolean;
};

const SIZE_CLASS: Record<NonNullable<KidAvatarProps["size"]>, string> = {
  sm: "kid-avatar--sm",
  md: "kid-avatar--md",
  lg: "kid-avatar--lg",
  xl: "kid-avatar--xl",
};

export default function KidAvatar({
  className = "",
  size = "md",
  name = "",
  mascot,
  avatarKind,
  avatarPreset,
  avatarUrl,
  decorative = false,
}: KidAvatarProps) {
  const kind = (avatarKind as AvatarKind | undefined) ?? "mascot";
  const label = name ? `${name}'s picture` : "Profile picture";
  const classes = ["kid-avatar", SIZE_CLASS[size], className].filter(Boolean).join(" ");

  if (avatarUrl && (kind === "preset" || kind === "selfie")) {
    return (
      <span className={classes} role={decorative ? undefined : "img"} aria-label={decorative ? undefined : label} aria-hidden={decorative || undefined}>
        <img src={avatarUrl} alt="" draggable={false} />
      </span>
    );
  }

  if (kind === "preset" && avatarPreset) {
    const preset = avatarPresetById(avatarPreset);
    if (preset) {
      return (
        <span
          className={`${classes} kid-avatar--emoji`}
          role={decorative ? undefined : "img"}
          aria-label={decorative ? undefined : label}
          aria-hidden={decorative || undefined}
        >
          <span className="kid-avatar-emoji" aria-hidden>
            {preset.emoji}
          </span>
        </span>
      );
    }
  }

  return (
    <span className={`${classes} kid-avatar--mascot`} role={decorative ? undefined : "img"} aria-label={decorative ? undefined : label} aria-hidden={decorative || undefined}>
      <MascotArt className="kid-avatar-mascot" mascot={mascot} />
    </span>
  );
}
