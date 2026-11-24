-- Club & Run decisions (plan of 23-Nov, Parts 3 and 4). Additive only: nothing dropped or changed.
ALTER TABLE "kgp_orders"
  ADD COLUMN "on_hold" BOOLEAN NOT NULL DEFAULT false,      -- MD: "Rok do"
  ADD COLUMN "urgent" BOOLEAN NOT NULL DEFAULT false,       -- MD: urgent, may join a running lot (CR-G-40)
  ADD COLUMN "customer_date" DATE,                          -- delivery date promised to the customer
  ADD COLUMN "promised_on" DATE,                            -- FG ready date the dashboard gave when the MD decided
  ADD COLUMN "added_at" TIMESTAMPTZ;                        -- when the sync added the order (null: from the sheet)

-- Daily snapshot of each order's expected FG ready date, to show how far it moved since the day before.
CREATE TABLE "club_eta" (
    "day" DATE NOT NULL,
    "prod_order" TEXT NOT NULL,
    "fg_ready" DATE,
    "estimated" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "club_eta_pkey" PRIMARY KEY ("day", "prod_order")
);
