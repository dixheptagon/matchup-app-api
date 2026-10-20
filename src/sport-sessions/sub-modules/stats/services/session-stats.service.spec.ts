import { Test, TestingModule } from '@nestjs/testing';
import { SessionStatsService } from './session-stats.service.js';
import { PrismaService } from '../../../../config/prisma/prisma.service.js';
import {
  PlayerStatus,
  ScoringType,
  SkillLevel,
} from '../../../../../prisma/generated/prisma/enums.js';
import type { SessionContext } from '../../../shared/types/sport-sessions.types.js';
import {
  PLAYER_SORT_FIELDS,
  PlayerListQueryDto,
} from '../dto/player-list-query.dto.js';

describe('SessionStatsService', () => {
  let service: SessionStatsService;
  let mockPrisma: any;

  const mockSession: SessionContext = {
    id: 'session-1',
    clubId: 'club-1',
    status: 'ACTIVE',
    title: 'Open Play',
    _count: { sessionCourts: 1, players: 4 },
  };

  const d = (value: string) => new Date(value);

  function rosterPlayer(overrides: Record<string, unknown> = {}) {
    return {
      id: 1,
      status: PlayerStatus.WAITING,
      playCount: 0,
      checkedInAt: null,
      lastMatchFinishedAt: null,
      restUntil: null,
      clubMember: {
        displayName: 'Player',
        skillLevel: SkillLevel.BEGINNER,
      },
      ...overrides,
    };
  }

  function leaderboardPlayer(overrides: Record<string, unknown> = {}) {
    return {
      id: 1,
      status: PlayerStatus.WAITING,
      clubMember: {
        displayName: 'Player',
        skillLevel: SkillLevel.BEGINNER,
        gender: null,
        isGuest: false,
      },
      stats: {
        matchesPlayed: 1,
        matchesWon: 0,
        matchesLoss: 1,
        matchesDrawn: 0,
        pointsScored: 10,
        pointsConceded: 21,
        totalPoints: -11,
      },
      ...overrides,
    };
  }

  function query(overrides: Partial<PlayerListQueryDto> = {}) {
    return { sortBy: 'status', order: 'asc', ...overrides } as PlayerListQueryDto;
  }

  function names(rows: { displayName?: string | null; clubMember?: { displayName?: string | null } | null }[]) {
    return rows.map((row: any) => row.clubMember?.displayName ?? row.displayName);
  }

  function ids(rows: { id?: number; sessionPlayerId?: number }[]) {
    return rows.map((row: any) => row.sessionPlayerId ?? row.id);
  }

  beforeEach(async () => {
    mockPrisma = {
      sessionPlayer: { findMany: vi.fn().mockResolvedValue([]) },
      sessionSettings: { findUnique: vi.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionStatsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<SessionStatsService>(SessionStatsService);
  });

  describe('getRoster', () => {
    it('returns every player in the session with their status', async () => {
      mockPrisma.sessionPlayer.findMany.mockResolvedValue([
        rosterPlayer({ id: 1, status: PlayerStatus.PLAYING }),
        rosterPlayer({ id: 2, status: PlayerStatus.RESTING, playCount: 3 }),
      ]);

      const result = await service.getRoster(mockSession, query());

      expect(mockPrisma.sessionPlayer.findMany).toHaveBeenCalledWith({
        where: { sessionId: 'session-1' },
        include: { clubMember: true },
      });
      expect(result.data).toHaveLength(2);
      expect(result.data[0]).toEqual(expect.objectContaining({
        id: 1,
        status: PlayerStatus.PLAYING,
        playCount: 0,
        restUntil: null,
      }));
      expect(result.meta).toEqual({ total: 2, sessionId: 'session-1' });
    });

    it('returns an empty roster for a session with no players', async () => {
      const result = await service.getRoster(mockSession, query());

      expect(result.data).toEqual([]);
      expect(result.meta).toEqual({ total: 0, sessionId: 'session-1' });
    });

    it('defaults to live players first', async () => {
      mockPrisma.sessionPlayer.findMany.mockResolvedValue([
        rosterPlayer({ id: 1, status: PlayerStatus.LEFT }),
        rosterPlayer({ id: 2, status: PlayerStatus.WAITING }),
        rosterPlayer({ id: 3, status: PlayerStatus.PLAYING }),
      ]);

      const result = await service.getRoster(mockSession, query());

      expect(ids(result.data)).toEqual([3, 2, 1]);
    });

    it('reverses the status priority for descending order', async () => {
      mockPrisma.sessionPlayer.findMany.mockResolvedValue([
        rosterPlayer({ id: 1, status: PlayerStatus.LEFT }),
        rosterPlayer({ id: 2, status: PlayerStatus.WAITING }),
        rosterPlayer({ id: 3, status: PlayerStatus.PLAYING }),
      ]);

      const result = await service.getRoster(
        mockSession,
        query({ order: 'desc' }),
      );

      expect(ids(result.data)).toEqual([1, 2, 3]);
    });

    it('sorts by play count descending', async () => {
      mockPrisma.sessionPlayer.findMany.mockResolvedValue([
        rosterPlayer({ id: 1, playCount: 0 }),
        rosterPlayer({ id: 2, playCount: 5 }),
        rosterPlayer({ id: 3, playCount: 2 }),
      ]);

      const result = await service.getRoster(
        mockSession,
        query({ sortBy: 'playCount', order: 'desc' }),
      );

      expect(ids(result.data)).toEqual([2, 3, 1]);
    });

    it('treats a missing play count as zero', async () => {
      mockPrisma.sessionPlayer.findMany.mockResolvedValue([
        rosterPlayer({ id: 1, playCount: 4 }),
        rosterPlayer({ id: 2, playCount: null }),
      ]);

      const result = await service.getRoster(
        mockSession,
        query({ sortBy: 'playCount', order: 'desc' }),
      );

      expect(ids(result.data)).toEqual([1, 2]);
    });

    it('places missing restUntil last when sorting ascending', async () => {
      mockPrisma.sessionPlayer.findMany.mockResolvedValue([
        rosterPlayer({ id: 1, restUntil: d('2026-01-02T00:00:00Z') }),
        rosterPlayer({ id: 2, restUntil: null }),
        rosterPlayer({ id: 3, restUntil: d('2026-01-01T00:00:00Z') }),
      ]);

      const result = await service.getRoster(
        mockSession,
        query({ sortBy: 'restUntil', order: 'asc' }),
      );

      expect(ids(result.data)).toEqual([3, 1, 2]);
    });

    it('places missing restUntil first when sorting descending', async () => {
      mockPrisma.sessionPlayer.findMany.mockResolvedValue([
        rosterPlayer({ id: 1, restUntil: d('2026-01-02T00:00:00Z') }),
        rosterPlayer({ id: 2, restUntil: null }),
        rosterPlayer({ id: 3, restUntil: d('2026-01-01T00:00:00Z') }),
      ]);

      const result = await service.getRoster(
        mockSession,
        query({ sortBy: 'restUntil', order: 'desc' }),
      );

      expect(ids(result.data)).toEqual([2, 1, 3]);
    });

    it('places missing checkedInAt last when sorting ascending', async () => {
      mockPrisma.sessionPlayer.findMany.mockResolvedValue([
        rosterPlayer({ id: 1, checkedInAt: d('2026-01-02T00:00:00Z') }),
        rosterPlayer({ id: 2, checkedInAt: null }),
        rosterPlayer({ id: 3, checkedInAt: d('2026-01-01T00:00:00Z') }),
      ]);

      const result = await service.getRoster(
        mockSession,
        query({ sortBy: 'checkedInAt', order: 'asc' }),
      );

      expect(ids(result.data)).toEqual([3, 1, 2]);
    });

    it('places missing lastMatchFinishedAt first when sorting descending', async () => {
      mockPrisma.sessionPlayer.findMany.mockResolvedValue([
        rosterPlayer({ id: 1, lastMatchFinishedAt: d('2026-01-02T00:00:00Z') }),
        rosterPlayer({ id: 2, lastMatchFinishedAt: null }),
        rosterPlayer({ id: 3, lastMatchFinishedAt: d('2026-01-01T00:00:00Z') }),
      ]);

      const result = await service.getRoster(
        mockSession,
        query({ sortBy: 'lastMatchFinishedAt', order: 'desc' }),
      );

      expect(ids(result.data)).toEqual([2, 1, 3]);
    });

    it('sorts by display name ascending', async () => {
      mockPrisma.sessionPlayer.findMany.mockResolvedValue([
        rosterPlayer({ id: 1, clubMember: { displayName: 'Zoe', skillLevel: SkillLevel.BEGINNER } }),
        rosterPlayer({ id: 2, clubMember: { displayName: 'Ada', skillLevel: SkillLevel.BEGINNER } }),
        rosterPlayer({ id: 3, clubMember: { displayName: 'Ben', skillLevel: SkillLevel.BEGINNER } }),
      ]);

      const result = await service.getRoster(
        mockSession,
        query({ sortBy: 'displayName', order: 'asc' }),
      );

      expect(names(result.data)).toEqual(['Ada', 'Ben', 'Zoe']);
    });

    it('sorts by skill level ascending', async () => {
      mockPrisma.sessionPlayer.findMany.mockResolvedValue([
        rosterPlayer({ id: 1, clubMember: { displayName: 'A', skillLevel: SkillLevel.ADVANCE } }),
        rosterPlayer({ id: 2, clubMember: { displayName: 'B', skillLevel: SkillLevel.NEWBIE } }),
        rosterPlayer({ id: 3, clubMember: { displayName: 'C', skillLevel: SkillLevel.INTERMEDIATE } }),
      ]);

      const result = await service.getRoster(
        mockSession,
        query({ sortBy: 'skillLevel', order: 'asc' }),
      );

      expect(names(result.data)).toEqual(['B', 'C', 'A']);
    });

    it('breaks ties by name then id', async () => {
      mockPrisma.sessionPlayer.findMany.mockResolvedValue([
        rosterPlayer({ id: 2, status: PlayerStatus.WAITING, clubMember: { displayName: 'Ben', skillLevel: SkillLevel.BEGINNER } }),
        rosterPlayer({ id: 3, status: PlayerStatus.WAITING, clubMember: { displayName: 'Ada', skillLevel: SkillLevel.BEGINNER } }),
        rosterPlayer({ id: 1, status: PlayerStatus.WAITING, clubMember: { displayName: 'Ada', skillLevel: SkillLevel.BEGINNER } }),
      ]);

      const result = await service.getRoster(mockSession, query());

      expect(ids(result.data)).toEqual([1, 3, 2]);
    });
  });

  describe('getLeaderboard', () => {
    it('returns an empty leaderboard when scoring is off', async () => {
      mockPrisma.sessionSettings.findUnique.mockResolvedValue({
        leaderBoardMode: ScoringType.OFF,
      });

      const result = await service.getLeaderboard(mockSession);

      expect(result.data).toEqual([]);
      expect(result.meta).toEqual({
        mode: ScoringType.OFF,
        total: 0,
        sessionId: 'session-1',
      });
      expect(mockPrisma.sessionPlayer.findMany).not.toHaveBeenCalled();
    });

    it('treats missing session settings as off', async () => {
      mockPrisma.sessionSettings.findUnique.mockResolvedValue(null);

      const result = await service.getLeaderboard(mockSession);

      expect(result.data).toEqual([]);
      expect(result.meta.mode).toBe(ScoringType.OFF);
    });

    it('reads every player with their stats', async () => {
      mockPrisma.sessionSettings.findUnique.mockResolvedValue({
        leaderBoardMode: ScoringType.WINS,
      });
      mockPrisma.sessionPlayer.findMany.mockResolvedValue([
        leaderboardPlayer({ id: 1 }),
      ]);

      await service.getLeaderboard(mockSession);

      expect(mockPrisma.sessionPlayer.findMany).toHaveBeenCalledWith({
        where: { sessionId: 'session-1' },
        include: { clubMember: true, stats: true },
      });
    });

    it('ranks by net points in SCORE_DIFF mode', async () => {
      mockPrisma.sessionSettings.findUnique.mockResolvedValue({
        leaderBoardMode: ScoringType.SCORE_DIFF,
      });
      mockPrisma.sessionPlayer.findMany.mockResolvedValue([
        leaderboardPlayer({
          id: 1,
          clubMember: { displayName: 'Ada', skillLevel: SkillLevel.BEGINNER, gender: null, isGuest: false },
          stats: { matchesPlayed: 2, matchesWon: 1, matchesLoss: 1, matchesDrawn: 0, pointsScored: 40, pointsConceded: 35, totalPoints: 5 },
        }),
        leaderboardPlayer({
          id: 2,
          clubMember: { displayName: 'Ben', skillLevel: SkillLevel.BEGINNER, gender: null, isGuest: false },
          stats: { matchesPlayed: 3, matchesWon: 0, matchesLoss: 3, matchesDrawn: 0, pointsScored: 30, pointsConceded: 63, totalPoints: -33 },
        }),
        leaderboardPlayer({
          id: 3,
          clubMember: { displayName: 'Zoe', skillLevel: SkillLevel.BEGINNER, gender: null, isGuest: false },
          stats: { matchesPlayed: 4, matchesWon: 3, matchesLoss: 1, matchesDrawn: 0, pointsScored: 80, pointsConceded: 60, totalPoints: 20 },
        }),
      ]);

      const result = await service.getLeaderboard(mockSession);

      expect(ids(result.data)).toEqual([3, 1, 2]);
      expect(result.meta.mode).toBe(ScoringType.SCORE_DIFF);
      expect(result.meta.total).toBe(3);
    });

    it('ranks by wins in WINS mode', async () => {
      mockPrisma.sessionSettings.findUnique.mockResolvedValue({
        leaderBoardMode: ScoringType.WINS,
      });
      mockPrisma.sessionPlayer.findMany.mockResolvedValue([
        leaderboardPlayer({
          id: 1,
          clubMember: { displayName: 'Ada', skillLevel: SkillLevel.BEGINNER, gender: null, isGuest: false },
          stats: { matchesPlayed: 3, matchesWon: 2, matchesLoss: 1, matchesDrawn: 0, pointsScored: 60, pointsConceded: 50, totalPoints: 10 },
        }),
        leaderboardPlayer({
          id: 2,
          clubMember: { displayName: 'Ben', skillLevel: SkillLevel.BEGINNER, gender: null, isGuest: false },
          stats: { matchesPlayed: 3, matchesWon: 3, matchesLoss: 0, matchesDrawn: 0, pointsScored: 70, pointsConceded: 40, totalPoints: 30 },
        }),
        leaderboardPlayer({
          id: 3,
          clubMember: { displayName: 'Zoe', skillLevel: SkillLevel.BEGINNER, gender: null, isGuest: false },
          stats: { matchesPlayed: 3, matchesWon: 1, matchesLoss: 2, matchesDrawn: 0, pointsScored: 45, pointsConceded: 60, totalPoints: -15 },
        }),
      ]);

      const result = await service.getLeaderboard(mockSession);

      expect(ids(result.data)).toEqual([2, 1, 3]);
      expect(result.meta.mode).toBe(ScoringType.WINS);
    });

    it('breaks ties by name', async () => {
      mockPrisma.sessionSettings.findUnique.mockResolvedValue({
        leaderBoardMode: ScoringType.SCORE_DIFF,
      });
      mockPrisma.sessionPlayer.findMany.mockResolvedValue([
        leaderboardPlayer({
          id: 1,
          clubMember: { displayName: 'Zoe', skillLevel: SkillLevel.BEGINNER, gender: null, isGuest: false },
          stats: { matchesPlayed: 1, matchesWon: 1, matchesLoss: 0, matchesDrawn: 0, pointsScored: 21, pointsConceded: 18, totalPoints: 3 },
        }),
        leaderboardPlayer({
          id: 2,
          clubMember: { displayName: 'Ada', skillLevel: SkillLevel.BEGINNER, gender: null, isGuest: false },
          stats: { matchesPlayed: 1, matchesWon: 1, matchesLoss: 0, matchesDrawn: 0, pointsScored: 21, pointsConceded: 18, totalPoints: 3 },
        }),
      ]);

      const result = await service.getLeaderboard(mockSession);

      expect(names(result.data)).toEqual(['Ada', 'Zoe']);
      expect(result.data.map((r: any) => r.rank)).toEqual([1, 2]);
    });

    it('fills in zeros for players without stats', async () => {
      mockPrisma.sessionSettings.findUnique.mockResolvedValue({
        leaderBoardMode: ScoringType.WINS,
      });
      mockPrisma.sessionPlayer.findMany.mockResolvedValue([
        leaderboardPlayer({ id: 1, stats: null, clubMember: { displayName: 'Ada', skillLevel: SkillLevel.BEGINNER, gender: null, isGuest: true } }),
      ]);

      const result = await service.getLeaderboard(mockSession);

      expect(result.data[0]).toEqual({
        rank: 1,
        sessionPlayerId: 1,
        status: PlayerStatus.WAITING,
        displayName: 'Ada',
        skillLevel: SkillLevel.BEGINNER,
        gender: null,
        isGuest: true,
        matchesPlayed: 0,
        matchesWon: 0,
        matchesLoss: 0,
        matchesDrawn: 0,
        pointsScored: 0,
        pointsConceded: 0,
        totalPoints: 0,
      });
    });

    it('assigns sequential ranks', async () => {
      mockPrisma.sessionSettings.findUnique.mockResolvedValue({
        leaderBoardMode: ScoringType.WINS,
      });
      mockPrisma.sessionPlayer.findMany.mockResolvedValue([
        leaderboardPlayer({
          id: 1,
          stats: { matchesPlayed: 2, matchesWon: 2, matchesLoss: 0, matchesDrawn: 0, pointsScored: 42, pointsConceded: 30, totalPoints: 12 },
        }),
        leaderboardPlayer({
          id: 2,
          stats: { matchesPlayed: 2, matchesWon: 1, matchesLoss: 1, matchesDrawn: 0, pointsScored: 35, pointsConceded: 35, totalPoints: 0 },
        }),
        leaderboardPlayer({
          id: 3,
          stats: { matchesPlayed: 2, matchesWon: 0, matchesLoss: 2, matchesDrawn: 0, pointsScored: 20, pointsConceded: 45, totalPoints: -25 },
        }),
      ]);

      const result = await service.getLeaderboard(mockSession);

      expect(result.data.map((r: any) => r.rank)).toEqual([1, 2, 3]);
      expect(ids(result.data)).toEqual([1, 2, 3]);
    });

    it('exposes the stat counters the UI needs', async () => {
      mockPrisma.sessionSettings.findUnique.mockResolvedValue({
        leaderBoardMode: ScoringType.SCORE_DIFF,
      });
      mockPrisma.sessionPlayer.findMany.mockResolvedValue([
        leaderboardPlayer({
          id: 7,
          clubMember: { displayName: 'Ada', skillLevel: SkillLevel.INTERMEDIATE, gender: 'FEMALE', isGuest: false },
          stats: { matchesPlayed: 5, matchesWon: 4, matchesLoss: 1, matchesDrawn: 0, pointsScored: 105, pointsConceded: 82, totalPoints: 23 },
        }),
      ]);

      const result = await service.getLeaderboard(mockSession);

      expect(result.data[0]).toEqual({
        rank: 1,
        sessionPlayerId: 7,
        status: PlayerStatus.WAITING,
        displayName: 'Ada',
        skillLevel: SkillLevel.INTERMEDIATE,
        gender: 'FEMALE',
        isGuest: false,
        matchesPlayed: 5,
        matchesWon: 4,
        matchesLoss: 1,
        matchesDrawn: 0,
        pointsScored: 105,
        pointsConceded: 82,
        totalPoints: 23,
      });
    });
  });

  describe('PlayerListQueryDto', () => {
    it('defaults to status ascending', () => {
      const dto = new PlayerListQueryDto();
      expect(dto.sortBy).toBe('status');
      expect(dto.order).toBe('asc');
    });

    it('exposes every documented sort field', () => {
      expect([...PLAYER_SORT_FIELDS].sort()).toEqual(
        [
          'checkedInAt',
          'displayName',
          'lastMatchFinishedAt',
          'playCount',
          'restUntil',
          'skillLevel',
          'status',
        ].sort(),
      );
    });
  });
});
