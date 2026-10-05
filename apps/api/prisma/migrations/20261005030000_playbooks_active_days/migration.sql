-- Scheduled playbooks (bundled chore missions with broadcast windows) and
-- per-chore day-of-week restrictions. activeDays is ISO weekday 1=Mon..7=Sun;
-- empty means "every day". WEEKDAYS chores are backfilled to [1..5].
ALTER TABLE "Chore" ADD COLUMN "activeDays" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[];
UPDATE "Chore" SET "activeDays" = ARRAY[1,2,3,4,5] WHERE "recurrence" = 'WEEKDAYS';

-- ChorePlaybook: a named bundle of chores broadcast during a window.
CREATE TABLE "ChorePlaybook" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "windowStart" INTEGER,
    "windowEnd" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChorePlaybook_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ChorePlaybook_slug_key" ON "ChorePlaybook"("slug");

-- ChorePlaybookItem: many-to-many join (a chore may belong to many playbooks).
CREATE TABLE "ChorePlaybookItem" (
    "id" TEXT NOT NULL,
    "playbookId" TEXT NOT NULL,
    "choreId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChorePlaybookItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ChorePlaybookItem_playbookId_choreId_key" ON "ChorePlaybookItem"("playbookId", "choreId");
CREATE INDEX "ChorePlaybookItem_choreId_idx" ON "ChorePlaybookItem"("choreId");

ALTER TABLE "ChorePlaybookItem" ADD CONSTRAINT "ChorePlaybookItem_playbookId_fkey" FOREIGN KEY ("playbookId") REFERENCES "ChorePlaybook"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChorePlaybookItem" ADD CONSTRAINT "ChorePlaybookItem_choreId_fkey" FOREIGN KEY ("choreId") REFERENCES "Chore"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Morning Person seasonal badge counter.
ALTER TABLE "AccoladeCounter" ADD COLUMN "morningPlaybooks" INTEGER NOT NULL DEFAULT 0;
