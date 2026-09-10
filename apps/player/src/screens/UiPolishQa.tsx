import { DEFAULT_GAME_CONFIG } from "@farmhand/shared";
import { useSearchParams } from "react-router-dom";
import type { AccoladeLedger, GardenPlayer, KidProfile } from "../api";
import { SceneShell } from "../art";
import AccoladePanel from "../components/AccoladePanel";
import IngredientsSheet from "../components/IngredientsSheet";
import ProfileSheet from "../components/ProfileSheet";
import SelfieCapture from "../components/SelfieCapture";

/** Live wood-sheet proofs — fixture data only, no API. */
export default function UiPolishQa() {
  const [params] = useSearchParams();
  const sheet = params.get("sheet") ?? "profile";
  const showError = params.get("error") === "1";
  const noop = () => undefined;

  return (
    <SceneShell dim className="screen ui-polish-qa">
      {sheet === "profile" && <ProfileSheet preview={willowProfile()} skipFetch onClose={noop} />}
      {sheet === "selfie" && (
        <SelfieCapture
          disableCamera
          demoError={
            showError ? "We couldn't turn on the camera. Check the tablet's camera permission and try again." : undefined
          }
          onClose={noop}
          onSuccess={noop}
        />
      )}
      {sheet === "shed" && (
        <IngredientsSheet
          player={willowGarden()}
          config={DEFAULT_GAME_CONFIG}
          busy={false}
          onClaim={noop}
          onMix={noop}
          onClose={noop}
        />
      )}
      {sheet === "badges" && <AccoladePanel ledger={willowBadges()} onClose={noop} />}
    </SceneShell>
  );
}

function willowGarden(): GardenPlayer {
  return {
    id: "willow",
    name: "Willow",
    mascot: "cow",
    seeds: 5,
    points: 101,
    fertilizer: 0,
    ingredients: { moonDew: 1, growGoo: 0, phoenixAsh: 0 },
    claimedIngredientToday: true,
    nextIngredient: { id: "growGoo", name: "Grow Goo", emoji: "🟢" },
    canMix: true,
    hasPin: false,
    isActive: true,
    unlocked: true,
    water: {
      today: "2026-09-09",
      wateringsUsed: 0,
      wateringsLeft: 3,
      cooldownRemainingMs: 0,
      canWater: true,
    },
    plots: [],
  };
}

function willowProfile(): KidProfile {
  const player = willowGarden();
  return {
    player: { id: player.id, name: player.name, mascot: player.mascot, garden: "Willow's garden" },
    wallet: {
      currentStars: 101,
      points: 101,
      heldStars: 0,
      starsHeld: 0,
      availableStars: 101,
      lifetimeEarned: 101,
      lifetimeEarnedHarvest: 101,
      lifetimeEarnedGrant: 0,
      lifetimeEarnedLegacy: 0,
      lifetimeSpent: 0,
      adjustNet: 0,
    },
    pouch: { seeds: 5, fertilizer: 0 },
    selfies: [],
    rewards: { pending: [], owned: [], redeemed: [], denied: [] },
    accolades: willowBadges(),
    activity: [],
  };
}

function track(
  slug: string,
  title: string,
  emoji: string,
  blurb: string,
  count: number,
  remaining: number,
): AccoladeLedger["seasonal"]["tracks"][number] {
  return {
    slug,
    title,
    emoji,
    blurb,
    count,
    medals: [],
    next: { medal: "bronze", at: 10, remaining, done: false },
  };
}

function willowBadges(): AccoladeLedger {
  return {
    timezone: "America/Chicago",
    seasonKey: "2026-q3",
    seasonLabel: "Jul–Sep 2026",
    seasonal: {
      counters: { harvests: 4 },
      tracks: [
        track("harvests", "Harvester", "🌽", "Pick ripe plants. Bronze at 10, silver at 50, gold at 100 this season.", 4, 6),
        track("waterings", "Rain Maker", "💧", "Water growing plants. Bronze at 10, silver at 50, gold at 100 this season.", 0, 10),
        track(
          "plantings",
          "Green Thumb",
          "🌱",
          "Confirmed plants (pouch plant or a grown-up OK on a waiting seed). Not grey waiting plants.",
          0,
          10,
        ),
        track("selfies", "Smile Season", "📸", "First watering selfie of a Chicago day. Bronze at 10 days, silver at 50, gold at 100.", 0, 10),
      ],
      unlocks: [],
    },
    lifetime: {
      counters: {},
      legends: [
        {
          slug: "first-harvest",
          title: "First Harvest",
          emoji: "🥇",
          blurb: "Pick your first ripe plant.",
          count: 0,
          at: 1,
          earned: false,
          remaining: 1,
        },
      ],
      unlocks: [],
    },
  };
}
