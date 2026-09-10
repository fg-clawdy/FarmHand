import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";

export async function healthRoutes(app: FastifyInstance) {
  const handler = async () => {
    await prisma.$queryRaw`SELECT 1`;
    return { status: "ok", db: "up", time: new Date().toISOString() };
  };
  app.get("/health", handler);
  app.get("/api/health", handler);
}
