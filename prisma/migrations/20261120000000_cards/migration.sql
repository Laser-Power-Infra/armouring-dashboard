-- KGP cards: every issue is kept; one data table per card (docs/KGP_4_Cards_Build_Spec.md).
-- CreateTable
CREATE TABLE "card_issues" (
    "id" SERIAL NOT NULL,
    "version" TEXT NOT NULL,
    "issue_date" DATE NOT NULL,
    "rev" INTEGER NOT NULL,
    "d0" DATE NOT NULL,
    "loaded_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "card_issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_plan" (
    "id" SERIAL NOT NULL,
    "issue_id" INTEGER NOT NULL,
    "row_no" INTEGER NOT NULL,
    "day" DATE NOT NULL,
    "process" TEXT NOT NULL,
    "machine" TEXT NOT NULL,
    "prod_order" TEXT NOT NULL,
    "mc" TEXT NOT NULL,
    "party_cable" TEXT NOT NULL,
    "lot" TEXT NOT NULL,
    "qty" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "size_core" TEXT NOT NULL,
    "material" TEXT NOT NULL,
    "feed" TEXT NOT NULL,
    "feed_status" TEXT NOT NULL,
    "job" TEXT NOT NULL,

    CONSTRAINT "card_plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_labour" (
    "id" SERIAL NOT NULL,
    "issue_id" INTEGER NOT NULL,
    "row_no" INTEGER NOT NULL,
    "day" DATE NOT NULL,
    "shift" TEXT NOT NULL,
    "machine" TEXT NOT NULL,
    "operator" TEXT,
    "helpers" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "men_needed" INTEGER NOT NULL,
    "men_given" INTEGER NOT NULL,
    "note" TEXT,

    CONSTRAINT "card_labour_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_spare_men" (
    "issue_id" INTEGER NOT NULL,
    "day" DATE NOT NULL,
    "shift" TEXT NOT NULL,
    "men" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "card_spare_men_pkey" PRIMARY KEY ("issue_id","day","shift")
);

-- CreateTable
CREATE TABLE "card_drum_need" (
    "id" SERIAL NOT NULL,
    "issue_id" INTEGER NOT NULL,
    "row_no" INTEGER NOT NULL,
    "used_on" DATE NOT NULL,
    "ready_by" DATE NOT NULL,
    "late" BOOLEAN NOT NULL DEFAULT false,
    "drum_size" TEXT NOT NULL,
    "drums_needed" INTEGER NOT NULL,
    "from_stock" INTEGER NOT NULL,
    "to_assemble" INTEGER NOT NULL,
    "prod_order" TEXT NOT NULL,
    "party_cable" TEXT NOT NULL,
    "lot" TEXT NOT NULL,
    "note" TEXT,

    CONSTRAINT "card_drum_need_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_drum_assembly" (
    "id" SERIAL NOT NULL,
    "issue_id" INTEGER NOT NULL,
    "row_no" INTEGER NOT NULL,
    "assemble_by" DATE NOT NULL,
    "was" DATE,
    "drum_size" TEXT NOT NULL,
    "drums" INTEGER NOT NULL,
    "flanges_needed" INTEGER NOT NULL,
    "flanges_from" TEXT NOT NULL,
    "prod_order" TEXT NOT NULL,
    "party_cable" TEXT NOT NULL,
    "lot" TEXT NOT NULL,
    "used_on" DATE NOT NULL,

    CONSTRAINT "card_drum_assembly_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_drum_stock" (
    "issue_id" INTEGER NOT NULL,
    "size_key" TEXT NOT NULL,
    "drum_size" TEXT NOT NULL,
    "drums" INTEGER,
    "flanges_kgp" INTEGER,
    "flanges_pp" INTEGER,

    CONSTRAINT "card_drum_stock_pkey" PRIMARY KEY ("issue_id","size_key")
);

-- CreateIndex
CREATE UNIQUE INDEX "card_issues_version_key" ON "card_issues"("version");

-- CreateIndex
CREATE UNIQUE INDEX "card_issues_issue_date_rev_key" ON "card_issues"("issue_date", "rev");

-- CreateIndex
CREATE INDEX "card_plan_issue_id_row_no_idx" ON "card_plan"("issue_id", "row_no");

-- CreateIndex
CREATE INDEX "card_labour_issue_id_row_no_idx" ON "card_labour"("issue_id", "row_no");

-- CreateIndex
CREATE INDEX "card_drum_need_issue_id_row_no_idx" ON "card_drum_need"("issue_id", "row_no");

-- CreateIndex
CREATE INDEX "card_drum_assembly_issue_id_row_no_idx" ON "card_drum_assembly"("issue_id", "row_no");

-- AddForeignKey
ALTER TABLE "card_plan" ADD CONSTRAINT "card_plan_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "card_issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_labour" ADD CONSTRAINT "card_labour_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "card_issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_spare_men" ADD CONSTRAINT "card_spare_men_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "card_issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_drum_need" ADD CONSTRAINT "card_drum_need_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "card_issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_drum_assembly" ADD CONSTRAINT "card_drum_assembly_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "card_issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_drum_stock" ADD CONSTRAINT "card_drum_stock_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "card_issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Allowed values (no enums in this schema)
ALTER TABLE "card_plan" ADD CONSTRAINT "card_plan_feed_status_check" CHECK ("feed_status" IN ('ok', 'drum', 'wait'));
ALTER TABLE "card_labour" ADD CONSTRAINT "card_labour_shift_check" CHECK ("shift" IN ('Day', 'Night'));
ALTER TABLE "card_spare_men" ADD CONSTRAINT "card_spare_men_shift_check" CHECK ("shift" IN ('Day', 'Night'));
