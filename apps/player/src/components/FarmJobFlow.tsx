import type { FarmPlayerCard } from "@farmhand/shared";
import { useState } from "react";
import { api, type FamilyJob, type GardenPlayer, type PublicChore } from "../api";
import JobBoard, { FamilyJobBoard } from "./JobBoard";
import JobCoach from "./JobCoach";
import SelfieCapture from "./SelfieCapture";
import WhoseKidPicker from "./WhoseKidPicker";

export default function FarmJobFlow({
  players,
  jobs,
  onClose,
  onClaimed,
}: {
  players: FarmPlayerCard[];
  jobs: FamilyJob[];
  onClose: () => void;
  onClaimed: (name: string) => void;
}) {
  const [step, setStep] = useState<"coach" | "family" | "identify" | "board" | "photo">("coach");
  const [pendingJobId, setPendingJobId] = useState<string | null>(null);
  const [chores, setChores] = useState<PublicChore[]>([]);
  const [kid, setKid] = useState<GardenPlayer | null>(null);
  const [busy, setBusy] = useState(false);
  const [photo, setPhoto] = useState<{ chore: PublicChore } | null>(null);

  async function loadKidBoard() {
    const data = await api.chores();
    setKid(data.player);
    setChores(data.chores);
    setStep("board");
  }

  async function startClaim(job: FamilyJob) {
    setPendingJobId(job.id);
    const session = await api.session();
    if (session.player) {
      await loadKidBoard();
      return;
    }
    setStep("identify");
  }

  if (step === "coach") {
    return (
      <JobCoach
        title="Do a job"
        copy="Do a job to earn seeds for your bag. The corkboard shows chores still open for someone in the family. You'll pick who you are when you claim."
        cta="Do a job for seeds"
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
        copy="Pick who is claiming this job. Seeds go into that kid's bag."
        players={players}
        onCancel={() => setStep("family")}
        onIdentified={() => void loadKidBoard()}
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
          const data = await api.claimChore(photo.chore.id, { image });
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
        busy={busy}
        kidName={kid.name}
        initialChoreId={pendingJobId}
        onClose={onClose}
        onClaim={async (chore) => {
          setBusy(true);
          try {
            const data = await api.claimChore(chore.id);
            onClaimed(data.player.name);
            onClose();
            return data.player;
          } finally {
            setBusy(false);
          }
        }}
        onSkip={async (chore) => {
          const data = await api.skipChore(chore.id);
          if (data.chores) setChores(data.chores);
          setKid(data.player);
          return data.player;
        }}
        onNeedPhoto={(chore) => {
          setPhoto({ chore });
          setStep("photo");
        }}
      />
    );
  }

  return <FamilyJobBoard jobs={jobs} onClose={onClose} onPick={(job) => void startClaim(job)} />;
}
