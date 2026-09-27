-- Add pointsToWin to club and session settings
ALTER TABLE "ClubSettings" ADD COLUMN "pointsToWin" INTEGER;
ALTER TABLE "SessionSettings" ADD COLUMN "pointsToWin" INTEGER;
