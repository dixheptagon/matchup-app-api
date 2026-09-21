/*
  Warnings:

  - The primary key for the `ClubMember` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `SessionMatch` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `SportClub` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `SportSession` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `User` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - A unique constraint covering the columns `[provider,providerAccountId]` on the table `AuthAccount` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[hashedToken]` on the table `RefreshSession` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "AuthAccount" DROP CONSTRAINT "AuthAccount_userId_fkey";

-- DropForeignKey
ALTER TABLE "ClubMember" DROP CONSTRAINT "ClubMember_clubId_fkey";

-- DropForeignKey
ALTER TABLE "ClubMember" DROP CONSTRAINT "ClubMember_createdBySessionId_fkey";

-- DropForeignKey
ALTER TABLE "ClubMember" DROP CONSTRAINT "ClubMember_userId_fkey";

-- DropForeignKey
ALTER TABLE "ClubSettings" DROP CONSTRAINT "ClubSettings_clubId_fkey";

-- DropForeignKey
ALTER TABLE "Court" DROP CONSTRAINT "Court_clubId_fkey";

-- DropForeignKey
ALTER TABLE "MatchPlayer" DROP CONSTRAINT "MatchPlayer_matchId_fkey";

-- DropForeignKey
ALTER TABLE "MatchResult" DROP CONSTRAINT "MatchResult_matchId_fkey";

-- DropForeignKey
ALTER TABLE "MatchResult" DROP CONSTRAINT "MatchResult_submittedByAdminId_fkey";

-- DropForeignKey
ALTER TABLE "RefreshSession" DROP CONSTRAINT "RefreshSession_userId_fkey";

-- DropForeignKey
ALTER TABLE "SessionCourt" DROP CONSTRAINT "SessionCourt_sessionId_fkey";

-- DropForeignKey
ALTER TABLE "SessionMatch" DROP CONSTRAINT "SessionMatch_sessionId_fkey";

-- DropForeignKey
ALTER TABLE "SessionPlayer" DROP CONSTRAINT "SessionPlayer_clubMemberId_fkey";

-- DropForeignKey
ALTER TABLE "SessionPlayer" DROP CONSTRAINT "SessionPlayer_sessionId_fkey";

-- DropForeignKey
ALTER TABLE "SessionPlayerStat" DROP CONSTRAINT "SessionPlayerStat_sessionId_fkey";

-- DropForeignKey
ALTER TABLE "SessionSettings" DROP CONSTRAINT "SessionSettings_sessionId_fkey";

-- DropForeignKey
ALTER TABLE "SportClub" DROP CONSTRAINT "SportClub_ownerId_fkey";

-- DropForeignKey
ALTER TABLE "SportSession" DROP CONSTRAINT "SportSession_clubId_fkey";

-- AlterTable
ALTER TABLE "AuthAccount" ALTER COLUMN "userId" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "ClubMember" DROP CONSTRAINT "ClubMember_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "clubId" SET DATA TYPE TEXT,
ALTER COLUMN "userId" SET DATA TYPE TEXT,
ALTER COLUMN "createdBySessionId" SET DATA TYPE TEXT,
ADD CONSTRAINT "ClubMember_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "ClubMember_id_seq";

-- AlterTable
ALTER TABLE "ClubSettings" ALTER COLUMN "clubId" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "Court" ALTER COLUMN "clubId" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "MatchPlayer" ALTER COLUMN "matchId" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "MatchResult" ALTER COLUMN "matchId" SET DATA TYPE TEXT,
ALTER COLUMN "submittedByAdminId" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "RefreshSession" ALTER COLUMN "userId" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "SessionCourt" ALTER COLUMN "sessionId" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "SessionMatch" DROP CONSTRAINT "SessionMatch_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "sessionId" SET DATA TYPE TEXT,
ADD CONSTRAINT "SessionMatch_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "SessionMatch_id_seq";

-- AlterTable
ALTER TABLE "SessionPlayer" ALTER COLUMN "sessionId" SET DATA TYPE TEXT,
ALTER COLUMN "clubMemberId" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "SessionPlayerStat" ALTER COLUMN "sessionId" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "SessionSettings" ALTER COLUMN "sessionId" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "SportClub" DROP CONSTRAINT "SportClub_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "ownerId" SET DATA TYPE TEXT,
ADD CONSTRAINT "SportClub_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "SportClub_id_seq";

-- AlterTable
ALTER TABLE "SportSession" DROP CONSTRAINT "SportSession_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "clubId" SET DATA TYPE TEXT,
ADD CONSTRAINT "SportSession_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "SportSession_id_seq";

-- AlterTable
ALTER TABLE "User" DROP CONSTRAINT "User_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "User_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "User_id_seq";

-- CreateIndex
CREATE UNIQUE INDEX "AuthAccount_provider_providerAccountId_key" ON "AuthAccount"("provider", "providerAccountId");

-- CreateIndex
CREATE INDEX "RefreshSession_hashedToken_idx" ON "RefreshSession"("hashedToken");

-- CreateIndex
CREATE INDEX "RefreshSession_userId_idx" ON "RefreshSession"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshSession_hashedToken_key" ON "RefreshSession"("hashedToken");

-- AddForeignKey
ALTER TABLE "AuthAccount" ADD CONSTRAINT "AuthAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshSession" ADD CONSTRAINT "RefreshSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SportClub" ADD CONSTRAINT "SportClub_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubSettings" ADD CONSTRAINT "ClubSettings_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "SportClub"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SportSession" ADD CONSTRAINT "SportSession_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "SportClub"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionSettings" ADD CONSTRAINT "SessionSettings_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "SportSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubMember" ADD CONSTRAINT "ClubMember_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "SportClub"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubMember" ADD CONSTRAINT "ClubMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubMember" ADD CONSTRAINT "ClubMember_createdBySessionId_fkey" FOREIGN KEY ("createdBySessionId") REFERENCES "SportSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionPlayer" ADD CONSTRAINT "SessionPlayer_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "SportSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionPlayer" ADD CONSTRAINT "SessionPlayer_clubMemberId_fkey" FOREIGN KEY ("clubMemberId") REFERENCES "ClubMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Court" ADD CONSTRAINT "Court_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "SportClub"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionCourt" ADD CONSTRAINT "SessionCourt_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "SportSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionMatch" ADD CONSTRAINT "SessionMatch_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "SportSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchPlayer" ADD CONSTRAINT "MatchPlayer_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "SessionMatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchResult" ADD CONSTRAINT "MatchResult_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "SessionMatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchResult" ADD CONSTRAINT "MatchResult_submittedByAdminId_fkey" FOREIGN KEY ("submittedByAdminId") REFERENCES "ClubMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionPlayerStat" ADD CONSTRAINT "SessionPlayerStat_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "SportSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
