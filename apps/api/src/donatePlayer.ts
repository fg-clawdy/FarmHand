/** Kid-facing error when a donate call omits the donor. */
export const DONATE_PLAYER_REQUIRED = "Pick who is adding stars.";

/** Kid-facing error when the named donor is not the signed-in session. */
export const DONATE_PLAYER_MISMATCH = "Sign in as that kid before adding stars.";

/**
 * The donate body must name a player. A garden session cookie is not a donor:
 * callers must not substitute `session.playerId`, the first child, or any other default.
 */
export function explicitDonatePlayerId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** True only when the body names the same kid the spend session already authorized. */
export function donatePlayerMatchesSession(explicitPlayerId: string, sessionPlayerId: string): boolean {
  return explicitPlayerId === sessionPlayerId;
}
