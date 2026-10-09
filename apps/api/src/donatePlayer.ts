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

/** Kid-facing error when a PIN kid tries to donate before entering a PIN. */
export const DONATE_PIN_REQUIRED = "Enter your PIN before adding stars.";

/** Same wording as garden enter when the digits are wrong. */
export const DONATE_PIN_REJECTED = "That PIN didn't work. Try again.";

/**
 * `/enter` step. A submitted PIN is always checked, even if this kid already
 * has a garden session. Matching session with no PIN in the body stays a skip
 * so opening the garden again does not re-prompt.
 */
export type PinEnterStep = "verify" | "skip" | "establish";

export function pinEnterStep(opts: {
  existingPlayerId: string | null;
  requestedPlayerId: string;
  hasPin: boolean;
  submittedPin: unknown;
}): PinEnterStep {
  const submitted = typeof opts.submittedPin === "string" && opts.submittedPin.trim().length > 0;
  if (opts.hasPin && submitted) return "verify";
  if (opts.existingPlayerId != null && opts.existingPlayerId === opts.requestedPlayerId) return "skip";
  return "establish";
}

/**
 * PIN gate for a donate. No-PIN kids pass with the session alone.
 * PIN kids need a 4-digit PIN that verifies with the same check as `/enter`.
 * A previous kid's PIN does not carry over: the caller passes only the PIN
 * collected for this kid, and switching kids clears it.
 */
export async function authorizeDonatePin(opts: {
  hasPin: boolean;
  pin: unknown;
  verifyPin: (pin: string) => Promise<boolean>;
}): Promise<{ ok: true } | { ok: false; statusCode: number; error: string }> {
  if (!opts.hasPin) return { ok: true };
  if (typeof opts.pin !== "string" || !/^\d{4}$/.test(opts.pin)) {
    return { ok: false, statusCode: 401, error: DONATE_PIN_REQUIRED };
  }
  const matches = await opts.verifyPin(opts.pin);
  if (!matches) return { ok: false, statusCode: 401, error: DONATE_PIN_REJECTED };
  return { ok: true };
}
