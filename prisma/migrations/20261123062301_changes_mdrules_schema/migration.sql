-- AlterTable
ALTER TABLE "md_rules" ADD COLUMN     "code" TEXT,
ADD COLUMN     "details" JSONB;

-- CreateIndex
CREATE INDEX "md_rules_code_idx" ON "md_rules"("code");
