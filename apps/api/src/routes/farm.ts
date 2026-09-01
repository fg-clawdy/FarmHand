import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";
import { loadConfig } from "../game.js";
import { getPlayerSession } from "../auth.js";

export async function farmRoutes(app: FastifyInstance) {
  app.get("/api/farm", async (request) => {
    const config = await loadConfig();
    const session = await getPlayerSession(request);
    const players = await prisma.player.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "asc" },
    });
    return {
      timezone: config.timezone,
      storeStatus: "coming_soon",
      config,
      players: players.map((player) => ({
        id: player.id,
        name: player.name,
        mascot: player.mascot,
        seeds: player.seeds,
        points: player.points,
        hasPin: Boolean(player.pinHash),
        unlocked: session?.playerId === player.id,
        isActive: player.isActive,
      })),
    };
  });
}
