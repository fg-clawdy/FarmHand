import {
  GIVE_CHIP_AMOUNTS,
  MAX_GIVE_CHIP,
  PUT_BACK_WINDOW_SECONDS,
  SHARED_GOAL_COPY,
  CURRENCY_DISPLAY,
  formatPoints,
  formatPointsNoun,
  compactJarTitle,
  giftGhostBand,
  jarProgressLabel,
  jarTint,
  pourPreview,
  tubeFillRatio,
  type FarmPlayerCard,
  type PublicSharedGoal,
} from "@farmhand/shared";
import { useEffect, useRef, useState, type Ref } from "react";
import { api, type GardenPlayer, type SharedGoalPour } from "../api";
import Sheet from "./Sheet";
import StarPour from "./StarPour";
import WhoseKidPicker from "./WhoseKidPicker";

function fill(template: string, vars: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? ""));
}

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function ceilingFrom(message: string) {
  const match = message.match(/up to (\d+)/i);
  return match ? Number(match[1]) : null;
}

function applyPour(jar: PublicSharedGoal, result: SharedGoalPour): PublicSharedGoal {
  return {
    ...jar,
    filledPoints: result.filledPoints,
    status: result.status,
    targetPoints: result.targetPoints,
  };
}

export default function FamilyJarSheet({
  jar,
  players,
  onClose,
  onUpdated,
  preview,
}: {
  jar: PublicSharedGoal;
  players: FarmPlayerCard[];
  onClose: () => void;
  onUpdated: (jar: PublicSharedGoal) => void;
  /** QA only. Skips the session call and can play the pour celebration locally. */
  preview?: { availablePoints: number; celebrate?: number };
}) {
  const [kid, setKid] = useState<GardenPlayer | null>(null);
  const [checking, setChecking] = useState(true);
  const [identifying, setIdentifying] = useState(false);

  useEffect(() => {
    let dead = false;
    api
      .session()
      .then((session) => {
        if (!dead && session.player) setKid(session.player);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!dead) setChecking(false);
      });
    return () => {
      dead = true;
    };
  }, []);

  if (!preview && checking) {
    return (
      <Sheet title={SHARED_GOAL_COPY.farmLabel} onClose={onClose}>
        <p>Opening…</p>
      </Sheet>
    );
  }

  if (identifying) {
    return (
      <WhoseKidPicker
        title={`Whose ${CURRENCY_DISPLAY.noun}?`}
        copy={fill(SHARED_GOAL_COPY.sheetPrompt, { title: jar.title })}
        players={players}
        onCancel={() => setIdentifying(false)}
        onIdentified={(player) => {
          setKid(player);
          setIdentifying(false);
        }}
      />
    );
  }

  return (
    <PourBody
      jar={jar}
      kid={kid}
      preview={preview}
      onClose={onClose}
      onUpdated={onUpdated}
      onIdentify={() => setIdentifying(true)}
      onKid={(next) => setKid(next)}
    />
  );
}

