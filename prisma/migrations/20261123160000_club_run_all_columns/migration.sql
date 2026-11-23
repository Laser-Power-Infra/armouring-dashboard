-- Club & Run: store every column of the Lots and Orders tabs, not only the ones Card 1 plans from.
ALTER TABLE "kgp_lots"
  ADD COLUMN "what_clubbed" TEXT,
  ADD COLUMN "created" DATE,
  ADD COLUMN "orders" INTEGER,
  ADD COLUMN "balance_km" DOUBLE PRECISION,
  ADD COLUMN "conductor_pending_core_km" DOUBLE PRECISION,
  ADD COLUMN "insulation_pending_core_km" DOUBLE PRECISION,
  ADD COLUMN "sent_to_plant" BOOLEAN,
  ADD COLUMN "status" TEXT,
  ADD COLUMN "remarks" TEXT;

ALTER TABLE "kgp_orders"
  ADD COLUMN "armour" TEXT,
  ADD COLUMN "order_date" DATE,
  ADD COLUMN "approved" TEXT,
  ADD COLUMN "conductor_bal_core_km" DOUBLE PRECISION,
  ADD COLUMN "insulation_bal_core_km" DOUBLE PRECISION,
  ADD COLUMN "laying_bal_km" DOUBLE PRECISION,
  ADD COLUMN "inner_bal_km" DOUBLE PRECISION,
  ADD COLUMN "armouring_bal_km" DOUBLE PRECISION,
  ADD COLUMN "finish_bal_km" DOUBLE PRECISION,
  ADD COLUMN "pending_from" TEXT,
  ADD COLUMN "remarks" TEXT,
  ADD COLUMN "suggested_lot" TEXT;
