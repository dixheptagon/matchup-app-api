-- Live score for each side, kept on the match so it can be adjusted with a
-- guarded atomic increment while the match is PLAYING. Final results are
-- recorded separately in "MatchResult" when the match is finished.
ALTER TABLE "SessionMatch" ADD COLUMN "scoreTeamA" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "scoreTeamB" INTEGER NOT NULL DEFAULT 0;
