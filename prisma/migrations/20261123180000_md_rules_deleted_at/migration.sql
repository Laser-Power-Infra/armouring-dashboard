-- Deleting a rule only marks it: the row and its wording are kept.
ALTER TABLE "md_rules" ADD COLUMN "deleted_at" TIMESTAMPTZ;
