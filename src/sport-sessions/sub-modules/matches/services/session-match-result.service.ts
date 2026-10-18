import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../config/prisma/prisma.service.js';
import { Prisma } from '../../../../../prisma/generated/prisma/client.js';
import {
  RoleType,
  ScoringType,
  TeamGroup,
} from '../../../../../prisma/generated/prisma/enums.js';

export interface MatchResultPlayer {
  sessionPlayerId: number;
  team: TeamGroup;
}

export interface MatchResultInput {
  matchId: string;
  clubId: string;
  sessionId: string;
  actingUserId: string;
  winningTeam: TeamGroup | null;
  scoreTeamA: number | null;
  scoreTeamB: number | null;
  leaderBoardMode: ScoringType;
  players: MatchResultPlayer[];
  notes?: string;
}

/**
 * Derived data for a finished match: the MatchResult row and the per-player
 * leaderboard statistics.
 *
 * This runs after the match itself has already been finished, and is written in
 * its own transaction so a failure here never leaves a half-finished match. It
 * is safe to retry because MatchResult.matchId is unique: a second attempt for
 * the same match reads the existing row and returns it instead of counting the
 * result twice.
 */
@Injectable()
export class SessionMatchResultService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: MatchResultInput) {
    const existing = await this.prisma.matchResult.findUnique({
      where: { matchId: input.matchId },
    });

    if (existing) {
      return existing;
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const admin = await this.resolveSubmitter(tx, input);

        const result = await tx.matchResult.create({
          data: {
            matchId: input.matchId,
            winningTeam: input.winningTeam,
            scoreTeamA: input.scoreTeamA,
            scoreTeamB: input.scoreTeamB,
            notes: input.notes ?? null,
            submittedByAdminId: admin.id,
          },
        });

        if (input.leaderBoardMode !== ScoringType.OFF) {
          await this.applyStatistics(tx, input);
        }

        return result;
      });
    } catch (error) {
      // A concurrent or retried call won the race on the unique matchId. Its
      // transaction also rolled back, so no statistics were double counted.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return this.prisma.matchResult.findUnique({
          where: { matchId: input.matchId },
        });
      }
      throw error;
    }
  }

  /**
   * MatchResult records who submitted it, which points at a ClubMember. Club
   * owners are authorised by their club ownership and do not necessarily have a
   * membership row, so the acting admin is looked up and created on demand.
   */
  private async resolveSubmitter(
    tx: Prisma.TransactionClient,
    input: MatchResultInput,
  ) {
    const club = await tx.sportClub.findUnique({
      where: { id: input.clubId },
      select: { ownerId: true },
    });

    const user = await tx.user.findUnique({
      where: { id: input.actingUserId },
      select: { name: true, username: true },
    });

    return tx.clubMember.upsert({
      where: {
        clubId_userId: { clubId: input.clubId, userId: input.actingUserId },
      },
      create: {
        clubId: input.clubId,
        userId: input.actingUserId,
        displayName: user?.name ?? user?.username ?? 'Admin',
        role:
          club?.ownerId === input.actingUserId
            ? RoleType.OWNER
            : RoleType.ADMIN,
      },
      update: {},
      select: { id: true },
    });
  }

  /** A match with no winner (draw or finished without a result) counts as drawn. */
  private resolveOutcome(winningTeam: TeamGroup | null, team: TeamGroup) {
    if (winningTeam === null) {
      return { matchesDrawn: 1, matchesWon: 0, matchesLoss: 0 };
    }

    return winningTeam === team
      ? { matchesDrawn: 0, matchesWon: 1, matchesLoss: 0 }
      : { matchesDrawn: 0, matchesWon: 0, matchesLoss: 1 };
  }

  /**
   * Accumulates each player's outcome. pointsScored/pointsConceded and
   * totalPoints track the raw score and its net difference; leaderBoardMode only
   * decides whether these rows are written at all, the read side picks the
   * ranking metric.
   */
  private async applyStatistics(
    tx: Prisma.TransactionClient,
    input: MatchResultInput,
  ) {
    const scoreA = input.scoreTeamA ?? 0;
    const scoreB = input.scoreTeamB ?? 0;

    for (const player of input.players) {
      const scored = player.team === TeamGroup.TEAM_A ? scoreA : scoreB;
      const conceded = player.team === TeamGroup.TEAM_A ? scoreB : scoreA;

      const outcome = this.resolveOutcome(input.winningTeam, player.team);

      const data = {
        matchesPlayed: 1,
        ...outcome,
        pointsScored: scored,
        pointsConceded: conceded,
        totalPoints: scored - conceded,
      };

      await tx.sessionPlayerStat.upsert({
        where: { sessionPlayerId: player.sessionPlayerId },
        create: {
          sessionId: input.sessionId,
          sessionPlayerId: player.sessionPlayerId,
          ...data,
        },
        update: {
          matchesPlayed: { increment: 1 },
          matchesDrawn: { increment: outcome.matchesDrawn },
          matchesWon: { increment: outcome.matchesWon },
          matchesLoss: { increment: outcome.matchesLoss },
          pointsScored: { increment: scored },
          pointsConceded: { increment: conceded },
          totalPoints: { increment: scored - conceded },
        },
      });
    }
  }
}
