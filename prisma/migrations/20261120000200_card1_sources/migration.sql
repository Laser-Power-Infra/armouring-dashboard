-- Card 1 built in the app (docs/final guide for card 1.md, section 3). Source tables are replaced whole on every sync.
-- The guide's Lot / Order / OrderLine are kgp_* here: lots and order_lines already belong to the Armouring 5 dashboard.
CREATE TABLE "sync_runs" (
    "id" SERIAL NOT NULL,
    "source" TEXT NOT NULL,
    "tab" TEXT NOT NULL,
    "at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rows" INTEGER NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "s8_pulled_at" TEXT,
    CONSTRAINT "sync_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "kgp_lots" (
    "lot_no" TEXT NOT NULL,
    "run_order" INTEGER NOT NULL,
    "approved_by_md" BOOLEAN NOT NULL,
    CONSTRAINT "kgp_lots_pkey" PRIMARY KEY ("lot_no")
);

CREATE TABLE "kgp_orders" (
    "prod_order" TEXT NOT NULL,
    "mc_no" TEXT,
    "party" TEXT,
    "cable" TEXT,
    "size_sqmm" DOUBLE PRECISION,
    "cores" DOUBLE PRECISION,
    "insulation" TEXT,
    "lot_no" TEXT,
    "run_order_in_lot" INTEGER,
    "supply_from" TEXT,
    CONSTRAINT "kgp_orders_pkey" PRIMARY KEY ("prod_order")
);

CREATE TABLE "kgp_order_lines" (
    "id" SERIAL NOT NULL,
    "prod_order" TEXT NOT NULL,
    "fg_type" TEXT,
    "stage" TEXT NOT NULL,
    "sfg_code" TEXT NOT NULL,
    "sfg_item" TEXT NOT NULL,
    "net_qty" DOUBLE PRECISION NOT NULL,
    "done_qty" DOUBLE PRECISION NOT NULL,
    "balance" DOUBLE PRECISION NOT NULL,
    "scope" TEXT,
    "sfg_bom" TEXT,
    CONSTRAINT "kgp_order_lines_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "kgp_order_lines_prod_order_stage_sfg_code_key" ON "kgp_order_lines"("prod_order", "stage", "sfg_code");

CREATE TABLE "bom_lines" (
    "id" SERIAL NOT NULL,
    "sfg_bom" TEXT NOT NULL,
    "line_no" DOUBLE PRECISION NOT NULL,
    "material_code" TEXT NOT NULL,
    "material" TEXT NOT NULL,
    "kg_per_km" DOUBLE PRECISION NOT NULL,
    CONSTRAINT "bom_lines_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "bom_lines_sfg_bom_line_no_key" ON "bom_lines"("sfg_bom", "line_no");

CREATE TABLE "rm_stock" (
    "item_code" TEXT NOT NULL,
    "item" TEXT NOT NULL,
    "qty_for_planning" DOUBLE PRECISION NOT NULL,
    CONSTRAINT "rm_stock_pkey" PRIMARY KEY ("item_code")
);

CREATE TABLE "machine_men" (
    "machine" TEXT NOT NULL,
    "men_per_shift" INTEGER,
    "must_run_daily" BOOLEAN NOT NULL,
    CONSTRAINT "machine_men_pkey" PRIMARY KEY ("machine")
);

-- An issue built in the app carries the time of the SFG pull it was built from, and what it could not plan.
ALTER TABLE "card_issues" ADD COLUMN "s8_pulled_at" TEXT;
ALTER TABLE "card_issues" ADD COLUMN "not_planned" TEXT[] DEFAULT ARRAY[]::TEXT[];
