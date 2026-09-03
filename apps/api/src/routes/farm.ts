import type { FastifyInstance } from "fastify";
import { serializePlot } from "@farmhand/shared";
import { prisma } from "../db.js";
import { loadConfig, wateringState } from "../game.js";
import { getPlayerSession } from "../auth.js";

export async function farmRoutes(app: FastifyInstance) {
  app.get("/api/farm", async (request) => {
    const config = await loadConfig();
    const session = await getPlayerSession(request);
    const players = await prisma.player.findMany({
      where: { isActive: true },
      include: { plots: { orderBy: { slot: "asc" } } },
      orderBy: { createdAt: "asc" },
    });
    return {
      timezone: config.timezone,
      storeStatus: "coming_soon",
      config,
      players: players.map((player) => {
        const water = wateringState(player, config);
        return {
          id: player.id,
          name: player.name,
          mascot: player.mascot,
          seeds: player.seeds,
          points: player.points,
          fertilizer: player.fertilizer,
          canWater: water.canWater,
          plots: player.plots.map((plot) => serializePlot(plot, config)),
          hasPin: Boolean(player.pinHash),
          unlocked: session?.playerId === player.id,
          isActive: player.isActive,
        };
      }),
    };
  });
}
