-- The sheet's version text has no year ("17-Nov R2 plan"), so it comes back every year.
-- An issue is one version text for one day 0.
DROP INDEX "card_issues_version_key";
CREATE UNIQUE INDEX "card_issues_version_d0_key" ON "card_issues"("version", "d0");
