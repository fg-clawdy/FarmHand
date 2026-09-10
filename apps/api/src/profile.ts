import { prisma } from "./db.js";
import { playerAccoladeLedger } from "./accolades.js";
import { loadConfig } from "./game.js";
import { listPlayerSelfies } from "./selfie.js";
import { playerWallet, publicWallet } from "./stars.js";
import { playerRewardHistory } from "./store.js";

const ACTIVITY_ACTIONS = ["harvest", "store_approve", "store_redeem", "chore_approve"] as const;

function activityLabel(action: string, details: unknown) {
  const d = (details ?? {}) as { points?: number; title?: string; stars?: number };
  if (action === "harvest") return `Harvested a plant${d.points ? ` · ${d.points}★` : ""}`;
  if (action === "store_approve") return "A grown-up said yes to a reward";
  if (action === "store_redeem") return "Used a reward in real life";
  if (action === "chore_approve") return "A grown-up checked a chore";
  return action;
}

export async function playerProfile(playerId: string) {
  const config = await loadConfig();
  const player = await prisma.player.findUniqueOrThrow({ where: { id: playerId } });
  const [wallet, rewards, accolades, selfies, logs] = await Promise.all([
    playerWallet(playerId),
    playerRewardHistory(playerId),
    playerAccoladeLedger(playerId, config.timezone),
    listPlayerSelfies(playerId),
    prisma.activityLog.findMany({
      where: { playerId, action: { in: [...ACTIVITY_ACTIONS] } },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);
  return {
    player: {
      id: player.id,
      name: player.name,
      mascot: player.mascot,
      garden: `${player.name}'s garden`,
    },
    wallet: publicWallet(wallet),
    pouch: {
      seeds: player.seeds,
      fertilizer: player.fertilizer,
    },
    selfies,
    rewards,
    accolades,
    activity: logs.map((log) => ({
      id: log.id,
      action: log.action,
      label: activityLabel(log.action, log.details),
      at: log.createdAt.toISOString(),
    })),
  };
}
