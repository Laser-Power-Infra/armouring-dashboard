-- Drum size source update of 24-Nov-26: FG drums come from the RAW MATERIALS REQUIREMENT sheet, matched by drum code.
ALTER TABLE "kgp_order_lines"
  ADD COLUMN "fg_item_code" TEXT,   -- S8 Order lines N
  ADD COLUMN "contract_no" TEXT;    -- S8 Order lines Q

CREATE TABLE "raccoon_drums" (
    "prod_order" TEXT NOT NULL,
    "contract_no" TEXT NOT NULL,
    "drum_code" TEXT NOT NULL,
    "drum_size" TEXT NOT NULL,
    "drum_km" DOUBLE PRECISION NOT NULL,
    CONSTRAINT "raccoon_drums_pkey" PRIMARY KEY ("prod_order")
);

ALTER TABLE "card_drum_need" ADD COLUMN "drum_code" TEXT;
ALTER TABLE "card_drum_assembly" ADD COLUMN "drum_code" TEXT;
-- Older issues keep their size keys in this column; the cards fall back to the size key when a row has no drum code.
ALTER TABLE "card_drum_stock" RENAME COLUMN "size_key" TO "drum_code";
