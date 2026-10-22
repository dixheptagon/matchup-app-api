import { Test, TestingModule } from '@nestjs/testing';
import { SessionMatchResultService } from './session-match-result.service.js';
import type { MatchResultInput } from './session-match-result.service.js';
import { PrismaService } from '../../../../config/prisma/prisma.service.js';
import { Prisma } from '../../../../../prisma/generated/prisma/client.js';
import {
  MatchStatus,
  RoleType,
  ScoringType,
  TeamGroup,
} from '../../../../../prisma/generated/prisma/enums.js';

describe('SessionMatchResultService', () => {
  let service: SessionMatchResultService;
  let mockPrisma: any;

  const squad = [
    { sessionPlayerId: 1, team: TeamGroup.TEAM_A },
    { sessionPlayerId: 2, team: TeamGroup.TEAM_A },
    { sessionPlayerId: 3, team: TeamGroup.TEAM_B },
    { sessionPlayerId: 4, team: TeamGroup.TEAM_B },
  ];

  function input(overrides: Partial<MatchResultInput> = {}): MatchResultInput {
    return {
      matchId: 'match-1',
      clubId: 'club-1',
      sessionId: 'session-1',
      actingUserId: 'user-1',
      winningTeam: TeamGroup.TEAM_A,
      scoreTeamA: 21,
      scoreTeamB: 18,
      leaderBoardMode: ScoringType.SCORE_DIFF,
      players: squad,
      ...overrides,
    };
  }

  beforeEach(async () => {
    mockPrisma = {
      matchResult: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 'result-1' }),
      },
      sessionPlayerStat: {
        upsert: vi.fn().mockResolvedValue({ id: 1 }),
      },
      clubMember: {
        upsert: vi.fn().mockResolvedValue({ id: 'member-1' }),
      },
      sportClub: {
        findUnique: vi.fn().mockResolvedValue({ ownerId: 'user-1' }),
      },
      user: {
        findUnique: vi.fn().mockResolvedValue({ name: 'Ada', username: 'ada' }),
      },
      matchPlayer: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    mockPrisma.$transaction = vi.fn(async (arg: unknown) =>
      typeof arg === 'function'
        ? (arg as Function)(mockPrisma)
        : Promise.all(arg as Promise<unknown>[]),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionMatchResultService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<SessionMatchResultService>(
      SessionMatchResultService,
    );
  });

  describe('record', () => {
    it('stores the resolved outcome', async () => {
      await service.record(input({ notes: 'Close game' }));

      expect(mockPrisma.matchResult.create).toHaveBeenCalledWith({
        data: {
          matchId: 'match-1',
          winningTeam: TeamGroup.TEAM_A,
          scoreTeamA: 21,
          scoreTeamB: 18,
          notes: 'Close game',
          submittedByAdminId: 'member-1',
        },
      });
    });

    it('defaults notes to null', async () => {
      await service.record(input());

      expect(mockPrisma.matchResult.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ notes: null }),
        }),
      );
    });

    it('records a match that ended without a winner', async () => {
      await service.record(input({ winningTeam: null }));

      expect(mockPrisma.matchResult.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ winningTeam: null }),
        }),
      );
    });

    it('returns the existing result without writing again', async () => {
      mockPrisma.matchResult.findUnique.mockResolvedValue({
        id: 'existing',
      });

      const result = await service.record(input());

      expect(result).toEqual({ id: 'existing' });
      expect(mockPrisma.matchResult.create).not.toHaveBeenCalled();
      expect(mockPrisma.sessionPlayerStat.upsert).not.toHaveBeenCalled();
    });

    it('treats a concurrent unique violation as already recorded', async () => {
      mockPrisma.$transaction.mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError('duplicate', {
          code: 'P2002',
          clientVersion: '7.0.0',
        }),
      );
      mockPrisma.matchResult.findUnique.mockResolvedValue({
        id: 'existing',
      });

      await expect(service.record(input())).resolves.toEqual({
        id: 'existing',
      });
    });

    it('propagates unrelated errors', async () => {
      mockPrisma.$transaction.mockRejectedValueOnce(new Error('boom'));

      await expect(service.record(input())).rejects.toThrow('boom');
    });

    it('writes everything in a single transaction', async () => {
      await service.record(input());

      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('submitter resolution', () => {
    it('creates an OWNER membership when the submitter owns the club', async () => {
      await service.record(input());

      expect(mockPrisma.clubMember.upsert).toHaveBeenCalledWith({
        where: {
          clubId_userId: { clubId: 'club-1', userId: 'user-1' },
        },
        create: {
          clubId: 'club-1',
          userId: 'user-1',
          displayName: 'Ada',
          role: RoleType.OWNER,
        },
        update: {},
        select: { id: true },
      });
    });

    it('creates an ADMIN membership for a non-owner submitter', async () => {
      mockPrisma.sportClub.findUnique.mockResolvedValue({
        ownerId: 'someone-else',
      });

      await service.record(input());

      expect(mockPrisma.clubMember.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ role: RoleType.ADMIN }),
        }),
      );
    });

    it('falls back to the username when the user has no name', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        name: null,
        username: 'ada99',
      });

      await service.record(input());

      expect(mockPrisma.clubMember.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ displayName: 'ada99' }),
        }),
      );
    });

    it('falls back to a generic name when the user is unknown', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await service.record(input());

      expect(mockPrisma.clubMember.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ displayName: 'Admin' }),
        }),
      );
    });
  });

  describe('leaderboard statistics', () => {
    it('skips statistics when the leaderboard is off', async () => {
      await service.record(input({ leaderBoardMode: ScoringType.OFF }));

      expect(mockPrisma.matchResult.create).toHaveBeenCalled();
      expect(mockPrisma.sessionPlayerStat.upsert).not.toHaveBeenCalled();
    });

    it('credits the winners', async () => {
      await service.record(input());

      expect(mockPrisma.sessionPlayerStat.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { sessionPlayerId: 1 },
          create: expect.objectContaining({
            sessionId: 'session-1',
            sessionPlayerId: 1,
            matchesPlayed: 1,
            matchesWon: 1,
            matchesLoss: 0,
            matchesDrawn: 0,
          }),
        }),
      );
    });

    it('credits the losers', async () => {
      await service.record(input());

      expect(mockPrisma.sessionPlayerStat.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { sessionPlayerId: 3 },
          create: expect.objectContaining({
            matchesWon: 0,
            matchesLoss: 1,
          }),
        }),
      );
    });

    it('counts a match without a winner as drawn for everyone', async () => {
      await service.record(input({ winningTeam: null }));

      for (const player of squad) {
        expect(mockPrisma.sessionPlayerStat.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { sessionPlayerId: player.sessionPlayerId },
            create: expect.objectContaining({
              matchesDrawn: 1,
              matchesWon: 0,
              matchesLoss: 0,
            }),
          }),
        );
      }
    });

    it('records scored and conceded points per side', async () => {
      await service.record(input());

      expect(mockPrisma.sessionPlayerStat.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { sessionPlayerId: 1 },
          create: expect.objectContaining({
            pointsScored: 21,
            pointsConceded: 18,
          }),
        }),
      );
      expect(mockPrisma.sessionPlayerStat.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { sessionPlayerId: 3 },
          create: expect.objectContaining({
            pointsScored: 18,
            pointsConceded: 21,
          }),
        }),
      );
    });

    it('records totalPoints as the net score difference', async () => {
      await service.record(input());

      expect(mockPrisma.sessionPlayerStat.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { sessionPlayerId: 1 },
          create: expect.objectContaining({ totalPoints: 3 }),
        }),
      );
      expect(mockPrisma.sessionPlayerStat.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { sessionPlayerId: 3 },
          create: expect.objectContaining({ totalPoints: -3 }),
        }),
      );
    });

    it('treats an untracked score as zero points', async () => {
      await service.record(input({ scoreTeamA: null, scoreTeamB: null }));

      expect(mockPrisma.sessionPlayerStat.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { sessionPlayerId: 1 },
          create: expect.objectContaining({
            pointsScored: 0,
            pointsConceded: 0,
            totalPoints: 0,
          }),
        }),
      );
    });

    it('increments existing rows instead of overwriting them', async () => {
      await service.record(input());

      expect(mockPrisma.sessionPlayerStat.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { sessionPlayerId: 1 },
          update: {
            matchesPlayed: { increment: 1 },
            matchesDrawn: { increment: 0 },
            matchesWon: { increment: 1 },
            matchesLoss: { increment: 0 },
            pointsScored: { increment: 21 },
            pointsConceded: { increment: 18 },
            totalPoints: { increment: 3 },
          },
        }),
      );
    });

    it('covers every player in the match', async () => {
      await service.record(input());

      expect(mockPrisma.sessionPlayerStat.upsert).toHaveBeenCalledTimes(4);
    });
  });

  describe('reconcilePlayers', () => {
    const row = (
      sessionPlayerId: number,
      team: TeamGroup,
      endedAt: Date,
      result:
        | {
            winningTeam: TeamGroup | null;
            scoreTeamA: number | null;
            scoreTeamB: number | null;
          }
        | null,
    ) => ({
      sessionPlayerId,
      team,
      match: { endedAt, result },
    });

    it('reads only finished matches in the session', async () => {
      await service.reconcilePlayers(mockPrisma, 'session-1', [1, 2]);

      expect(mockPrisma.matchPlayer.findMany).toHaveBeenCalledWith({
        where: {
          sessionPlayerId: { in: [1, 2] },
          match: { sessionId: 'session-1', status: MatchStatus.FINISHED },
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
    });

    it('zero-fills players with no remaining matches', async () => {
      const aggregates = await service.reconcilePlayers(
        mockPrisma,
        'session-1',
        [1],
      );

      expect(aggregates.get(1)).toEqual({
        playCount: 0,
        lastMatchFinishedAt: null,
      });
      expect(mockPrisma.sessionPlayerStat.upsert).toHaveBeenCalledWith({
        where: { sessionPlayerId: 1 },
        create: {
          sessionId: 'session-1',
          sessionPlayerId: 1,
          matchesPlayed: 0,
          matchesDrawn: 0,
          matchesWon: 0,
          matchesLoss: 0,
          pointsScored: 0,
          pointsConceded: 0,
          totalPoints: 0,
        },
        update: {
          matchesPlayed: 0,
          matchesDrawn: 0,
          matchesWon: 0,
          matchesLoss: 0,
          pointsScored: 0,
          pointsConceded: 0,
          totalPoints: 0,
        },
      });
    });

    it('rebuilds counters from the remaining finished matches', async () => {
      const first = new Date('2026-10-01T10:00:00Z');
      const last = new Date('2026-10-03T10:00:00Z');

      mockPrisma.matchPlayer.findMany.mockResolvedValue([
        row(1, TeamGroup.TEAM_A, first, {
          winningTeam: TeamGroup.TEAM_A,
          scoreTeamA: 21,
          scoreTeamB: 18,
        }),
        row(1, TeamGroup.TEAM_A, last, null),
        row(2, TeamGroup.TEAM_B, last, {
          winningTeam: TeamGroup.TEAM_A,
          scoreTeamA: 21,
          scoreTeamB: 18,
        }),
      ]);

      const aggregates = await service.reconcilePlayers(
        mockPrisma,
        'session-1',
        [1, 2],
      );

      expect(aggregates.get(1)).toEqual({
        playCount: 2,
        lastMatchFinishedAt: last,
      });
      expect(aggregates.get(2)).toEqual({
        playCount: 1,
        lastMatchFinishedAt: last,
      });
      expect(mockPrisma.sessionPlayerStat.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { sessionPlayerId: 1 },
          create: expect.objectContaining({
            matchesPlayed: 1,
            matchesWon: 1,
            matchesLoss: 0,
            pointsScored: 21,
            pointsConceded: 18,
            totalPoints: 3,
          }),
        }),
      );
      expect(mockPrisma.sessionPlayerStat.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { sessionPlayerId: 2 },
          create: expect.objectContaining({
            matchesPlayed: 1,
            matchesWon: 0,
            matchesLoss: 1,
            pointsScored: 18,
            pointsConceded: 21,
            totalPoints: -3,
          }),
        }),
      );
    });

    it('counts a match without a result for playCount only', async () => {
      mockPrisma.matchPlayer.findMany.mockResolvedValue([
        row(1, TeamGroup.TEAM_A, new Date(), null),
      ]);

      await service.reconcilePlayers(mockPrisma, 'session-1', [1]);

      expect(mockPrisma.sessionPlayerStat.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            matchesPlayed: 0,
            matchesDrawn: 0,
            matchesWon: 0,
            matchesLoss: 0,
          }),
        }),
      );
    });

    it('counts a match without a winner as drawn', async () => {
      mockPrisma.matchPlayer.findMany.mockResolvedValue([
        row(1, TeamGroup.TEAM_A, new Date(), {
          winningTeam: null,
          scoreTeamA: 20,
          scoreTeamB: 20,
        }),
      ]);

      await service.reconcilePlayers(mockPrisma, 'session-1', [1]);

      expect(mockPrisma.sessionPlayerStat.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            matchesPlayed: 1,
            matchesDrawn: 1,
            matchesWon: 0,
            matchesLoss: 0,
          }),
        }),
      );
    });

    it('treats an untracked score as zero points', async () => {
      mockPrisma.matchPlayer.findMany.mockResolvedValue([
        row(1, TeamGroup.TEAM_A, new Date(), {
          winningTeam: TeamGroup.TEAM_A,
          scoreTeamA: null,
          scoreTeamB: null,
        }),
      ]);

      await service.reconcilePlayers(mockPrisma, 'session-1', [1]);

      expect(mockPrisma.sessionPlayerStat.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            pointsScored: 0,
            pointsConceded: 0,
            totalPoints: 0,
          }),
        }),
      );
    });

    it('de-duplicates and sorts the requested ids', async () => {
      await service.reconcilePlayers(mockPrisma, 'session-1', [3, 1, 3, 2]);

      expect(mockPrisma.matchPlayer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            sessionPlayerId: { in: [1, 2, 3] },
          }),
        }),
      );

      const upsertedIds = mockPrisma.sessionPlayerStat.upsert.mock.calls.map(
        (call: any[]) => call[0].where.sessionPlayerId,
      );
      expect(upsertedIds).toEqual([1, 2, 3]);
    });

    it('sets absolute counters instead of incrementing', async () => {
      mockPrisma.matchPlayer.findMany.mockResolvedValue([
        row(1, TeamGroup.TEAM_A, new Date(), {
          winningTeam: TeamGroup.TEAM_A,
          scoreTeamA: 21,
          scoreTeamB: 18,
        }),
      ]);

      await service.reconcilePlayers(mockPrisma, 'session-1', [1]);

      const call = mockPrisma.sessionPlayerStat.upsert.mock.calls[0][0];
      expect(call.update).toEqual({
        matchesPlayed: 1,
        matchesDrawn: 0,
        matchesWon: 1,
        matchesLoss: 0,
        pointsScored: 21,
        pointsConceded: 18,
        totalPoints: 3,
      });
    });

    it('is idempotent: repeating the recompute writes the same totals', async () => {
      mockPrisma.matchPlayer.findMany.mockResolvedValue([
        row(1, TeamGroup.TEAM_A, new Date(), {
          winningTeam: TeamGroup.TEAM_A,
          scoreTeamA: 21,
          scoreTeamB: 18,
        }),
      ]);

      await service.reconcilePlayers(mockPrisma, 'session-1', [1]);
      await service.reconcilePlayers(mockPrisma, 'session-1', [1]);

      const [first, second] = mockPrisma.sessionPlayerStat.upsert.mock.calls;
      expect(second[0].update).toEqual(first[0].update);
    });
  });
});