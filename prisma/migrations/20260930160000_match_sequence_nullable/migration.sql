-- Matches that have not started yet carry no play-order sequence; the number is
-- allocated when the match starts playing.
ALTER TABLE "SessionMatch" ALTER COLUMN "sequence" DROP NOT NULL;