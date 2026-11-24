-- Club & Run moves from the Google Sheet into the dashboard (plan of 23-Nov, Part 1).

-- Every change to a lot or an order: who, when, old value, new value.
CREATE TABLE "club_changes" (
    "id" BIGSERIAL NOT NULL,
    "at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "by" TEXT NOT NULL,
    "tbl" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "old_value" TEXT,
    "new_value" TEXT,
    CONSTRAINT "club_changes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "club_changes_tbl_check" CHECK ("tbl" IN ('lot', 'order'))
);
CREATE INDEX "club_changes_tbl_key_idx" ON "club_changes"("tbl", "key");

-- SFG figures that differ a lot from ours: kept here until the MD accepts them. {"finishBalKm": 6.2, ...}
ALTER TABLE "kgp_orders" ADD COLUMN "to_confirm" JSONB;

-- Plant users may only tick "Sent to plant".
ALTER TABLE "users" DROP CONSTRAINT "users_role_check";
ALTER TABLE "users" ADD CONSTRAINT "users_role_check" CHECK ("role" IN ('viewer', 'plant', 'admin'));
