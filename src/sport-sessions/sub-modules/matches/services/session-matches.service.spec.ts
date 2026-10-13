import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SessionMatchesService } from './session-matches.service.js';
import { PrismaService } from '../../../../config/prisma/prisma.service.js';
import { MATCH_DETAIL_INCLUDE } from '../../../shared/constants/sport-sessions.constant.js';
import {
  MatchStatus,
  PlayerStatus,
} from '../../../../../prisma/generated/prisma/enums.js';
import type { SessionContext } from '../../../shared/types/sport-sessions.types.js';

describe('SessionMatchesService', () => {
  let service: SessionMatchesService;
  let mockPrisma: any;

  const mockSession: SessionContext = {
    id: 'session-1',
    clubId: 'club-1',
    status: 'ACTIVE',
    title: 'Open Play',
    sessionSettings: { attendanceCheckIn: true },
    _count: { sessionCourts: 1, players: 8 },
  };

  beforeEach(async () => {
    mockPrisma = {
      sessionMatch: {
        findMany: vi.fn(),
        count: vi.fn(),
        findFirst: vi.fn(),
        delete: vi.fn(),
        update: vi.fn(),
      },
      sessionPlayer: {
        updateMany: vi.fn(),
      },
    };
    mockPrisma.$transaction = vi.fn(async (arg: unknown) =>
      Array.isArray(arg) ? Promise.all(arg) : (arg as Function)(mockPrisma),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionMatchesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<SessionMatchesService>(SessionMatchesService);
  });

  describe('getMatchQueue', () => {
    it('returns not-yet-playing matches ordered by sequence', async () => {
      mockPrisma.sessionMatch.findMany.mockResolvedValue([]);
      mockPrisma.sessionMatch.count.mockResolvedValue(0);

      await service.getMatchQueue(mockSession);

      const args = mockPrisma.sessionMatch.findMany.mock.calls[0][0];
      expect(args.where).toEqual({
        sessionId: 'session-1',
        status: { in: [MatchStatus.QUEUED, MatchStatus.READY] },
      });
      expect(args.orderBy).toEqual({ sequence: 'asc' });
      expect(args.include).toEqual(MATCH_DETAIL_INCLUDE);
    });

    it('narrows to a single status when provided', async () => {
      mockPrisma.sessionMatch.findMany.mockResolvedValue([]);
      mockPrisma.sessionMatch.count.mockResolvedValue(0);

      await service.getMatchQueue(mockSession, {
        status: MatchStatus.READY,
      });

      const args = mockPrisma.sessionMatch.findMany.mock.calls[0][0];
      expect(args.where.status).toEqual({ in: [MatchStatus.READY] });
    });

    it('returns the queue and its total', async () => {
      const matches = [{ id: 'm1', sequence: 1, status: MatchStatus.QUEUED }];
      mockPrisma.sessionMatch.findMany.mockResolvedValue(matches);
      mockPrisma.sessionMatch.count.mockResolvedValue(1);

      const result = await service.getMatchQueue(mockSession);

      expect(result).toEqual({
        data: matches,
        meta: { total: 1, sessionId: 'session-1' },
      });
    });

    it('returns an empty queue when there are no pending matches', async () => {
      mockPrisma.sessionMatch.findMany.mockResolvedValue([]);
      mockPrisma.sessionMatch.count.mockResolvedValue(0);

      const result = await service.getMatchQueue(mockSession);

      expect(result).toEqual({
        data: [],
        meta: { total: 0, sessionId: 'session-1' },
      });
    });

    it('derives the total from the count query rather than the rows', async () => {
      mockPrisma.sessionMatch.findMany.mockResolvedValue([]);
      mockPrisma.sessionMatch.count.mockResolvedValue(7);

      const result = await service.getMatchQueue(mockSession);

      expect(result.data).toHaveLength(0);
      expect(result.meta.total).toBe(7);
    });
  });

  describe('cancelMatch', () => {
    function primeMatch(status: MatchStatus, playerStatuses: PlayerStatus[]) {
      mockPrisma.sessionMatch.findFirst.mockResolvedValue({
        id: 'match-1',
        sequence: 3,
        status,
        players: playerStatuses.map((playerStatus, index) => ({
          sessionPlayerId: index + 1,
          sessionPlayer: { id: index + 1, status: playerStatus },
        })),
      });
    }

    it('throws NotFound when the match is not in the session', async () => {
      mockPrisma.sessionMatch.findFirst.mockResolvedValue(null);

      await expect(
        service.cancelMatch(mockSession, 'missing'),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.sessionMatch.delete).not.toHaveBeenCalled();
    });

    it.each([MatchStatus.FINISHED, MatchStatus.CANCELLED])(
      'rejects a %s match',
      async (status) => {
        primeMatch(status, [PlayerStatus.RESERVED]);

        await expect(
          service.cancelMatch(mockSession, 'match-1'),
        ).rejects.toThrow(BadRequestException);
        expect(mockPrisma.sessionMatch.delete).not.toHaveBeenCalled();
        expect(mockPrisma.sessionMatch.update).not.toHaveBeenCalled();
      },
    );

    it.each([MatchStatus.QUEUED, MatchStatus.READY])(
      'hard deletes a %s match and discards the reason',
      async (status) => {
        primeMatch(status, [PlayerStatus.RESERVED]);

        const result = await service.cancelMatch(mockSession, 'match-1', {
          reason: 'not needed',
        });

        expect(mockPrisma.sessionMatch.delete).toHaveBeenCalledWith({
          where: { id: 'match-1' },
        });
        expect(mockPrisma.sessionMatch.update).not.toHaveBeenCalled();
        expect(result).toEqual({
          action: 'DELETED',
          matchId: 'match-1',
          sequence: 3,
          releasedPlayerIds: [1],
          cancelReason: null,
        });
      },
    );

    it('soft cancels a PLAYING match and stores the reason', async () => {
      primeMatch(MatchStatus.PLAYING, [PlayerStatus.PLAYING]);

      const result = await service.cancelMatch(mockSession, 'match-1', {
        reason: 'court flooded',
      });

      expect(mockPrisma.sessionMatch.delete).not.toHaveBeenCalled();
      expect(mockPrisma.sessionMatch.update).toHaveBeenCalledWith({
        where: { id: 'match-1' },
        data: {
          status: MatchStatus.CANCELLED,
          cancelReason: 'court flooded',
          cancelledAt: expect.any(Date),
        },
      });
      expect(result).toEqual({
        action: 'CANCELLED',
        matchId: 'match-1',
        sequence: 3,
        releasedPlayerIds: [1],
        cancelReason: 'court flooded',
      });
    });

    it('stores a null reason when none is supplied', async () => {
      primeMatch(MatchStatus.PLAYING, [PlayerStatus.PLAYING]);

      await service.cancelMatch(mockSession, 'match-1');

      expect(mockPrisma.sessionMatch.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ cancelReason: null }),
        }),
      );
    });

    it('returns both RESERVED and PLAYING players to the waiting pool', async () => {
      primeMatch(MatchStatus.PLAYING, [
        PlayerStatus.PLAYING,
        PlayerStatus.RESERVED,
      ]);

      const result = await service.cancelMatch(mockSession, 'match-1');

      expect(result.releasedPlayerIds).toEqual([1, 2]);
      expect(mockPrisma.sessionPlayer.updateMany).toHaveBeenCalledWith({
        where: {
          id: { in: [1, 2] },
          status: { in: [PlayerStatus.RESERVED, PlayerStatus.PLAYING] },
        },
        data: { status: PlayerStatus.WAITING },
      });
    });

    it('leaves players in other states untouched', async () => {
      primeMatch(MatchStatus.PLAYING, [
        PlayerStatus.RESTING,
        PlayerStatus.LEFT,
      ]);

      const result = await service.cancelMatch(mockSession, 'match-1');

      expect(result.releasedPlayerIds).toEqual([]);
      expect(mockPrisma.sessionPlayer.updateMany).not.toHaveBeenCalled();
    });

    it('runs every write inside a single transaction', async () => {
      primeMatch(MatchStatus.QUEUED, [PlayerStatus.RESERVED]);

      await service.cancelMatch(mockSession, 'match-1');

      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      expect(mockPrisma.$transaction).toHaveBeenCalledWith(expect.any(Function));
    });
  });
});