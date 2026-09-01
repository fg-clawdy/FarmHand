import Fastify from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import { healthRoutes } from "./routes/health.js";
import { farmRoutes } from "./routes/farm.js";
import { playerRoutes } from "./routes/player.js";
import { adminRoutes } from "./routes/admin.js";

export async function buildApp() {
  const app = Fastify({ logger: true });
  await app.register(cookie);
  await app.register(cors, {
    origin: true,
    credentials: true,
  });
  await app.register(healthRoutes);
  await app.register(farmRoutes);
  await app.register(playerRoutes);
  await app.register(adminRoutes);
  return app;
}
