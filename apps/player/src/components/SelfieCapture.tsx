import { useCallback, useEffect, useRef, useState } from "react";
import { api, type AccoladeUnlock, type GardenPlayer, type HarvestReward } from "../api";
import { assessSelfieCanvas, faceInGuideOnCanvas } from "../selfieQuality";
import Sheet from "./Sheet";

const DEFAULT_COPY =
  "Put your face in the circle. When you see 3, 2, 1 - smile! One selfie unlocks watering for today and gives +1 seed.";

export default function SelfieCapture({
  onClose,
  onSuccess,
  title = "Today's selfie",
  copy = DEFAULT_COPY,
  submit,
  buttonLabel = "Take selfie",
}: {
  onClose: () => void;
  onSuccess: (player: GardenPlayer, reward: HarvestReward | null, unlocks?: AccoladeUnlock[]) => void;
  title?: string;
  copy?: string;
  submit?: (image: string) => Promise<{ player: GardenPlayer; reward?: HarvestReward | null; unlocks?: AccoladeUnlock[] }>;
  buttonLabel?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const snapLock = useRef(false);
  const countRef = useRef(0);
  const goodStreakRef = useRef(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [hint, setHint] = useState("Put your face in the circle");

  useEffect(() => {
    let cancelled = false;
    async function start() {
      if (!window.isSecureContext && location.hostname !== "localhost" && location.hostname !== "127.0.0.1") {
        setError("Ask a grown-up to open FarmHand with https so the camera can turn on.");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 960 } },
        });
        if (cancelled) {
          for (const track of stream.getTracks()) track.stop();
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setReady(true);
      } catch {
        setError("We couldn't turn on the camera. Check the tablet's camera permission and try again.");
      }
    }
    void start();
    return () => {
      cancelled = true;
      for (const track of streamRef.current?.getTracks() ?? []) track.stop();
      streamRef.current = null;
    };
  }, []);

  const frameToCanvas = useCallback((maxW = 480) => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return null;
    const w = video.videoWidth;
    const h = video.videoHeight;
    const scale = w > maxW ? maxW / w : 1;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(w * scale));
    canvas.height = Math.max(1, Math.round(h * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas;
  }, []);

  const snap = useCallback(async () => {
    if (snapLock.current) return;
    const canvas = frameToCanvas(960);
    if (!canvas) return;
    snapLock.current = true;
    setBusy(true);
    setCountdown(null);
    countRef.current = 0;
    goodStreakRef.current = 0;
    setError("");
    setHint("Checking...");
    try {
      const quality = await assessSelfieCanvas(canvas);
      if (!quality.ok) {
        setError(quality.message);
        setHint("Put your face in the circle");
        return;
      }
      const image = canvas.toDataURL("image/jpeg", 0.76);
      if (submit) {
        const data = await submit(image);
        onSuccess(data.player, data.reward ?? null, data.unlocks);
        return;
      }
      const data = await api.submitSelfie(image);
      const reward =
        data.reward.seedsReturned > 0
          ? { points: 0, seedsFromShards: data.reward.seedsReturned, shardsEarned: 0, remainingShards: 0, emoji: "📸", name: "Selfie" }
          : null;
      onSuccess(data.player, reward, data.unlocks);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't work. Try again.");
      setHint("Put your face in the circle");
    } finally {
      snapLock.current = false;
      setBusy(false);
    }
  }, [frameToCanvas, onSuccess, submit]);

  // Keep a stable snap ref so the auto-count effect does not restart mid-countdown
  // when parent re-renders with a new onSuccess identity (that stalled the UI at 3).
  const snapRef = useRef(snap);
  snapRef.current = snap;

  useEffect(() => {
    if (!ready || busy) return;
    let cancelled = false;
    let tickTimer: number | undefined;
    let countTimer: number | undefined;

    const clearCountTimer = () => {
      if (countTimer) window.clearTimeout(countTimer);
      countTimer = undefined;
    };

    const startCount = () => {
      clearCountTimer();
      countRef.current = 3;
      setCountdown(3);
      setHint("Smile!");
      setError("");

      // Once counting, finish 3→2→1→snap without re-gating on face each tick.
      // Brief face-detect flaps were aborting the count and leaving it stuck at 3
      // when the effect remounted with countRef still > 0.
      const step = () => {
        if (cancelled || snapLock.current) return;
        const next = countRef.current - 1;
        if (next <= 0) {
          setCountdown(null);
          countRef.current = 0;
          void snapRef.current();
          return;
        }
        countRef.current = next;
        setCountdown(next);
        countTimer = window.setTimeout(step, 1000);
      };
      countTimer = window.setTimeout(step, 1000);
    };

    const scheduleTick = () => {
      tickTimer = window.setTimeout(runTick, 350);
    };

    const runTick = () => {
      if (cancelled || snapLock.current) return;
      if (countRef.current > 0) {
        scheduleTick();
        return;
      }
      const canvas = frameToCanvas(320);
      if (!canvas) {
        scheduleTick();
        return;
      }
      void faceInGuideOnCanvas(canvas).then((ok) => {
        if (cancelled || snapLock.current || countRef.current > 0) {
          scheduleTick();
          return;
        }
        if (ok) {
          goodStreakRef.current += 1;
          setHint("Hold still...");
          if (goodStreakRef.current >= 2) {
            startCount();
          }
        } else {
          goodStreakRef.current = 0;
          setHint("Put your face in the circle");
        }
        scheduleTick();
      });
    };

    scheduleTick();
    return () => {
      cancelled = true;
      if (tickTimer) window.clearTimeout(tickTimer);
      clearCountTimer();
      // Reset so a remounted effect never inherits a stuck countdown (>0 with no timer).
      countRef.current = 0;
      goodStreakRef.current = 0;
    };
  }, [ready, busy, frameToCanvas]);

  return (
    <Sheet title={title} onClose={onClose}>
      <p className="selfie-copy">{copy}</p>
      <div className={`selfie-frame${countdown !== null ? " counting" : ""}`}>
        <video ref={videoRef} className="selfie-video" playsInline muted autoPlay />
        <div className="selfie-guide" aria-hidden="true" />
        {countdown !== null && (
          <div className="selfie-countdown" aria-live="assertive">
            {countdown}
          </div>
        )}
      </div>
      {!error && <p className="selfie-hint">{hint}</p>}
      {error && <p className="error">{error}</p>}
      <div className={`sheet-actions ${busy ? "busy" : ""}`}>
        <button className="btn primary" type="button" disabled={!ready || busy} onClick={() => void snap()}>
          {busy ? "Checking..." : buttonLabel}
        </button>
        <button className="btn ghost" type="button" onClick={onClose}>
          Not now
        </button>
      </div>
    </Sheet>
  );
}
