import { Test, TestingModule } from '@nestjs/testing';
import { PlayerPoolService } from './session-player-eligibility.service.js';
import { PrismaService } from '../../../../config/prisma/prisma.service.js';
import {
  MatchStatus,
  PlayerStatus,
} from '../../../../../prisma/generated/prisma/enums.js';
import type { SessionContext } from '../../../shared/types/sport-sessions.types.js';

describe('PlayerPoolService', () => {
  let service: PlayerPoolService;
  let mockPrisma: any;

  const mockSession: SessionContext = {
    id: 'session-1',
    clubId: 'club-1',
    status: 'ACTIVE',
    title: 'Open Play 2026-09-23',
    _count: { sessionCourts: 1, players: 4 },
  };

  beforeEach(async () => {
    mockPrisma = {
      sessionPlayer: { findMany: vi.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlayerPoolService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<PlayerPoolService>(PlayerPoolService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getEligiblePlayers', () => {
    it('should query WAITING players scoped to the session', async () => {
      mockPrisma.sessionPlayer.findMany.mockResolvedValue([]);

      await service.getEligiblePlayers(mockSession);

      const args = mockPrisma.sessionPlayer.findMany.mock.calls[0][0];
      expect(args.where.sessionId).toBe('session-1');
      expect(args.where.status).toBe(PlayerStatus.WAITING);
    });

    it('should exclude players committed to an unfinished match', async () => {
      mockPrisma.sessionPlayer.findMany.mockResolvedValue([]);

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

    it('should include clubMember and order by wait time then id', async () => {
      mockPrisma.sessionPlayer.findMany.mockResolvedValue([]);

      await service.getEligiblePlayers(mockSession);

      const args = mockPrisma.sessionPlayer.findMany.mock.calls[0][0];
      expect(args.include).toEqual({ clubMember: true });
      expect(args.orderBy).toEqual([{ checkedInAt: 'asc' }, { id: 'asc' }]);
    });

    it('should return an empty array when nobody is waiting', async () => {
      mockPrisma.sessionPlayer.findMany.mockResolvedValue([]);

      const result = await service.getEligiblePlayers(mockSession);

      expect(result).toEqual([]);
    });

    it('should return the players untouched', async () => {
      const rows = [
        { id: 1, status: PlayerStatus.WAITING, playCount: 2 },
        { id: 2, status: PlayerStatus.WAITING, playCount: 0 },
      ];
      mockPrisma.sessionPlayer.findMany.mockResolvedValue(rows);

      const result = await service.getEligiblePlayers(mockSession);

      expect(result).toEqual(rows);
    });
  });
});