function TubeGlass({
  jar,
  solid,
  countFilled,
  gift,
  burst,
  lens,
  ready,
  glassRef,
  hero = false,
}: {
  jar: PublicSharedGoal;
  solid: number;
  countFilled: number;
  gift: { bottom: number; height: number } | null;
  burst: number | null;
  lens: boolean;
  ready: boolean;
  glassRef: Ref<HTMLDivElement>;
  hero?: boolean;
}) {
  const tint = jarTint(jar.tintIndex ?? 0);
  const solidPct = Math.round(Math.max(0, Math.min(1, solid)) * 1000) / 10;
  return (
    <div className={hero ? "tube-wrap hero" : "tube-wrap"}>
      <div className="tube-badge" style={{ borderColor: tint.rim }}>
        {jar.artUrl ? <img src={jar.artUrl} alt="" /> : jar.emoji}
      </div>
      <div
        className={`tube-bore${ready ? " ready" : ""}`}
        ref={glassRef}
        aria-hidden="true"
        data-solid={solidPct}
        data-count={jarProgressLabel(countFilled, jar.targetPoints, jar.status)}
        style={{ background: tint.glass, borderColor: tint.rim }}
      >
        <div className="tube-fill" style={{ height: `${solidPct}%`, background: tint.fill }}>
          <span className="tube-stars">★</span>
        </div>
        {gift && gift.height > 0.004 && (
          <div
            className="tube-ghost"
            data-gift="1"
            style={{ bottom: `${gift.bottom * 100}%`, height: `${gift.height * 100}%` }}
          />
        )}
        {lens && <div className="tube-lens" style={{ bottom: `${solidPct}%` }} />}
        {burst != null && burst > 0 && <div className="tube-burst">+{burst}</div>}
      </div>
      {!hero && (
        <>
          <p className="tube-title" style={{ color: tint.rim }}>
            {compactJarTitle(jar.title, 18)}
          </p>
          <p className="tube-count">{jarProgressLabel(countFilled, jar.targetPoints, jar.status)}</p>
        </>
      )}
    </div>
  );
}
function PourBody({
  jar,
  kid,
  preview,
  onClose,
  onUpdated,
  onIdentify,
  onKid,
}: {
  jar: PublicSharedGoal;
  kid: GardenPlayer | null;
  preview?: { availablePoints: number; celebrate?: number };
  onClose: () => void;
  onUpdated: (jar: PublicSharedGoal) => void;
  onIdentify: () => void;
  onKid: (kid: GardenPlayer) => void;
}) {
  const glassRef = useRef<HTMLDivElement>(null);
  const celebrating = useRef(false);
  const [coachOn, setCoachOn] = useState(kid?.familyJarCoach === true);
  const [available, setAvailable] = useState<number | null>(null);
  const [ceiling, setCeiling] = useState<number | null>(typeof kid?.giveCeiling === "number" ? kid.giveCeiling : null);
  const [givingOff, setGivingOff] = useState(kid?.givingEnabled === false);
  const [pending, setPending] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [live, setLive] = useState("");
  const [pour, setPour] = useState<{ amount: number; from: { x: number; y: number }; to: { x: number; y: number } } | null>(null);
  const [solid, setSolid] = useState(() => tubeFillRatio(jar.filledPoints, jar.targetPoints));
  const [countFilled, setCountFilled] = useState(jar.filledPoints);
  const [gift, setGift] = useState<{ bottom: number; height: number } | null>(null);
  const [burst, setBurst] = useState<number | null>(null);
  const [lens, setLens] = useState(false);
  const [putBack, setPutBack] = useState<{ giveKey: string; until: number } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [forcedReady, setForcedReady] = useState(jar.status === "READY");
  const pouredFrom = useRef(jar.filledPoints);

  useEffect(() => {
    setCoachOn(kid?.familyJarCoach === true);
    setGivingOff(kid?.givingEnabled === false);
    setCeiling(typeof kid?.giveCeiling === "number" ? kid.giveCeiling : null);
    setAvailable(null);
    setPending(null);
    setError("");
  }, [kid?.id, kid?.familyJarCoach, kid?.givingEnabled, kid?.giveCeiling]);

  useEffect(() => {
    if (!kid || givingOff || coachOn || jar.status !== "OPEN") return;
    let dead = false;
    api
      .store()
      .then((store) => {
        if (!dead) setAvailable(store.availablePoints);
      })
      .catch((err: Error) => {
        if (!dead) setError(err.message || `Could not check your ${CURRENCY_DISPLAY.noun}.`);
      });
    return () => {
      dead = true;
    };
  }, [kid, givingOff, coachOn, jar.status]);

  useEffect(() => {
    if (!putBack) return;
    const left = putBack.until - Date.now();
    if (left <= 0) {
      setPutBack(null);
      return;
    }
    const t = window.setTimeout(() => setNow(Date.now()), Math.min(left, 250));
    return () => window.clearTimeout(t);
  }, [putBack, now]);

  useEffect(() => {
    if (celebrating.current) return;
    setSolid(tubeFillRatio(jar.filledPoints, jar.targetPoints));
    setCountFilled(jar.filledPoints);
  }, [jar.id, jar.filledPoints, jar.targetPoints]);

  function playCelebration(fromFilled: number, toFilled: number, amount: number, origin?: { x: number; y: number }) {
    const from = tubeFillRatio(fromFilled, jar.targetPoints);
    const to = tubeFillRatio(toFilled, jar.targetPoints);
    const band = giftGhostBand(from, to);
    celebrating.current = true;
    setCountFilled(toFilled);
    setSolid(from);
    if (prefersReducedMotion() || amount <= 0) {
      setSolid(band.solid);
      setGift(null);
      setBurst(null);
      setLens(false);
      celebrating.current = false;
      return;
    }
    setGift({ bottom: band.bottom, height: band.height });
    setBurst(amount);
    setLens(true);
    window.setTimeout(() => setSolid(band.solid), 40);
    const glass = glassRef.current?.getBoundingClientRect();
    if (glass) {
      const meniscus = glass.top + glass.height * (1 - band.solid);
      setPour({
        amount,
        from: origin ?? { x: glass.left + glass.width / 2, y: glass.bottom + 72 },
        to: { x: glass.left + glass.width / 2, y: meniscus },
      });
    }
    window.setTimeout(() => {
      celebrating.current = false;
      setGift(null);
      setBurst(null);
      setLens(false);
      setSolid(band.solid);
    }, 1200);
  }

  useEffect(() => {
    if (!preview?.celebrate || preview.celebrate <= 0) return;
    const amount = preview.celebrate;
    const toFilled = Math.min(jar.targetPoints, jar.filledPoints + amount);
    const timer = window.setTimeout(() => playCelebration(jar.filledPoints, toFilled, amount), 280);
    return () => window.clearTimeout(timer);
    // Play the QA celebration once when this sheet opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jar.id, preview?.celebrate]);

  const ready = jar.status === "READY" || forcedReady;
  const room = Math.max(0, jar.targetPoints - jar.filledPoints);
  const cap = ceiling ?? Number.POSITIVE_INFINITY;
  const wallet = preview ? preview.availablePoints : available;
  const signedIn = Boolean(kid) || Boolean(preview);
  const chips =
    signedIn && !givingOff && !coachOn && !ready && wallet != null
      ? GIVE_CHIP_AMOUNTS.filter((amount) => amount <= wallet && amount <= cap && amount <= room)
      : [];
  const putBackLeft = putBack ? putBack.until - now : 0;
  const prompt = fill(SHARED_GOAL_COPY.sheetPrompt, { title: jar.title });

  async function dismissCoach() {
    setBusy(true);
    try {
      await api.markFamilyJarCoach();
      if (kid) onKid({ ...kid, familyJarCoach: false });
      setCoachOn(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save that.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmAdd() {
    if (pending == null || busy) return;
    if (preview && !kid) {
      const amount = pending;
      const fromFilled = jar.filledPoints;
      const toFilled = Math.min(jar.targetPoints, fromFilled + amount);
      const originEl = document.querySelector<HTMLButtonElement>("[data-pour-origin]");
      const origin = originEl?.getBoundingClientRect();
      setPending(null);
      playCelebration(
        fromFilled,
        toFilled,
        amount,
        origin ? { x: origin.left + origin.width / 2, y: origin.top + origin.height / 2 } : undefined,
      );
      onUpdated({ ...jar, filledPoints: toFilled, status: toFilled >= jar.targetPoints ? "READY" : jar.status });
      return;
    }
    if (!kid) return;
    setBusy(true);
    setError("");
    const requestId = crypto.randomUUID();
    try {
      const session = await api.session();
      if (!session.player || session.player.id !== kid.id) {
        setPending(null);
        onIdentify();
        return;
      }
      const fromFilled = jar.filledPoints;
      const result = await api.givePoints({ goalId: jar.id, amount: pending, requestId });
      const next = applyPour(jar, result);
      const half = jar.targetPoints / 2;
      const crossed = pouredFrom.current < half && next.filledPoints >= half && next.status === "OPEN";
      pouredFrom.current = next.filledPoints;
      onUpdated(next);
      setAvailable(result.availablePoints);
      setPending(null);
      const amount = result.amount ?? pending;
      const giveKey = result.giveKey ?? `give:${jar.id}:${kid.id}:${requestId}`;
      setPutBack({ giveKey, until: Date.now() + PUT_BACK_WINDOW_SECONDS * 1000 });
      if (next.status === "READY") setForcedReady(true);
      const readyLine = next.status === "READY" ? ` ${fill(SHARED_GOAL_COPY.ready, { title: jar.title })}` : "";
      setLive(`${crossed ? fill(SHARED_GOAL_COPY.halfway, { title: jar.title }) : SHARED_GOAL_COPY.afterPour}${readyLine}`);
      const fromEl = document.querySelector<HTMLButtonElement>("[data-pour-origin]");
      const origin = fromEl?.getBoundingClientRect();
      playCelebration(
        fromFilled,
        next.filledPoints,
        amount,
        origin ? { x: origin.left + origin.width / 2, y: origin.top + origin.height / 2 } : undefined,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : `Could not add those ${CURRENCY_DISPLAY.noun}.`;
      if (message.toLowerCase().includes("watch the jar")) setGivingOff(true);
      const parsed = ceilingFrom(message);
      if (parsed != null) setCeiling(parsed);
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  async function undo() {
    if (!putBack || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await api.putBackPoints({ goalId: jar.id, giveKey: putBack.giveKey });
      const next = applyPour(jar, result);
      pouredFrom.current = next.filledPoints;
      onUpdated(next);
      setAvailable(result.availablePoints);
      setPutBack(null);
      setForcedReady(next.status === "READY");
      setLive("");
      celebrating.current = false;
      setGift(null);
      setBurst(null);
      setLens(false);
      setSolid(tubeFillRatio(next.filledPoints, next.targetPoints));
      setCountFilled(next.filledPoints);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Could not put those ${CURRENCY_DISPLAY.noun} back.`);
      setPutBack(null);
    } finally {
      setBusy(false);
    }
  }

  const previewMath = pending != null ? pourPreview(jar.filledPoints, jar.targetPoints, pending) : null;
  const spent = previewMath ? previewMath.toFilled - previewMath.fromFilled : 0;
  const nextWallet = wallet != null ? Math.max(0, wallet - spent) : null;

  return (
    <Sheet title={jar.title} onClose={onClose} className="family-jar-sheet tube-hero-sheet">
      <div className="tube-hero">
        <div className="tube-hero-stage">
          <TubeGlass
            jar={jar}
            solid={solid}
            countFilled={countFilled}
            gift={gift}
            burst={burst}
            lens={lens}
            ready={ready}
            glassRef={glassRef}
            hero
          />
          <p className="tube-hero-count">
            <strong>{countFilled.toLocaleString()}</strong>
            <span> / {formatPointsNoun(jar.targetPoints)}</span>
          </p>
        </div>
        <div className="tube-hero-side">
          <p className="sr-only" aria-live="polite">
            {ready ? fill(SHARED_GOAL_COPY.ready, { title: jar.title }) : live || prompt}
          </p>
          {ready && <p>{fill(SHARED_GOAL_COPY.ready, { title: jar.title })} {SHARED_GOAL_COPY.readySubline}</p>}
          {coachOn && jar.status === "OPEN" && (
            <>
              <p>{SHARED_GOAL_COPY.coachLine1}</p>
              <p>{SHARED_GOAL_COPY.coachLine2}</p>
            </>
          )}
          {givingOff && <p>{SHARED_GOAL_COPY.givingOff}</p>}
          {signedIn && !givingOff && !ready && wallet != null && wallet < GIVE_CHIP_AMOUNTS[0] && (
            <p>{SHARED_GOAL_COPY.noStars}</p>
          )}
          {signedIn && !givingOff && wallet != null && (
            <div className="tube-wallet">
              <span className="tube-wallet-star" aria-hidden="true">
                ★
              </span>
              <span className="tube-wallet-amt">{wallet.toLocaleString()}</span>
              <span className="tube-wallet-label">Kid Wallet</span>
            </div>
          )}
          {!ready && room > 0 && room < MAX_GIVE_CHIP && (
            <p>{fill(SHARED_GOAL_COPY.roomLeft, { n: room })}</p>
          )}
          {error && <p className="error">{error}</p>}

          {!coachOn && !givingOff && !ready && signedIn && chips.length > 0 && !pour && !gift && (
            <div className="tube-chip-stack">
              <p className="tube-chip-label">{SHARED_GOAL_COPY.pickAmount}</p>
              <div className="tube-chip-grid" role="group" aria-label={SHARED_GOAL_COPY.pickAmount}>
                {chips.map((amount) => (
                  <button
                    key={amount}
                    className={`tube-chip tone-${amount}${amount === MAX_GIVE_CHIP ? " chip-max" : ""}${pending === amount ? " is-on" : ""}`}
                    type="button"
                    disabled={busy}
                    onClick={() => setPending(amount)}
                  >
                    +{amount} <span className="tube-chip-star" aria-hidden="true">★</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {previewMath && nextWallet != null && wallet != null && !pour && !gift && (
            <div className="tube-preview-card">
              <div className="tube-preview-row">
                <span className="tube-preview-k">{SHARED_GOAL_COPY.farmLabel}</span>
                <span className="tube-preview-v">
                  {previewMath.fromFilled.toLocaleString()} <span aria-hidden="true">→</span>{" "}
                  <strong>{previewMath.toFilled.toLocaleString()}</strong> / {jar.targetPoints.toLocaleString()}
                </span>
              </div>
              <div className="tube-preview-bar" aria-hidden="true">
                <div
                  className="tube-preview-fill"
                  style={{
                    width: `${Math.round(tubeFillRatio(previewMath.toFilled, jar.targetPoints) * 1000) / 10}%`,
                  }}
                />
              </div>
              <div className="tube-preview-row">
                <span className="tube-preview-k">Kid Wallet</span>
                <span className="tube-preview-v">
                  {formatPoints(wallet)} <span aria-hidden="true">→</span>{" "}
                  <strong>{formatPoints(nextWallet)}</strong>
                </span>
              </div>
            </div>
          )}

          {jar.status === "OPEN" && !kid && !preview && !coachOn && (
            <button className="btn gold tube-add" type="button" onClick={onIdentify}>
              {SHARED_GOAL_COPY.buttonAdd}
            </button>
          )}
          {coachOn && kid && jar.status === "OPEN" && (
            <button className="btn gold tube-add" type="button" disabled={busy} onClick={() => void dismissCoach()}>
              Okay
            </button>
          )}
          {!coachOn && !givingOff && !ready && signedIn && !pour && !gift && (
            <button
              className="btn gold tube-add"
              type="button"
              data-pour-origin
              disabled={busy || pending == null}
              onClick={() => void confirmAdd()}
            >
              {SHARED_GOAL_COPY.buttonAdd}
            </button>
          )}
          <button className="btn tube-dismiss" type="button" disabled={busy} onClick={onClose}>
            {SHARED_GOAL_COPY.buttonNotNow}
          </button>

          {putBack && putBackLeft > 0 && !pour && (
            <>
              <p>{SHARED_GOAL_COPY.putBack}</p>
              <button className="btn ghost" type="button" disabled={busy} onClick={() => void undo()}>
                {SHARED_GOAL_COPY.buttonPutBack}
              </button>
            </>
          )}
        </div>
      </div>
      {pour && <StarPour points={pour.amount} from={pour.from} to={pour.to} onDone={() => setPour(null)} />}
    </Sheet>
  );
}

