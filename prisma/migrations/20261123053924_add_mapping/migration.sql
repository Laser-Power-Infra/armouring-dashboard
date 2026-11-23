/*
  Warnings:

  - You are about to drop the column `createdAt` on the `md_rules` table. All the data in the column will be lost.
  - You are about to drop the column `givenOn` on the `md_rules` table. All the data in the column will be lost.
  - You are about to drop the column `newRuleId` on the `md_rules` table. All the data in the column will be lost.
  - Added the required column `given_on` to the `md_rules` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "md_rules" DROP CONSTRAINT "md_rules_newRuleId_fkey";

-- AlterTable
ALTER TABLE "md_rules" DROP COLUMN "createdAt",
DROP COLUMN "givenOn",
DROP COLUMN "newRuleId",
ADD COLUMN     "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "given_on" DATE NOT NULL,
ADD COLUMN     "new_rule_id" INTEGER;

-- AddForeignKey
ALTER TABLE "md_rules" ADD CONSTRAINT "md_rules_new_rule_id_fkey" FOREIGN KEY ("new_rule_id") REFERENCES "md_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;
