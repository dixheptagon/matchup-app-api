-- CreateEnum
CREATE TYPE "SkillLevel" AS ENUM ('NEWBIE', 'BEGINNER', 'INTERMEDIATE', 'ADVANCE');

-- CreateEnum
CREATE TYPE "SportType" AS ENUM ('BADMINTON', 'PADEL', 'TENNIS', 'TABLE_TENNIS', 'PICKLEBALL', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ScoringType" AS ENUM ('OFF', 'WINS', 'SCORE_DIFF');

-- CreateEnum
CREATE TYPE "MatchMakingType" AS ENUM ('CUSTOM', 'LOOSE_SOCIAL', 'SKILL_STRICT', 'BALANCED');

-- CreateEnum
CREATE TYPE "PriorityLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'MAX');

-- CreateEnum
CREATE TYPE "GenderPreferenceType" AS ENUM ('OFF', 'PREFER_MIXED', 'PREFER_SAME_GENDER');

-- CreateEnum
CREATE TYPE "MatchMakingMode" AS ENUM ('BALANCED', 'RANDOM', 'SKILL_BASED');

-- CreateEnum
CREATE TYPE "LateJoinerPolicy" AS ENUM ('EQUAL_PLAY_CATCHUP', 'SESSION_AVERAGE', 'MIN_SESSION_PLAY');

-- CreateEnum
CREATE TYPE "SessionsType" AS ENUM ('OPEN_PLAY', 'TOURNAMENT');

-- CreateEnum
CREATE TYPE "RoleType" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "GenderType" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "PlayerStatus" AS ENUM ('NOT_ARRIVED', 'WAITING', 'RESERVED', 'RESTING', 'PLAYING', 'LEFT');

-- CreateEnum
CREATE TYPE "CourtStatus" AS ENUM ('AVAILABLE', 'IN_USE', 'BLOCKED');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('QUEUED', 'READY', 'PLAYING', 'FINISHED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "GenerateType" AS ENUM ('AUTO', 'MANUAL');

-- CreateEnum
CREATE TYPE "TeamGroup" AS ENUM ('TEAM_A', 'TEAM_B');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('ACTIVE', 'FINISHED', 'DRAFT', 'ARCHIVED');

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(250),
    "username" VARCHAR(100),
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "email" TEXT,
    "gender" "GenderType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthAccount" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "provider" VARCHAR(100) NOT NULL,
    "providerAccountId" VARCHAR(250),
    "passwordHash" VARCHAR(250),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshSession" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "hashedToken" VARCHAR(500) NOT NULL,
    "deviceName" VARCHAR(100) NOT NULL,
    "ipAddress" VARCHAR(100) NOT NULL,
    "userAgent" VARCHAR(500) NOT NULL,
    "expiredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "RefreshSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SportClub" (
    "id" SERIAL NOT NULL,
    "ownerId" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SportClub_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClubSettings" (
    "id" SERIAL NOT NULL,
    "clubId" INTEGER NOT NULL,
    "defaultSport" "SportType" NOT NULL,
    "trackMatchScore" BOOLEAN NOT NULL DEFAULT true,
    "allowEndWithoutScore" BOOLEAN NOT NULL DEFAULT false,
    "attendanceCheckIn" BOOLEAN NOT NULL DEFAULT true,
    "lateJoinerPolicy" "LateJoinerPolicy",
    "leaderBoardMode" "ScoringType" NOT NULL,
    "queueDepth" INTEGER,
    "autoMatchMaking" BOOLEAN NOT NULL DEFAULT true,
    "matchMakingMode" "MatchMakingType" NOT NULL DEFAULT 'BALANCED',
    "equalPlayPriority" "PriorityLevel" NOT NULL DEFAULT 'MEDIUM',
    "balancedTeams" "PriorityLevel" NOT NULL DEFAULT 'HIGH',
    "partnerVariety" "PriorityLevel" NOT NULL DEFAULT 'MEDIUM',
    "opponentVariety" "PriorityLevel" NOT NULL DEFAULT 'MEDIUM',
    "prioritizeWaitingPlayers" "PriorityLevel" NOT NULL DEFAULT 'HIGH',
    "minimumRestTime" INTEGER,
    "carryBalance" "PriorityLevel" NOT NULL DEFAULT 'LOW',
    "carryEvaluation" "PriorityLevel" NOT NULL DEFAULT 'LOW',
    "genderPreference" "GenderPreferenceType",
    "fairnessThreshold" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClubSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SportSession" (
    "id" SERIAL NOT NULL,
    "clubId" INTEGER NOT NULL,
    "title" VARCHAR(250),
    "status" "SessionStatus" NOT NULL DEFAULT 'DRAFT',
    "description" TEXT,
    "type" "SessionsType" NOT NULL DEFAULT 'OPEN_PLAY',
    "scheduledAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SportSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionSettings" (
    "id" SERIAL NOT NULL,
    "sessionId" INTEGER NOT NULL,
    "defaultSport" "SportType" NOT NULL,
    "trackMatchScore" BOOLEAN NOT NULL DEFAULT true,
    "allowEndWithoutScore" BOOLEAN NOT NULL DEFAULT false,
    "attendanceCheckIn" BOOLEAN NOT NULL DEFAULT true,
    "lateJoinerPolicy" "LateJoinerPolicy",
    "leaderBoardMode" "ScoringType" NOT NULL,
    "queueDepth" INTEGER,
    "autoMatchMaking" BOOLEAN NOT NULL DEFAULT true,
    "matchMakingMode" "MatchMakingType" NOT NULL DEFAULT 'BALANCED',
    "equalPlayPriority" "PriorityLevel" NOT NULL DEFAULT 'MEDIUM',
    "balancedTeams" "PriorityLevel" NOT NULL DEFAULT 'HIGH',
    "partnerVariety" "PriorityLevel" NOT NULL DEFAULT 'MEDIUM',
    "opponentVariety" "PriorityLevel" NOT NULL DEFAULT 'MEDIUM',
    "prioritizeWaitingPlayers" "PriorityLevel" NOT NULL DEFAULT 'HIGH',
    "minimumRestTime" INTEGER,
    "carryBalance" "PriorityLevel" NOT NULL DEFAULT 'LOW',
    "carryEvaluation" "PriorityLevel" NOT NULL DEFAULT 'LOW',
    "genderPreference" "GenderPreferenceType",
    "fairnessThreshold" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SessionSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClubMember" (
    "id" SERIAL NOT NULL,
    "clubId" INTEGER,
    "userId" INTEGER,
    "displayName" VARCHAR(100),
    "role" "RoleType" NOT NULL DEFAULT 'MEMBER',
    "gender" "GenderType",
    "skillLevel" "SkillLevel" NOT NULL DEFAULT 'BEGINNER',
    "isGuest" BOOLEAN NOT NULL DEFAULT false,
    "createdBySessionId" INTEGER,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClubMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionPlayer" (
    "id" SERIAL NOT NULL,
    "sessionId" INTEGER NOT NULL,
    "clubMemberId" INTEGER NOT NULL,
    "playCount" INTEGER,
    "restCount" INTEGER,
    "status" "PlayerStatus" NOT NULL DEFAULT 'NOT_ARRIVED',
    "checkedInAt" TIMESTAMP(3),
    "lastMatchFinishedAt" TIMESTAMP(3),
    "restUntil" TIMESTAMP(3),

    CONSTRAINT "SessionPlayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Court" (
    "id" SERIAL NOT NULL,
    "clubId" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "displayOrder" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Court_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionCourt" (
    "id" SERIAL NOT NULL,
    "sessionId" INTEGER NOT NULL,
    "courtId" INTEGER NOT NULL,
    "status" "CourtStatus" NOT NULL DEFAULT 'AVAILABLE',

    CONSTRAINT "SessionCourt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionMatch" (
    "id" SERIAL NOT NULL,
    "sessionId" INTEGER NOT NULL,
    "sessionCourtId" INTEGER,
    "sequence" INTEGER NOT NULL,
    "status" "MatchStatus" NOT NULL DEFAULT 'QUEUED',
    "generatedBy" "GenerateType" NOT NULL DEFAULT 'AUTO',
    "assignedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SessionMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchPlayer" (
    "id" SERIAL NOT NULL,
    "matchId" INTEGER NOT NULL,
    "sessionPlayerId" INTEGER NOT NULL,
    "team" "TeamGroup" NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "MatchPlayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchResult" (
    "id" SERIAL NOT NULL,
    "matchId" INTEGER NOT NULL,
    "winningTeam" "TeamGroup",
    "scoreTeamA" INTEGER,
    "scoreTeamB" INTEGER,
    "notes" TEXT,
    "submittedByAdminId" INTEGER NOT NULL,

    CONSTRAINT "MatchResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionPlayerStat" (
    "id" SERIAL NOT NULL,
    "sessionId" INTEGER NOT NULL,
    "sessionPlayerId" INTEGER NOT NULL,
    "matchesPlayed" INTEGER NOT NULL DEFAULT 0,
    "matchesWon" INTEGER NOT NULL DEFAULT 0,
    "matchesLoss" INTEGER NOT NULL DEFAULT 0,
    "matchesDrawn" INTEGER NOT NULL DEFAULT 0,
    "pointsScored" INTEGER NOT NULL DEFAULT 0,
    "pointsConceded" INTEGER NOT NULL DEFAULT 0,
    "totalPoints" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SessionPlayerStat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "SportClub_name_key" ON "SportClub"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ClubSettings_clubId_key" ON "ClubSettings"("clubId");

-- CreateIndex
CREATE UNIQUE INDEX "SessionSettings_sessionId_key" ON "SessionSettings"("sessionId");

-- CreateIndex
CREATE INDEX "ClubMember_clubId_skillLevel_idx" ON "ClubMember"("clubId", "skillLevel");

-- CreateIndex
CREATE UNIQUE INDEX "ClubMember_clubId_userId_key" ON "ClubMember"("clubId", "userId");

-- CreateIndex
CREATE INDEX "SessionPlayer_sessionId_status_idx" ON "SessionPlayer"("sessionId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SessionPlayer_sessionId_clubMemberId_key" ON "SessionPlayer"("sessionId", "clubMemberId");

-- CreateIndex
CREATE INDEX "SessionCourt_sessionId_status_idx" ON "SessionCourt"("sessionId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SessionCourt_sessionId_courtId_key" ON "SessionCourt"("sessionId", "courtId");

-- CreateIndex
CREATE INDEX "SessionMatch_sessionId_status_idx" ON "SessionMatch"("sessionId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SessionMatch_sessionId_sequence_key" ON "SessionMatch"("sessionId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "MatchPlayer_matchId_sessionPlayerId_key" ON "MatchPlayer"("matchId", "sessionPlayerId");

-- CreateIndex
CREATE UNIQUE INDEX "MatchPlayer_matchId_team_position_key" ON "MatchPlayer"("matchId", "team", "position");

-- CreateIndex
CREATE UNIQUE INDEX "MatchResult_matchId_key" ON "MatchResult"("matchId");

-- CreateIndex
CREATE UNIQUE INDEX "SessionPlayerStat_sessionPlayerId_key" ON "SessionPlayerStat"("sessionPlayerId");

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
ALTER TABLE "SessionCourt" ADD CONSTRAINT "SessionCourt_courtId_fkey" FOREIGN KEY ("courtId") REFERENCES "Court"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionMatch" ADD CONSTRAINT "SessionMatch_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "SportSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionMatch" ADD CONSTRAINT "SessionMatch_sessionCourtId_fkey" FOREIGN KEY ("sessionCourtId") REFERENCES "SessionCourt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchPlayer" ADD CONSTRAINT "MatchPlayer_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "SessionMatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchPlayer" ADD CONSTRAINT "MatchPlayer_sessionPlayerId_fkey" FOREIGN KEY ("sessionPlayerId") REFERENCES "SessionPlayer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchResult" ADD CONSTRAINT "MatchResult_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "SessionMatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchResult" ADD CONSTRAINT "MatchResult_submittedByAdminId_fkey" FOREIGN KEY ("submittedByAdminId") REFERENCES "ClubMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionPlayerStat" ADD CONSTRAINT "SessionPlayerStat_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "SportSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionPlayerStat" ADD CONSTRAINT "SessionPlayerStat_sessionPlayerId_fkey" FOREIGN KEY ("sessionPlayerId") REFERENCES "SessionPlayer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
