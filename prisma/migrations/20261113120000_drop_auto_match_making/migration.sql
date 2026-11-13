-- Drop unused auto-matchmaking on/off flag; auto-matchmaking is triggered on
-- request, so the setting no longer has meaning at either level.
ALTER TABLE "ClubSettings" DROP COLUMN "autoMatchMaking";
ALTER TABLE "SessionSettings" DROP COLUMN "autoMatchMaking";
