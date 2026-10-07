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
  const mockSession: SessionContext = {
    id: 'session-1',
    clubId: 'club-1',
    status: 'ACTIVE',
    title: 'Open Play 2026-09-23',
    startedAt: sessionStart,
    sessionSettings: { attendanceCheckIn: true },
    _count: { sessionCourts: 1, players: 4 },
  };

  beforeEach(async () => {
    mockPrisma = {
      sessionPlayer: { findMany: vi.fn(), count: vi.fn() },
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
    it('should query WAITING players scoped to the session', async () => {
      mockPrisma.sessionPlayer.findMany.mockResolvedValue([]);
      mockPrisma.sessionPlayer.count.mockResolvedValue(0);

      await service.getEligiblePlayers(mockSession);

      const args = mockPrisma.sessionPlayer.findMany.mock.calls[0][0];
      expect(args.where.sessionId).toBe('session-1');
      expect(args.where.status).toBe(PlayerStatus.WAITING);
    });

    it('should exclude players committed to an unfinished match', async () => {
      mockPrisma.sessionPlayer.findMany.mockResolvedValue([]);
      mockPrisma.sessionPlayer.count.mockResolvedValue(0);

      await service.getEligiblePlayers(mockSession);

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

    it('should include clubMember and the matchPlayers count', async () => {
      mockPrisma.sessionPlayer.findMany.mockResolvedValue([]);
      mockPrisma.sessionPlayer.count.mockResolvedValue(0);

      await service.getEligiblePlayers(mockSession);

      const args = mockPrisma.sessionPlayer.findMany.mock.calls[0][0];
      expect(args.include).toEqual({
        clubMember: true,
        _count: { select: { matchPlayers: true } },
      });
      expect(args.orderBy).toEqual([{ checkedInAt: 'asc' }, { id: 'asc' }]);
    });

    it('should return empty data and a zero total when nobody is waiting', async () => {
      mockPrisma.sessionPlayer.findMany.mockResolvedValue([]);
      mockPrisma.sessionPlayer.count.mockResolvedValue(0);

      const result = await service.getEligiblePlayers(mockSession);

      expect(result).toEqual({
        data: [],
        meta: { total: 0, sessionId: 'session-1' },
      });
    });

    it('should rank the lowest play count first with a fairness breakdown', async () => {
      const rows = [
        {
          id: 1,
          playCount: 2,
          checkedInAt: sessionStart,
          lastMatchFinishedAt: null,
          clubMember: {},
          _count: { matchPlayers: 2 },
        },
        {
          id: 2,
          playCount: 0,
          checkedInAt: sessionStart,
          lastMatchFinishedAt: null,
          clubMember: {},
          _count: { matchPlayers: 0 },
        },
      ];
      mockPrisma.sessionPlayer.findMany.mockResolvedValue(rows);
      mockPrisma.sessionPlayer.count.mockResolvedValue(2);

      const result = await service.getEligiblePlayers(mockSession);

      expect(result.meta).toEqual({ total: 2, sessionId: 'session-1' });
      expect(result.data[0].id).toBe(2);
      expect(result.data[0].fairness).toEqual(
        expect.objectContaining({
          playCountScore: 1,
          weights: { equalPlay: 2, waitingTime: 3 },
        }),
      );
    });
  });
});