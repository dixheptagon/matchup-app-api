-- Replace the MatchMakingMode enum with weight-driven presets: the engine now
-- reads balancedTeams and skillBandPriority instead of branching on a mode.
ALTER TABLE "ClubSettings"    ADD COLUMN "skillBandPriority" "PriorityLevel" NOT NULL DEFAULT 'LOW';
ALTER TABLE "SessionSettings" ADD COLUMN "skillBandPriority" "PriorityLevel" NOT NULL DEFAULT 'LOW';

-- Translate legacy modes into the weights they implied, so existing sessions
-- keep behaving the same way. RANDOM ignored skill; SKILL_BASED selected a
-- tight skill band. BALANCED rows keep their stored weights.
UPDATE "ClubSettings"    SET "balancedTeams"='LOW',  "skillBandPriority"='LOW' WHERE "matchMakingMode"='RANDOM';
UPDATE "SessionSettings" SET "balancedTeams"='LOW',  "skillBandPriority"='LOW' WHERE "matchMakingMode"='RANDOM';
UPDATE "ClubSettings"    SET "balancedTeams"='HIGH', "skillBandPriority"='MAX' WHERE "matchMakingMode"='SKILL_BASED';
UPDATE "SessionSettings" SET "balancedTeams"='HIGH', "skillBandPriority"='MAX' WHERE "matchMakingMode"='SKILL_BASED';

ALTER TABLE "ClubSettings"    DROP COLUMN "matchMakingMode";
ALTER TABLE "SessionSettings" DROP COLUMN "matchMakingMode";

DROP TYPE "MatchMakingMode";
