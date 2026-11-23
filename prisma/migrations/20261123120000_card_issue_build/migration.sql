-- Cards 2, 3 and 4 built in the app: what the issue replaces, its note, the review mark, and why a card could not be built.
ALTER TABLE "card_issues"
  ADD COLUMN "prev_issue_id" INTEGER,
  ADD COLUMN "issue_note" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "review" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "roster_name" TEXT,
  ADD COLUMN "labour_problem" TEXT,
  ADD COLUMN "drum_problem" TEXT;
