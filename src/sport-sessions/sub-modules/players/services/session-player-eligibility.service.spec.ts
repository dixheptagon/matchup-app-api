import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../../config/prisma/prisma.service.js';
import {
  MatchStatus,
  PlayerStatus,
} from '../../../../../prisma/generated/prisma/enums.js';
import type { SessionContext } from '../../../shared/types/sport-sessions.types.js';
import { SessionPlayerEligibilityService } from './session-player-eligibility.service.js';
import { PlayerWeightingService } from './player-weighting.service.js';

describe('SessionPlayerEligibilityService', () => {
  let service: SessionPlayerEligibilityService;
  let mockPrisma: any;

  const sessionStart = new Date('2026-09-23T10:00:00.000Z');
  const NOW = new Date('2026-10-01T12:00:00.000Z');
  const mockSession: SessionContext = {
    id: 'session-1',
    clubId: 'club-1',
    status: 'ACTIVE',
    title: 'Open Play 2026-09-23',
    startedAt: sessionStart,
    sessionSettings: { attendanceCheckIn: true },
    _count: { sessionCourts: 1, players: 4 },
  };

  const benchRow = (overrides: Record<string, unknown> = {}) => ({
    id: 1,
    status: PlayerStatus.WAITING,
    restUntil: null,
    playCount: 0,
    checkedInAt: sessionStart,
    lastMatchFinishedAt: null,
    clubMember: { displayName: 'Player One' },
    ...overrides,
  });

  beforeEach(async () => {
    mockPrisma = {
      sessionPlayer: {
        findMany: vi.fn(),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    };
    mockPrisma.$transaction = vi.fn(async (arg: unknown) =>
      Array.isArray(arg) ? Promise.all(arg) : (arg as Function)(mockPrisma),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionPlayerEligibilityService,
        PlayerWeightingService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<SessionPlayerEligibilityService>(
      SessionPlayerEligibilityService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getEligiblePlayers', () => {
    beforeEach(() => {
      mockPrisma.sessionPlayer.findMany.mockResolvedValue([]);
    });

    it('promotes elapsed rests and timed breaks before querying', async () => {
      await service.getEligiblePlayers(mockSession, NOW);

      expect(mockPrisma.sessionPlayer.updateMany).toHaveBeenNthCalledWith(1, {
        where: {
          sessionId: 'session-1',
          status: PlayerStatus.RESTING,
          OR: [{ restUntil: null }, { restUntil: { lte: NOW } }],
        },
        data: { status: PlayerStatus.WAITING, restUntil: null },
      });
      expect(mockPrisma.sessionPlayer.updateMany).toHaveBeenNthCalledWith(2, {
        where: {
          sessionId: 'session-1',
          status: PlayerStatus.BREAK,
          restUntil: { not: null, lte: NOW },
        },
        data: { status: PlayerStatus.WAITING, restUntil: null },
      });

      const promotionOrder =
        mockPrisma.sessionPlayer.updateMany.mock.invocationCallOrder[1];
      expect(promotionOrder).toBeLessThan(
        mockPrisma.sessionPlayer.findMany.mock.invocationCallOrder[0],
      );
    });

    it('queries the whole bench scoped to the session', async () => {
      await service.getEligiblePlayers(mockSession, NOW);

      const args = mockPrisma.sessionPlayer.findMany.mock.calls[0][0];
      expect(args.where.sessionId).toBe('session-1');
      expect(args.where.status.in).toEqual([
        PlayerStatus.WAITING,
        PlayerStatus.RESTING,
        PlayerStatus.BREAK,
      ]);
      expect(args.where.OR).toBeUndefined();
    });

    it('should exclude players committed to an unfinished match', async () => {
      await service.getEligiblePlayers(mockSession, NOW);

      const args = mockPrisma.sessionPlayer.findMany.mock.calls[0][0];
      expect(args.where.matchPlayers).toEqual({
        none: {
          match: {
            status: {
              in: [MatchStatus.QUEUED, MatchStatus.READY, MatchStatus.PLAYING],
            },
          },
        },
      });
      expect(args.where.matchPlayers.none.match.status.in).not.toContain(
        MatchStatus.FINISHED,
      );
      expect(args.where.matchPlayers.none.match.status.in).not.toContain(
        MatchStatus.CANCELLED,
      );
    });

    it('should include clubMember and order by wait time then id', async () => {
      await service.getEligiblePlayers(mockSession, NOW);

      const args = mockPrisma.sessionPlayer.findMany.mock.calls[0][0];
      expect(args.include).toEqual({ clubMember: true });
      expect(args.orderBy).toEqual([{ checkedInAt: 'asc' }, { id: 'asc' }]);
    });

    it('marks only waiting players as ready', async () => {
      mockPrisma.sessionPlayer.findMany.mockResolvedValue([
        benchRow({ id: 1, status: PlayerStatus.WAITING, playCount: 1 }),
        benchRow({
          id: 2,
          status: PlayerStatus.RESTING,
          restUntil: new Date('2026-10-01T12:30:00.000Z'),
          playCount: 2,
        }),
        benchRow({ id: 3, status: PlayerStatus.BREAK, restUntil: null }),
      ]);

      const result = await service.getEligiblePlayers(mockSession, NOW);
      const byId = new Map(
        result.data.map((player) => [player.id, player] as const),
      );

      expect(byId.get(1)).toEqual(
        expect.objectContaining({
          status: PlayerStatus.WAITING,
          restUntil: null,
          playCount: 1,
          lastMatchFinishedAt: null,
          isReady: true,
        }),
      );
      expect(byId.get(2)).toEqual(
        expect.objectContaining({
          status: PlayerStatus.RESTING,
          restUntil: new Date('2026-10-01T12:30:00.000Z'),
          isReady: false,
        }),
      );
      expect(byId.get(3)).toEqual(
        expect.objectContaining({
          status: PlayerStatus.BREAK,
          restUntil: null,
          isReady: false,
        }),
      );
    });

    it('sorts waiting, then resting by earliest rest, then breaks', async () => {
      mockPrisma.sessionPlayer.findMany.mockResolvedValue([
        benchRow({ id: 3, status: PlayerStatus.BREAK, restUntil: null }),
        benchRow({
          id: 4,
          status: PlayerStatus.BREAK,
          restUntil: new Date('2026-10-01T13:00:00.000Z'),
        }),
        benchRow({
          id: 2,
          status: PlayerStatus.RESTING,
          restUntil: new Date('2026-10-01T11:30:00.000Z'),
        }),
        benchRow({
          id: 5,
          status: PlayerStatus.RESTING,
          restUntil: new Date('2026-10-01T11:00:00.000Z'),
        }),
        benchRow({ id: 1, status: PlayerStatus.WAITING }),
        benchRow({ id: 6, status: PlayerStatus.WAITING }),
      ]);

      const result = await service.getEligiblePlayers(mockSession, NOW);

      expect(result.data.map((player) => player.id)).toEqual([
        1, 6, 5, 2, 4, 3,
      ]);
    });

    it('orders waiting players by fairness within the waiting group', async () => {
      mockPrisma.sessionPlayer.findMany.mockResolvedValue([
        benchRow({ id: 1, status: PlayerStatus.WAITING, playCount: 2 }),
        benchRow({ id: 2, status: PlayerStatus.WAITING, playCount: 0 }),
      ]);

      const result = await service.getEligiblePlayers(mockSession, NOW);

      expect(result.data.map((player) => player.id)).toEqual([2, 1]);
    });

    it('omits the fairness breakdown from the bench payload', async () => {
      mockPrisma.sessionPlayer.findMany.mockResolvedValue([benchRow()]);

      const result = await service.getEligiblePlayers(mockSession, NOW);

      expect(result.data[0].fairness).toBeUndefined();
      expect(result.data[0]).toEqual(
        expect.objectContaining({
          id: 1,
          status: PlayerStatus.WAITING,
          restUntil: null,
          playCount: 0,
          lastMatchFinishedAt: null,
          clubMember: { displayName: 'Player One' },
          isReady: true,
        }),
      );
    });

    it('returns empty data and a zero total when the bench is empty', async () => {
      const result = await service.getEligiblePlayers(mockSession, NOW);

      expect(result).toEqual({
        data: [],
        meta: { total: 0, sessionId: 'session-1' },
      });
    });

    it('reports the bench size as the total', async () => {
      mockPrisma.sessionPlayer.findMany.mockResolvedValue([
        benchRow({ id: 1 }),
        benchRow({
          id: 2,
          status: PlayerStatus.RESTING,
          restUntil: new Date('2026-10-01T12:30:00.000Z'),
        }),
      ]);

      const result = await service.getEligiblePlayers(mockSession, NOW);

      expect(result.meta).toEqual({ total: 2, sessionId: 'session-1' });
    });
  });
});
