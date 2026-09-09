import type { FastifyInstance } from "fastify";
import { serializePlot } from "@farmhand/shared";
import { prisma } from "../db.js";
import { ensurePlots, loadConfig, selfieUnlockedOn, syncAllPlayerPlots } from "../game.js";
import { getPlayerSession } from "../auth.js";

export async function farmRoutes(app: FastifyInstance) {
  app.get("/api/farm", async (request) => {
    const config = await loadConfig();
    await syncAllPlayerPlots(config.plotCount);
    const session = await getPlayerSession(request);
    const players = await prisma.player.findMany({
      where: { isActive: true },
      include: { plots: { orderBy: { slot: "asc" } } },
      orderBy: { createdAt: "asc" },
    });
    return {
      timezone: config.timezone,
      storeStatus: "open",
      config,
      players: players.map((player) => {
        return {
          id: player.id,
          name: player.name,
          mascot: player.mascot,
          seeds: player.seeds,
          points: player.points,
          fertilizer: player.fertilizer,
          canWater: selfieUnlockedOn(player.selfieUnlockDate, config.timezone),
          plots: ensurePlots(player.plots, config.plotCount).map((plot) => serializePlot(plot, config)),
          hasPin: Boolean(player.pinHash),
          unlocked: session?.playerId === player.id,
          isActive: player.isActive,
        };
      }),
    };
  });
}
