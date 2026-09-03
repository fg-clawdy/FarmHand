import { prisma } from "./db.js";
import { DEFAULT_GAME_CONFIG } from "@farmhand/shared";
import { hashSecret } from "./auth.js";
import type { Mascot } from "@prisma/client";

const DEMO_KIDS: Array<{ name: string; mascot: Mascot; pin: string }> = [
  { name: "Willow", mascot: "cow", pin: "1111" },
  { name: "Finn", mascot: "chicken", pin: "2222" },
  { name: "Sage", mascot: "pig", pin: "3333" },
];

export async function seedIfEmpty() {
  const adminUser = process.env.ADMIN_BOOTSTRAP_USER || "admin";
  const adminPass = process.env.ADMIN_BOOTSTRAP_PASSWORD || "farmhand-dev";

  await prisma.gameConfigRow.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default", data: DEFAULT_GAME_CONFIG as object },
  });

  const adminCount = await prisma.admin.count();
  if (adminCount === 0) {
    await prisma.admin.create({
      data: {
        username: adminUser,
        passwordHash: await hashSecret(adminPass),
      },
    });
    console.log(`Seeded admin user "${adminUser}"`);
  }

  const playerCount = await prisma.player.count();
  if (playerCount === 0) {
    const config = DEFAULT_GAME_CONFIG;
    for (const kid of DEMO_KIDS) {
      await prisma.player.create({
        data: {
          name: kid.name,
          mascot: kid.mascot,
          pinHash: await hashSecret(kid.pin),
          seeds: config.startingSeeds,
          points: config.startingPoints,
          fertilizer: config.startingFertilizer,
          plots: {
            create: Array.from({ length: config.plotCount }, (_, slot) => ({ slot })),
          },
        },
      });
    }
    console.log("Seeded demo kids: Willow/1111, Finn/2222, Sage/3333");
  }
}

if (process.argv[1]?.includes("seed")) {
  seedIfEmpty()
    .then(() => prisma.$disconnect())
    .catch(async (err) => {
      console.error(err);
      await prisma.$disconnect();
      process.exit(1);
    });
}
