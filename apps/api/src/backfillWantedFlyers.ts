import { prisma } from "./db.js";
import { generateWantedFlyer } from "./wantedFlyer.js";

async function main() {
  const chores = await prisma.chore.findMany({ orderBy: { sortOrder: "asc" } });
  let ok = 0;
  for (const chore of chores) {
    await generateWantedFlyer({
      slug: chore.slug,
      title: chore.title,
      emoji: chore.emoji,
      rewardLabel: "+1 SEED",
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
