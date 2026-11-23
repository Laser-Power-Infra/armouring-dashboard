-- Scheduled card builds: a hash of what each issue was built from, so an unchanged run stores no new revision.
ALTER TABLE "card_issues" ADD COLUMN "fingerprint" TEXT;
