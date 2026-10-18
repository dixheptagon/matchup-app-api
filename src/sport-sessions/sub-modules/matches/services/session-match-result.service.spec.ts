import { Test, TestingModule } from '@nestjs/testing';
import { SessionMatchResultService } from './session-match-result.service.js';
import type { MatchResultInput } from './session-match-result.service.js';
import { PrismaService } from '../../../../config/prisma/prisma.service.js';
import { Prisma } from '../../../../../prisma/generated/prisma/client.js';
import {
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
});