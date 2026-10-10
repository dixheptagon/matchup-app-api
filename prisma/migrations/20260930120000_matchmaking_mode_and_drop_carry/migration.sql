/*
  Warnings:

  - You are about to alter the column `matchMakingMode` on the `ClubSettings` table.
    The values in your data will be updated when the migration is run.
  - You are about to alter the column `matchMakingMode` on the `SessionSettings` table.
    The values in your data will be updated when the migration is run.

*/
-- AlterEnum: remap LOOSE_SOCIAL -> RANDOM, SKILL_STRICT -> SKILL_BASED, CUSTOM -> BALANCED
ALTER TABLE "ClubSettings"
ALTER COLUMN "matchMakingMode" DROP DEFAULT,
ALTER COLUMN "matchMakingMode" TYPE "MatchMakingMode" USING (
  CASE "matchMakingMode"::text
    WHEN 'LOOSE_SOCIAL' THEN 'RANDOM'::"MatchMakingMode"
    WHEN 'SKILL_STRICT' THEN 'SKILL_BASED'::"MatchMakingMode"
    ELSE 'BALANCED'::"MatchMakingMode"
  END),
ALTER COLUMN "matchMakingMode" SET DEFAULT 'BALANCED';

-- AlterEnum
ALTER TABLE "SessionSettings"
ALTER COLUMN "matchMakingMode" DROP DEFAULT,
ALTER COLUMN "matchMakingMode" TYPE "MatchMakingMode" USING (
  CASE "matchMakingMode"::text
    WHEN 'LOOSE_SOCIAL' THEN 'RANDOM'::"MatchMakingMode"
    WHEN 'SKILL_STRICT' THEN 'SKILL_BASED'::"MatchMakingMode"
    ELSE 'BALANCED'::"MatchMakingMode"
  END),
ALTER COLUMN "matchMakingMode" SET DEFAULT 'BALANCED';

-- DropEnum
DROP TYPE "MatchMakingType";

-- Drop unused carry/evaluation settings
ALTER TABLE "ClubSettings" DROP COLUMN "carryBalance";
ALTER TABLE "ClubSettings" DROP COLUMN "carryEvaluation";
ALTER TABLE "SessionSettings" DROP COLUMN "carryBalance";
ALTER TABLE "SessionSettings" DROP COLUMN "carryEvaluation";

-- Drop unused rest counter
ALTER TABLE "SessionPlayer" DROP COLUMN "restCount";