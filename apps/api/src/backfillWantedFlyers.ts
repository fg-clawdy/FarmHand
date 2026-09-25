import { formatWantedSeedLabel, resolveSeedReward } from "@farmhand/shared";
import { prisma } from "./db.js";
import { loadConfig } from "./game.js";
import { generateWantedFlyer } from "./wantedFlyer.js";

async function main() {
  const [chores, config] = await Promise.all([
    prisma.chore.findMany({ orderBy: { sortOrder: "asc" } }),
    loadConfig(),
  ]);
  let ok = 0;
  for (const chore of chores) {
    await generateWantedFlyer({
      slug: chore.slug,
      title: chore.title,
      emoji: chore.emoji,
      rewardLabel: formatWantedSeedLabel(resolveSeedReward(chore, config)),
    });
    ok += 1;
    console.log(`flyer ${chore.slug}`);
  }
  console.log(`Backfilled ${ok} Wanted flyers.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
