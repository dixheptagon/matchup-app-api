import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { SessionMatchesService } from './session-matches.service.js';
import { PrismaService } from '../../../../config/prisma/prisma.service.js';
import { MATCH_DETAIL_INCLUDE } from '../../../shared/constants/sport-sessions.constant.js';
import {
  CourtStatus,
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
        findUnique: vi.fn(),
        delete: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      sessionPlayer: {
        updateMany: vi.fn(),
      },
      sessionCourt: {
        findFirst: vi.fn(),
        update: vi.fn(),
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
    it('returns not-yet-playing matches ordered by creation time', async () => {
      mockPrisma.sessionMatch.findMany.mockResolvedValue([]);
      mockPrisma.sessionMatch.count.mockResolvedValue(0);

      await service.getMatchQueue(mockSession);

      const args = mockPrisma.sessionMatch.findMany.mock.calls[0][0];
      expect(args.where).toEqual({
        sessionId: 'session-1',
        status: { in: [MatchStatus.QUEUED, MatchStatus.READY] },
      });
      expect(args.orderBy).toEqual([
        { createdAt: 'asc' },
        { id: 'asc' },
      ]);
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

    it('releases the assigned court back to AVAILABLE', async () => {
      mockPrisma.sessionMatch.findFirst.mockResolvedValue({
        id: 'match-1',
        sequence: 3,
        status: MatchStatus.READY,
        sessionCourtId: 7,
        players: [
          { sessionPlayerId: 1, sessionPlayer: { id: 1, status: PlayerStatus.RESERVED } },
        ],
      });

      await service.cancelMatch(mockSession, 'match-1');

      expect(mockPrisma.sessionCourt.update).toHaveBeenCalledWith({
        where: { id: 7 },
        data: { status: CourtStatus.AVAILABLE },
      });
    });

    it('performs no court write for a court-less match', async () => {
      primeMatch(MatchStatus.QUEUED, [PlayerStatus.RESERVED]);

      await service.cancelMatch(mockSession, 'match-1');

      expect(mockPrisma.sessionCourt.update).not.toHaveBeenCalled();
    });
  });

  describe('assignCourt', () => {
    function primeCourt(status: CourtStatus) {
      mockPrisma.sessionMatch.findFirst.mockResolvedValue({
        id: 'match-1',
        sequence: 3,
        status: MatchStatus.QUEUED,
      });
      mockPrisma.sessionCourt.findFirst.mockResolvedValue({
        id: 7,
        status,
      });
      // Default: both guards succeed.
      mockPrisma.sessionMatch.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.sessionCourt.updateMany.mockResolvedValue({ count: 1 });
    }

    it('throws NotFound when the match is not in the session', async () => {
      mockPrisma.sessionMatch.findFirst.mockResolvedValue(null);

      await expect(
        service.assignCourt(mockSession, 'missing', { sessionCourtId: 7 }),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.sessionMatch.updateMany).not.toHaveBeenCalled();
    });

    it('throws NotFound when the court is not in the session', async () => {
      mockPrisma.sessionMatch.findFirst.mockResolvedValue({
        id: 'match-1',
        status: MatchStatus.QUEUED,
      });
      mockPrisma.sessionCourt.findFirst.mockResolvedValue(null);

      await expect(
        service.assignCourt(mockSession, 'match-1', { sessionCourtId: 7 }),
      ).rejects.toThrow(NotFoundException);
    });

    it.each([MatchStatus.READY, MatchStatus.PLAYING, MatchStatus.FINISHED])(
      'rejects assigning a court to a %s match',
      async (status) => {
        mockPrisma.sessionMatch.findFirst.mockResolvedValue({
          id: 'match-1',
          status,
        });

        await expect(
          service.assignCourt(mockSession, 'match-1', { sessionCourtId: 7 }),
        ).rejects.toThrow(BadRequestException);
        expect(mockPrisma.sessionMatch.updateMany).not.toHaveBeenCalled();
      },
    );

    it.each([CourtStatus.IN_USE, CourtStatus.BLOCKED])(
      'rejects a %s court',
      async (status) => {
        primeCourt(status);

        await expect(
          service.assignCourt(mockSession, 'match-1', { sessionCourtId: 7 }),
        ).rejects.toThrow(BadRequestException);
        expect(mockPrisma.sessionMatch.updateMany).not.toHaveBeenCalled();
      },
    );

    it('guards the match update on its status', async () => {
      primeCourt(CourtStatus.AVAILABLE);
      mockPrisma.sessionMatch.findUnique.mockResolvedValue({ id: 'match-1' });

      await service.assignCourt(mockSession, 'match-1', {
        sessionCourtId: 7,
      });

      expect(mockPrisma.sessionMatch.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'match-1',
          status: { in: [MatchStatus.QUEUED] },
        },
        data: {
          sessionCourtId: 7,
          status: MatchStatus.READY,
          assignedAt: expect.any(Date),
        },
      });
    });

    it('guards the court update on it being AVAILABLE', async () => {
      primeCourt(CourtStatus.AVAILABLE);
      mockPrisma.sessionMatch.findUnique.mockResolvedValue({ id: 'match-1' });

      await service.assignCourt(mockSession, 'match-1', {
        sessionCourtId: 7,
      });

      expect(mockPrisma.sessionCourt.updateMany).toHaveBeenCalledWith({
        where: { id: 7, status: CourtStatus.AVAILABLE },
        data: { status: CourtStatus.IN_USE },
      });
    });

    it('throws Conflict when the match guard loses the race', async () => {
      primeCourt(CourtStatus.AVAILABLE);
      mockPrisma.sessionMatch.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.assignCourt(mockSession, 'match-1', { sessionCourtId: 7 }),
      ).rejects.toThrow(ConflictException);

      // The court must never be taken when the match guard failed.
      expect(mockPrisma.sessionCourt.updateMany).not.toHaveBeenCalled();
    });

    it('throws Conflict when the court guard loses the race', async () => {
      primeCourt(CourtStatus.AVAILABLE);
      mockPrisma.sessionMatch.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.sessionCourt.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.assignCourt(mockSession, 'match-1', { sessionCourtId: 7 }),
      ).rejects.toThrow(ConflictException);
    });

    it('returns the updated match with its court', async () => {
      primeCourt(CourtStatus.AVAILABLE);
      const updated = { id: 'match-1', status: MatchStatus.READY };
      mockPrisma.sessionMatch.findUnique.mockResolvedValue(updated);

      const result = await service.assignCourt(mockSession, 'match-1', {
        sessionCourtId: 7,
      });

      expect(result).toEqual(updated);
      expect(mockPrisma.sessionMatch.findUnique).toHaveBeenCalledWith({
        where: { id: 'match-1' },
        include: MATCH_DETAIL_INCLUDE,
      });
    });

    it('locks the match before the court', async () => {
      primeCourt(CourtStatus.AVAILABLE);
      mockPrisma.sessionMatch.findUnique.mockResolvedValue({ id: 'match-1' });

      await service.assignCourt(mockSession, 'match-1', {
        sessionCourtId: 7,
      });

      const order = [
        mockPrisma.sessionMatch.updateMany.mock.invocationCallOrder[0],
        mockPrisma.sessionCourt.updateMany.mock.invocationCallOrder[0],
      ];
      expect(order[0]).toBeLessThan(order[1]);
    });

    it('runs every write inside a single transaction', async () => {
      primeCourt(CourtStatus.AVAILABLE);

      await service.assignCourt(mockSession, 'match-1', {
        sessionCourtId: 7,
      });

      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      expect(mockPrisma.$transaction).toHaveBeenCalledWith(expect.any(Function));
    });
  });
});