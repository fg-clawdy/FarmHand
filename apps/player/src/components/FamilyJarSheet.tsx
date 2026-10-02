import {
  GIVE_CHIP_AMOUNTS,
  PUT_BACK_WINDOW_SECONDS,
  SHARED_GOAL_COPY,
  type FarmPlayerCard,
  type PublicSharedGoal,
} from "@farmhand/shared";
import { useEffect, useRef, useState, type RefObject } from "react";
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
}: {
  jar: PublicSharedGoal;
  players: FarmPlayerCard[];
  onClose: () => void;
  onUpdated: (jar: PublicSharedGoal) => void;
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

  if (checking) {
    return (
      <Sheet title={SHARED_GOAL_COPY.farmLabel} onClose={onClose}>
        <p>Opening the jar…</p>
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
      onClose={onClose}
      onUpdated={onUpdated}
      onIdentify={() => setIdentifying(true)}
      onKid={(next) => setKid(next)}
    />
  );
}

function JarGlass({
  ratio,
  ready,
  glassRef,
}: {
  ratio: number;
  ready: boolean;
  glassRef: RefObject<HTMLDivElement>;
}) {
  const clamped = Math.max(0, Math.min(1, ratio));
  return (
    <div className={`jar-glass${ready ? " ready" : ""}`} ref={glassRef} aria-hidden="true">
      <div className="jar-lid" />
      <div className="jar-fill" style={{ height: `${Math.round(clamped * 100)}%` }} />
    </div>
  );
}
function PourBody({
  jar,
  kid,
  onClose,
  onUpdated,
  onIdentify,
  onKid,
}: {
  jar: PublicSharedGoal;
  kid: GardenPlayer | null;
  onClose: () => void;
  onUpdated: (jar: PublicSharedGoal) => void;
  onIdentify: () => void;
  onKid: (kid: GardenPlayer) => void;
}) {
  const glassRef = useRef<HTMLDivElement>(null);
  const [coachOn, setCoachOn] = useState(kid?.familyJarCoach === true);
  const [available, setAvailable] = useState<number | null>(null);
  const [ceiling, setCeiling] = useState<number | null>(typeof kid?.giveCeiling === "number" ? kid.giveCeiling : null);
  const [givingOff, setGivingOff] = useState(kid?.givingEnabled === false);
  const [pending, setPending] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [live, setLive] = useState("");
  const [pour, setPour] = useState<{ amount: number; from: { x: number; y: number }; to: { x: number; y: number } } | null>(null);
  const [shown, setShown] = useState(jar.targetStars > 0 ? jar.filledStars / jar.targetStars : 0);
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
    if (!pour) setShown(jar.targetStars > 0 ? jar.filledStars / jar.targetStars : 0);
  }, [jar.filledStars, jar.targetStars, pour]);

  const ready = jar.status === "READY" || forcedReady;
  const room = Math.max(0, jar.targetStars - jar.filledStars);
  const cap = ceiling ?? Number.POSITIVE_INFINITY;
  const chips =
    kid && !givingOff && !coachOn && !ready && available != null
      ? GIVE_CHIP_AMOUNTS.filter((amount) => amount <= available && amount <= cap && amount <= room)
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
    if (!kid || pending == null || busy) return;
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
      const end = next.targetStars > 0 ? next.filledStars / next.targetStars : 1;
      setShown(end);
      if (!prefersReducedMotion()) {
        const fromEl = document.querySelector<HTMLButtonElement>("[data-pour-origin]");
        const glass = glassRef.current?.getBoundingClientRect();
        const origin = fromEl?.getBoundingClientRect();
        if (glass && origin) {
          setPour({
            amount,
            from: { x: origin.left + origin.width / 2, y: origin.top + origin.height / 2 },
            to: { x: glass.left + glass.width / 2, y: glass.top + glass.height / 2 },
          });
        }
      }
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
      setShown(next.targetStars > 0 ? next.filledStars / next.targetStars : 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not put those stars back.");
      setPutBack(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet title={`${jar.emoji} ${jar.title}`} onClose={onClose} className="family-jar-sheet">
      <JarGlass ratio={shown} ready={ready} glassRef={glassRef} />
      <p aria-live="polite">{ready ? fill(SHARED_GOAL_COPY.ready, { title: jar.title }) : live || prompt}</p>
      {ready && <p>{SHARED_GOAL_COPY.readySubline}</p>}
      {coachOn && jar.status === "OPEN" && (
        <>
          <p>{SHARED_GOAL_COPY.coachLine1}</p>
          <p>{SHARED_GOAL_COPY.coachLine2}</p>
        </>
      )}
      {givingOff && <p>{SHARED_GOAL_COPY.givingOff}</p>}
      {kid && !givingOff && !ready && available === 0 && <p>{SHARED_GOAL_COPY.noStars}</p>}
      {kid && !givingOff && !ready && available != null && available > 0 && <p className="jar-stars">{available}★</p>}
      {!ready && room > 0 && room < GIVE_CHIP_AMOUNTS[GIVE_CHIP_AMOUNTS.length - 1]! && (
        <p>{fill(SHARED_GOAL_COPY.roomLeft, { n: room })}</p>
      )}
      {error && <p className="error">{error}</p>}

      {jar.status === "OPEN" && !kid && !coachOn && (
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

      {!coachOn && !givingOff && !ready && kid && pending == null && chips.length > 0 && !pour && (
        <div className="sheet-actions jar-chips">
          {chips.map((amount) => (
            <button key={amount} className="chip" type="button" disabled={busy} onClick={() => setPending(amount)}>
              {amount}
            </button>
          ))}
        </div>
      )}

      {!coachOn && pending != null && (
        <div className="sheet-actions">
          <p>{fill(SHARED_GOAL_COPY.confirm, { n: pending, title: jar.title })}</p>
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

