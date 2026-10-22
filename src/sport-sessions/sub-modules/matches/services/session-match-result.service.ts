import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../config/prisma/prisma.service.js';
import { Prisma } from '../../../../../prisma/generated/prisma/client.js';
import {
  MatchStatus,
  RoleType,
  ScoringType,
  TeamGroup,
} from '../../../../../prisma/generated/prisma/enums.js';

export interface MatchResultPlayer {
  sessionPlayerId: number;
  team: TeamGroup;
}

/** What undo needs to write back to the roster after a recompute. */
export interface PlayerAggregate {
  playCount: number;
  lastMatchFinishedAt: Date | null;
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

    // Ascending sessionPlayerId matches the lock order used by
    // reconcilePlayers so a concurrent undo and finish never deadlock on the
    // stat rows.
    const players = [...input.players].sort(
      (left, right) => left.sessionPlayerId - right.sessionPlayerId,
    );

    for (const player of players) {
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

  /**
   * Rebuilds leaderboard rows and roster counters for the given players after
   * a finished match has been voided. Values are recomputed as absolute
   * totals from the remaining finished matches and written with upsert set
   * operations, never increments, so repeating the call is harmless and a
   * partial earlier write is corrected rather than compounded.
   *
   * Returns the roster counters the undo flow writes back onto each
   * SessionPlayer. Stat rows are locked in ascending sessionPlayerId order,
   * the same order applyStatistics uses, so this never deadlocks against a
   * concurrent finish of a different match sharing players.
   */
  async reconcilePlayers(
    tx: Prisma.TransactionClient,
    sessionId: string,
    playerIds: number[],
  ): Promise<Map<number, PlayerAggregate>> {
    const ids = [...new Set(playerIds)].sort((left, right) => left - right);

    const rows = await tx.matchPlayer.findMany({
      where: {
        sessionPlayerId: { in: ids },
        match: { sessionId, status: MatchStatus.FINISHED },
      },
      select: {
        sessionPlayerId: true,
        team: true,
        match: {
          select: {
            endedAt: true,
            result: {
              select: { winningTeam: true, scoreTeamA: true, scoreTeamB: true },
            },
          },
        },
      },
    });

    const aggregates = new Map<number, PlayerAggregate>();
    const stats = new Map<
      number,
      {
        matchesPlayed: number;
        matchesDrawn: number;
        matchesWon: number;
        matchesLoss: number;
        pointsScored: number;
        pointsConceded: number;
        totalPoints: number;
      }
    >();

    for (const id of ids) {
      aggregates.set(id, { playCount: 0, lastMatchFinishedAt: null });
      stats.set(id, {
        matchesPlayed: 0,
        matchesDrawn: 0,
        matchesWon: 0,
        matchesLoss: 0,
        pointsScored: 0,
        pointsConceded: 0,
        totalPoints: 0,
      });
    }

    for (const row of rows) {
      const match = row.match;
      if (!match) continue;

      const aggregate = aggregates.get(row.sessionPlayerId)!;
      aggregate.playCount += 1;

      const endedAt = match.endedAt;
      if (
        endedAt &&
        (aggregate.lastMatchFinishedAt === null ||
          endedAt > aggregate.lastMatchFinishedAt)
      ) {
        aggregate.lastMatchFinishedAt = endedAt;
      }

      const result = match.result;
      if (!result) {
        continue;
      }

      const scoreA = result.scoreTeamA ?? 0;
      const scoreB = result.scoreTeamB ?? 0;
      const scored = row.team === TeamGroup.TEAM_A ? scoreA : scoreB;
      const conceded = row.team === TeamGroup.TEAM_A ? scoreB : scoreA;
      const outcome = this.resolveOutcome(result.winningTeam, row.team);

      const accumulator = stats.get(row.sessionPlayerId)!;
      accumulator.matchesPlayed += 1;
      accumulator.matchesDrawn += outcome.matchesDrawn;
      accumulator.matchesWon += outcome.matchesWon;
      accumulator.matchesLoss += outcome.matchesLoss;
      accumulator.pointsScored += scored;
      accumulator.pointsConceded += conceded;
      accumulator.totalPoints += scored - conceded;
    }

    for (const id of ids) {
      const accumulator = stats.get(id)!;

      await tx.sessionPlayerStat.upsert({
        where: { sessionPlayerId: id },
        create: { sessionId, sessionPlayerId: id, ...accumulator },
        update: { ...accumulator },
      });
    }

    return aggregates;
  }
}
