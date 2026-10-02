import {
  GIVE_CHIP_AMOUNTS,
  PUT_BACK_WINDOW_SECONDS,
  SHARED_GOAL_COPY,
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
    filledStars: result.filledStars,
    status: result.status,
    targetStars: result.targetStars,
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
  preview?: { availableStars: number; celebrate?: number };
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
        title="Whose stars?"
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
}: {
  jar: PublicSharedGoal;
  solid: number;
  countFilled: number;
  gift: { bottom: number; height: number } | null;
  burst: number | null;
  lens: boolean;
  ready: boolean;
  glassRef: Ref<HTMLDivElement>;
}) {
  const tint = jarTint(jar.tintIndex ?? 0);
  const solidPct = Math.round(Math.max(0, Math.min(1, solid)) * 1000) / 10;
  return (
    <div className="tube-wrap">
      <div className="tube-badge" style={{ borderColor: tint.rim }}>
        {jar.artUrl ? <img src={jar.artUrl} alt="" /> : jar.emoji}
      </div>
      <div
        className={`tube-bore${ready ? " ready" : ""}`}
        ref={glassRef}
        aria-hidden="true"
        data-solid={solidPct}
        data-count={jarProgressLabel(countFilled, jar.targetStars, jar.status)}
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
      <p className="tube-title" style={{ color: tint.rim }}>
        {compactJarTitle(jar.title, 18)}
      </p>
      <p className="tube-count">{jarProgressLabel(countFilled, jar.targetStars, jar.status)}</p>
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
  preview?: { availableStars: number; celebrate?: number };
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
  const [solid, setSolid] = useState(() => tubeFillRatio(jar.filledStars, jar.targetStars));
  const [countFilled, setCountFilled] = useState(jar.filledStars);
  const [gift, setGift] = useState<{ bottom: number; height: number } | null>(null);
  const [burst, setBurst] = useState<number | null>(null);
  const [lens, setLens] = useState(false);
  const [putBack, setPutBack] = useState<{ giveKey: string; until: number } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [forcedReady, setForcedReady] = useState(jar.status === "READY");
  const pouredFrom = useRef(jar.filledStars);

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
        if (!dead) setAvailable(store.availableStars);
      })
      .catch((err: Error) => {
        if (!dead) setError(err.message || "Could not check your stars.");
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
    setSolid(tubeFillRatio(jar.filledStars, jar.targetStars));
    setCountFilled(jar.filledStars);
  }, [jar.id, jar.filledStars, jar.targetStars]);

  function playCelebration(fromFilled: number, toFilled: number, amount: number, origin?: { x: number; y: number }) {
    const from = tubeFillRatio(fromFilled, jar.targetStars);
    const to = tubeFillRatio(toFilled, jar.targetStars);
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
    const toFilled = Math.min(jar.targetStars, jar.filledStars + amount);
    const timer = window.setTimeout(() => playCelebration(jar.filledStars, toFilled, amount), 280);
    return () => window.clearTimeout(timer);
    // Play the QA celebration once when this sheet opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jar.id, preview?.celebrate]);

  const ready = jar.status === "READY" || forcedReady;
  const room = Math.max(0, jar.targetStars - jar.filledStars);
  const cap = ceiling ?? Number.POSITIVE_INFINITY;
  const wallet = preview ? preview.availableStars : available;
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
      const fromFilled = jar.filledStars;
      const toFilled = Math.min(jar.targetStars, fromFilled + amount);
      const originEl = document.querySelector<HTMLButtonElement>("[data-pour-origin]");
      const origin = originEl?.getBoundingClientRect();
      setPending(null);
      playCelebration(
        fromFilled,
        toFilled,
        amount,
        origin ? { x: origin.left + origin.width / 2, y: origin.top + origin.height / 2 } : undefined,
      );
      onUpdated({ ...jar, filledStars: toFilled, status: toFilled >= jar.targetStars ? "READY" : jar.status });
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
      const fromFilled = jar.filledStars;
      const result = await api.giveStars({ goalId: jar.id, amount: pending, requestId });
      const next = applyPour(jar, result);
      const half = jar.targetStars / 2;
      const crossed = pouredFrom.current < half && next.filledStars >= half && next.status === "OPEN";
      pouredFrom.current = next.filledStars;
      onUpdated(next);
      setAvailable(result.availableStars);
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
        next.filledStars,
        amount,
        origin ? { x: origin.left + origin.width / 2, y: origin.top + origin.height / 2 } : undefined,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not add those stars.";
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
      const result = await api.putBackStars({ goalId: jar.id, giveKey: putBack.giveKey });
      const next = applyPour(jar, result);
      pouredFrom.current = next.filledStars;
      onUpdated(next);
      setAvailable(result.availableStars);
      setPutBack(null);
      setForcedReady(next.status === "READY");
      setLive("");
      celebrating.current = false;
      setGift(null);
      setBurst(null);
      setLens(false);
      setSolid(tubeFillRatio(next.filledStars, next.targetStars));
      setCountFilled(next.filledStars);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not put those stars back.");
      setPutBack(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet title={`${jar.emoji} ${jar.title}`} onClose={onClose} className="family-jar-sheet">
      <TubeGlass
        jar={jar}
        solid={solid}
        countFilled={countFilled}
        gift={gift}
        burst={burst}
        lens={lens}
        ready={ready}
        glassRef={glassRef}
      />
      <p aria-live="polite">{ready ? fill(SHARED_GOAL_COPY.ready, { title: jar.title }) : live || prompt}</p>
      {ready && <p>{SHARED_GOAL_COPY.readySubline}</p>}
      {coachOn && jar.status === "OPEN" && (
        <>
          <p>{SHARED_GOAL_COPY.coachLine1}</p>
          <p>{SHARED_GOAL_COPY.coachLine2}</p>
        </>
      )}
      {givingOff && <p>{SHARED_GOAL_COPY.givingOff}</p>}
      {signedIn && !givingOff && !ready && wallet === 0 && <p>{SHARED_GOAL_COPY.noStars}</p>}
      {signedIn && !givingOff && !ready && wallet != null && wallet > 0 && <p className="jar-stars">{wallet}★</p>}
      {!ready && room > 0 && room < GIVE_CHIP_AMOUNTS[GIVE_CHIP_AMOUNTS.length - 1]! && (
        <p>{fill(SHARED_GOAL_COPY.roomLeft, { n: room })}</p>
      )}
      {error && <p className="error">{error}</p>}

      {jar.status === "OPEN" && !kid && !preview && !coachOn && (
        <div className="sheet-actions">
          <button className="btn gold" type="button" onClick={onIdentify}>
            {SHARED_GOAL_COPY.buttonAdd}
          </button>
          <button className="btn ghost" type="button" onClick={onClose}>
            {SHARED_GOAL_COPY.buttonNotNow}
          </button>
        </div>
      )}

      {coachOn && kid && jar.status === "OPEN" && (
        <div className="sheet-actions">
          <button className="btn gold" type="button" disabled={busy} onClick={() => void dismissCoach()}>
            Okay
          </button>
        </div>
      )}

      {!coachOn && !givingOff && !ready && signedIn && pending == null && chips.length > 0 && !pour && !gift && (
        <div className="sheet-actions jar-chips">
          {chips.map((amount) => {
            const math = pourPreview(jar.filledStars, jar.targetStars, amount);
            return (
              <button key={amount} className="chip" type="button" disabled={busy} onClick={() => setPending(amount)}>
                <span>{amount}</span>
                <span className="chip-math">{math.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {!coachOn && pending != null && (
        <div className="sheet-actions">
          <p>{fill(SHARED_GOAL_COPY.confirm, { n: pending, title: jar.title })}</p>
          <p className="tube-math">
            {wallet ?? 0}★ · {pourPreview(jar.filledStars, jar.targetStars, pending).label}
          </p>
          <button className="btn gold" type="button" data-pour-origin disabled={busy} onClick={() => void confirmAdd()}>
            {SHARED_GOAL_COPY.buttonAdd}
          </button>
          <button className="btn ghost" type="button" disabled={busy} onClick={() => setPending(null)}>
            {SHARED_GOAL_COPY.buttonNotNow}
          </button>
        </div>
      )}

      {putBack && putBackLeft > 0 && !pour && (
        <div className="sheet-actions">
          <p>{SHARED_GOAL_COPY.putBack}</p>
          <button className="btn ghost" type="button" disabled={busy} onClick={() => void undo()}>
            {SHARED_GOAL_COPY.buttonPutBack}
          </button>
        </div>
      )}

      {pour && <StarPour points={pour.amount} from={pour.from} to={pour.to} onDone={() => setPour(null)} />}
    </Sheet>
  );
}

