import { useId } from "react";

export type BadgePatchState = "locked" | "progress" | "complete";

type Theme = { light: string; mid: string; dark: string; ring: string };

/** One thematic color identity per accolade slug, so every badge reads as its own patch. */
const PATCH_THEME: Record<string, Theme> = {
  harvests: { light: "#FFEAB0", mid: "#E8A33D", dark: "#B8721E", ring: "#8a4f14" },
  waterings: { light: "#EAF7FF", mid: "#5AB0E0", dark: "#1F6B96", ring: "#124a68" },
  plantings: { light: "#EFFCE0", mid: "#6DBE55", dark: "#2F7A2A", ring: "#1f5a1c" },
  selfies: { light: "#FFE9F0", mid: "#FF8FA3", dark: "#D94B68", ring: "#9c2f45" },
  crops: { light: "#FFE7C8", mid: "#F0862A", dark: "#B85A12", ring: "#7a3a0c" },
  "active-days": { light: "#FFE3D2", mid: "#F2734E", dark: "#C2431F", ring: "#7f2c13" },
  "first-harvest": { light: "#FFF4C2", mid: "#F0B429", dark: "#C4870F", ring: "#8a5c08" },
  "homestead-helper": { light: "#FBE6D4", mid: "#C97C4A", dark: "#95521F", ring: "#5c3013" },
  "barn-full": { light: "#FBD8D2", mid: "#D23A2A", dark: "#941F14", ring: "#5c110a" },
  "early-bird": { light: "#E3F6FF", mid: "#6FC6E0", dark: "#2E7F9E", ring: "#1c4d5e" },
  "camera-kid": { light: "#F0E6FB", mid: "#9B6FD1", dark: "#6740A0", ring: "#402863" },
};
const FALLBACK_THEME: Theme = { light: "#f2f2f0", mid: "#c9c9c2", dark: "#9a9a92", ring: "#7a7a72" };
const LOCKED_THEME: Theme = { light: "#f4f4f0", mid: "#d8d6cc", dark: "#aaa79a", ring: "#8a8878" };

/**
 * A high-quality "sewn patch" badge: felt-gradient face, chain-stitch outer
 * border, satin inner ring, and the accolade's emoji appliqued in the center.
 * Complete badges get a small embroidered starburst. Locked (0 progress)
 * badges render desaturated so nothing looks earned before it is.
 */
export function BadgePatch({
  slug,
  emoji,
  state,
  size = 64,
  className,
}: {
  slug: string;
  emoji: string;
  state: BadgePatchState;
  size?: number;
  className?: string;
}) {
  const uid = useId().replace(/:/g, "");
  const locked = state === "locked";
  const complete = state === "complete";
  const theme = locked ? LOCKED_THEME : PATCH_THEME[slug] ?? FALLBACK_THEME;
  const stitch = locked ? "#c9c6ba" : "#fffaf0";

  return (
    <svg
      className={[
        "badge-patch",
        complete ? "badge-patch--complete" : "",
        locked ? "badge-patch--locked" : "",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
      viewBox="0 0 100 100"
      width={size}
      height={size}
      role="img"
      aria-hidden
    >
      <defs>
        <radialGradient id={`${uid}-face`} cx="38%" cy="30%" r="75%">
          <stop offset="0%" stopColor={theme.light} />
          <stop offset="55%" stopColor={theme.mid} />
          <stop offset="100%" stopColor={theme.dark} />
        </radialGradient>
      </defs>
      <circle cx="50" cy="51" r="47" fill="rgba(20,10,0,0.16)" />
      <circle cx="50" cy="49" r="46" fill={`url(#${uid}-face)`} stroke={stitch} strokeWidth="3" />
      <circle
        cx="50"
        cy="49"
        r="46"
        fill="none"
        stroke={stitch}
        strokeWidth="2.2"
        strokeDasharray="3.6 3.4"
        opacity="0.9"
      />
      <circle cx="50" cy="49" r="38" fill="none" stroke={theme.ring} strokeWidth="2" opacity="0.55" />
      <text x="50" y="61" textAnchor="middle" fontSize={complete ? 42 : 38} opacity={locked ? 0.4 : 1}>
        {emoji}
      </text>
      {complete && (
        <path
          d="M50 4 54.5 14 65 15 57 22.5 59.5 33 50 27 40.5 33 43 22.5 35 15 45.5 14 Z"
          fill="#FFE56A"
          stroke="#C4870F"
          strokeWidth="1.4"
        />
      )}
    </svg>
  );
}
