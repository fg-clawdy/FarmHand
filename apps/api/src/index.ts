import { prisma } from "./db.js";
import { buildApp } from "./app.js";
import { seedIfEmpty } from "./seed.js";

async function waitForDb() {
  for (let i = 0; i < 40; i += 1) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  throw new Error("Postgres did not become ready in time.");
}

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || "0.0.0.0";

await waitForDb();
await seedIfEmpty();
const app = await buildApp();
await app.listen({ port, host });
