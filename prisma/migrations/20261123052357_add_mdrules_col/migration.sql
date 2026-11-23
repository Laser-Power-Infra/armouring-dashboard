-- CreateTable
CREATE TABLE "md_rules" (
    "id" SERIAL NOT NULL,
    "topic" TEXT NOT NULL,
    "rule" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "givenOn" DATE NOT NULL,
    "newRuleId" INTEGER,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "md_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "md_rules_topic_idx" ON "md_rules"("topic");

-- AddForeignKey
ALTER TABLE "md_rules" ADD CONSTRAINT "md_rules_newRuleId_fkey" FOREIGN KEY ("newRuleId") REFERENCES "md_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;
