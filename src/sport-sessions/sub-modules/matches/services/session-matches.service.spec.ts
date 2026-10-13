import { Test, TestingModule } from '@nestjs/testing';
import { SessionMatchesService } from './session-matches.service.js';
import { PrismaService } from '../../../../config/prisma/prisma.service.js';
import { MATCH_DETAIL_INCLUDE } from '../../../shared/constants/sport-sessions.constant.js';
import { MatchStatus } from '../../../../../prisma/generated/prisma/enums.js';
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
});