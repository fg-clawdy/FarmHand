import { useEffect, useRef, useState } from "react";
import { api, type GardenPlayer, type HarvestReward } from "../api";
import { assessSelfieCanvas } from "../selfieQuality";
import Sheet from "./Sheet";

export default function SelfieCapture({
  onClose,
  onSuccess,
  title = "Today's selfie",
  copy = "Put your face in the middle. One selfie unlocks watering for the rest of today and gives +1 seed.",
  submit,
  buttonLabel = "Take selfie",
}: {
  onClose: () => void;
  onSuccess: (player: GardenPlayer, reward: HarvestReward | null) => void;
  title?: string;
  copy?: string;
  submit?: (image: string) => Promise<{ player: GardenPlayer; reward?: HarvestReward | null }>;
  buttonLabel?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

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

  async function snap() {
    const video = videoRef.current;
    if (!video || busy) return;
    setBusy(true);
    setError("");
    try {
      const w = video.videoWidth || 960;
      const h = video.videoHeight || 720;
      const maxW = 960;
      const scale = w > maxW ? maxW / w : 1;
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("The camera hiccuped. Try again.");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const quality = await assessSelfieCanvas(canvas);
      if (!quality.ok) {
        setError(quality.message);
        return;
      }
      const image = canvas.toDataURL("image/jpeg", 0.76);
      if (submit) {
        const data = await submit(image);
        onSuccess(data.player, data.reward ?? null);
        return;
      }
      const data = await api.submitSelfie(image);
      const reward =
        data.reward.seedsReturned > 0
          ? { points: 0, seedsReturned: data.reward.seedsReturned, emoji: "📸", name: "Selfie" }
          : null;
      onSuccess(data.player, reward);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't work. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet title={title} onClose={onClose}>
      <p className="selfie-copy">{copy}</p>
      <div className="selfie-frame">
        <video ref={videoRef} className="selfie-video" playsInline muted autoPlay />
        <div className="selfie-guide" aria-hidden="true" />
      </div>
      {error && <p className="error">{error}</p>}
      <div className={`sheet-actions ${busy ? "busy" : ""}`}>
        <button className="btn primary" type="button" disabled={!ready || busy} onClick={() => void snap()}>
          {busy ? "Checking…" : buttonLabel}
        </button>
        <button className="btn ghost" type="button" onClick={onClose}>
          Not now
        </button>
      </div>
    </Sheet>
  );
}
