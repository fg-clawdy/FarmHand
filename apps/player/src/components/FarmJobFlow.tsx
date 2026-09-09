import type { FarmPlayerCard, GameConfig } from "@farmhand/shared";
import { useState } from "react";
import { api, type FamilyJob, type GardenPlayer, type PublicChore } from "../api";
import JobBoard, { FamilyJobBoard } from "./JobBoard";
import JobCoach from "./JobCoach";
import SelfieCapture from "./SelfieCapture";
import WhoseKidPicker from "./WhoseKidPicker";

export default function FarmJobFlow({
  players,
  config,
  jobs,
  onClose,
  onClaimed,
}: {
  players: FarmPlayerCard[];
  config: GameConfig;
  jobs: FamilyJob[];
  onClose: () => void;
  onClaimed: (name: string) => void;
}) {
  const [step, setStep] = useState<"coach" | "family" | "identify" | "board" | "photo">("coach");
  const [pendingJobId, setPendingJobId] = useState<string | null>(null);
  const [chores, setChores] = useState<PublicChore[]>([]);
  const [emptySlots, setEmptySlots] = useState<number[]>([]);
  const [kid, setKid] = useState<GardenPlayer | null>(null);
  const [kidConfig, setKidConfig] = useState(config);
  const [busy, setBusy] = useState(false);
  const [photo, setPhoto] = useState<{ chore: PublicChore; slot: number; tier: number } | null>(null);

  async function loadKidBoard(nextConfig?: GameConfig) {
    const data = await api.chores();
    setKid(data.player);
    if (nextConfig) setKidConfig(nextConfig);
    setChores(data.chores);
    setEmptySlots(data.emptySlots);
    setStep("board");
  }

  async function startClaim(job: FamilyJob) {
    setPendingJobId(job.id);
    const session = await api.session();
    if (session.player) {
      await loadKidBoard(session.config);
      return;
    }
    setStep("identify");
  }

  if (step === "coach") {
    return (
      <JobCoach
        title="Do a job"
        copy="Do a job to plant a waiting seed. The corkboard shows chores still open for someone in the family. You'll pick who you are when you claim."
        cta="Do a job to plant a waiting seed"
        cancelLabel="Back to the farm"
        onClose={onClose}
        onContinue={() => setStep("family")}
      />
    );
  }

  if (step === "identify") {
    return (
      <WhoseKidPicker
        title="Whose job?"
        copy="Pick who is claiming this job. The waiting seed is planted in that kid's garden."
        players={players}
        onCancel={() => setStep("family")}
        onIdentified={() => void loadKidBoard(config)}
      />
    );
  }

  if (step === "photo" && photo) {
    return (
      <SelfieCapture
        title="Chore photo"
        copy="Take a photo so a grown-up can check this chore. This is not today's watering selfie."
        buttonLabel="Send photo"
        onClose={() => setStep("board")}
        submit={async (image) => {
          const data = await api.claimChore(photo.chore.id, {
            slot: photo.slot,
            tier: photo.tier,
            image,
          });
          return { player: data.player, unlocks: data.unlocks };
        }}
        onSuccess={(next) => {
          onClaimed(next.name);
          onClose();
        }}
      />
    );
  }

  if (step === "board" && kid) {
    return (
      <JobBoard
        chores={chores}
        emptySlots={emptySlots}
        config={kidConfig}
        busy={busy}
        kidName={kid.name}
        initialChoreId={pendingJobId}
        onClose={onClose}
        onClaim={async (chore, slot, tier) => {
          setBusy(true);
          try {
            const data = await api.claimChore(chore.id, { slot, tier });
            onClaimed(data.player.name);
            onClose();
            return data.player;
          } finally {
            setBusy(false);
          }
        }}
        onNeedPhoto={(chore, slot, tier) => {
          setPhoto({ chore, slot, tier });
          setStep("photo");
        }}
      />
    );
  }

  return <FamilyJobBoard jobs={jobs} onClose={onClose} onPick={(job) => void startClaim(job)} />;
}
