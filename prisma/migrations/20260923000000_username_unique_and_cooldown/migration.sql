-- Normalize existing usernames: lowercase and strip all whitespace
UPDATE "User"
SET "username" = lower(regexp_replace("username", '\s+', '', 'g'))
WHERE "username" IS NOT NULL;

-- Track when the username was last changed (for the change cooldown)
ALTER TABLE "User" ADD COLUMN "usernameChangedAt" TIMESTAMP(3);

-- Enforce username uniqueness
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
