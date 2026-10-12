import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SessionMatchmakingService } from './session-matchmaking.service.js';
import { MatchCompositionService } from './match-composition.service.js';
import { PrismaService } from '../../../../config/prisma/prisma.service.js';
import { PlayerWeightingService } from '../../players/services/player-weighting.service.js';
import {
  GenerateType,
  MatchMakingMode,
  MatchStatus,
  PlayerStatus,
  SkillLevel,
} from '../../../../../prisma/generated/prisma/enums.js';
import type { SessionContext } from '../../../shared/types/sport-sessions.types.js';

describe('SessionMatchmakingService', () => {
  let service: SessionMatchmakingService;
  let mockPrisma: any;
  let composition: { compose: ReturnType<typeof vi.fn> };

  const mockSession: SessionContext = {
    id: 'session-1',
    clubId: 'club-1',
    status: 'ACTIVE',
    title: 'Open Play',
    startedAt: new Date('2026-09-23T10:00:00.000Z'),
    sessionSettings: { attendanceCheckIn: true },
    _count: { sessionCourts: 1, players: 4 },
  };

  const settings = {
    sessionId: 'session-1',
    autoMatchMaking: true,
    matchMakingMode: MatchMakingMode.BALANCED,
    genderPreference: null,
    equalPlayPriority: 'MEDIUM',
    prioritizeWaitingPlayers: 'HIGH',
    lateJoinerPolicy: 'EQUAL_PLAY_CATCHUP',
    fairnessThreshold: 10,
  };

  const eligibleRows = [
    {
      id: 1,
      playCount: 0,
      checkedInAt: new Date('2026-09-23T10:00:00.000Z'),
      lastMatchFinishedAt: null,
      clubMember: { skillLevel: SkillLevel.BEGINNER, gender: null },
    },
    {
      id: 2,
      playCount: 0,
      checkedInAt: new Date('2026-09-23T10:00:00.000Z'),
      lastMatchFinishedAt: null,
      clubMember: { skillLevel: SkillLevel.BEGINNER, gender: null },
    },
    {
      id: 3,
      playCount: 0,
      checkedInAt: new Date('2026-09-23T10:00:00.000Z'),
      lastMatchFinishedAt: null,
      clubMember: { skillLevel: SkillLevel.BEGINNER, gender: null },
    },
    {
      id: 4,
      playCount: 0,
      checkedInAt: new Date('2026-09-23T10:00:00.000Z'),
      lastMatchFinishedAt: null,
      clubMember: { skillLevel: SkillLevel.BEGINNER, gender: null },
    },
  ];

  beforeEach(async () => {
    mockPrisma = {
      sessionSettings: { findUnique: vi.fn() },
      sessionPlayer: {
        findMany: vi.fn(),
        updateMany: vi.fn(),
      },
      sessionMatch: {
        findFirst: vi.fn(),
        create: vi.fn(),
        findUnique: vi.fn(),
      },
      matchPlayer: {
        findMany: vi.fn(),
        createMany: vi.fn(),
      },
    };
    mockPrisma.$transaction = vi.fn(
      async (arg: unknown) =>
        typeof arg === 'function'
          ? (arg as Function)(mockPrisma)
          : Promise.all(arg as Promise<unknown>[]),
    );

    composition = {
      compose: vi.fn().mockReturnValue({
        teamA: [1, 2],
        teamB: [3, 4],
        selected: [1, 2, 3, 4],
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionMatchmakingService,
        PlayerWeightingService,
        { provide: MatchCompositionService, useValue: composition },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<SessionMatchmakingService>(SessionMatchmakingService);
  });

  function primeAutoPath() {
    mockPrisma.sessionSettings.findUnique.mockResolvedValue(settings);
    mockPrisma.sessionPlayer.findMany.mockResolvedValue(eligibleRows);
    mockPrisma.sessionMatch.findFirst.mockResolvedValue({ sequence: 7 });
    mockPrisma.sessionMatch.create.mockResolvedValue({ id: 'match-1' });
    mockPrisma.sessionMatch.findUnique.mockResolvedValue({ id: 'match-1' });
  }

  describe('autoMatch', () => {
    it('rejects when auto matchmaking is disabled', async () => {
      mockPrisma.sessionSettings.findUnique.mockResolvedValue({
        ...settings,
        autoMatchMaking: false,
      });

      await expect(service.autoMatch(mockSession)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockPrisma.sessionMatch.create).not.toHaveBeenCalled();
    });

    it('rejects when there are not enough waiting players', async () => {
      mockPrisma.sessionSettings.findUnique.mockResolvedValue(settings);
      mockPrisma.sessionPlayer.findMany.mockResolvedValue(eligibleRows.slice(0, 3));

      await expect(service.autoMatch(mockSession)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockPrisma.sessionMatch.create).not.toHaveBeenCalled();
    });

    it('creates a court-less QUEUED match with an incrementing sequence', async () => {
      primeAutoPath();

      await service.autoMatch(mockSession);

      expect(mockPrisma.sessionMatch.create).toHaveBeenCalledWith({
        data: {
          sessionId: 'session-1',
          sessionCourtId: null,
          sequence: 8,
          status: MatchStatus.QUEUED,
          generatedBy: GenerateType.AUTO,
        },
      });
    });

    it('delegates selection to the composition service', async () => {
      primeAutoPath();

      await service.autoMatch(mockSession);

      expect(composition.compose).toHaveBeenCalledWith(
        expect.any(Array),
        {
          mode: MatchMakingMode.BALANCED,
          genderPreference: null,
        },
      );
    });

    it('persists four match players across both teams', async () => {
      primeAutoPath();

      await service.autoMatch(mockSession);

      expect(mockPrisma.matchPlayer.createMany).toHaveBeenCalledWith({
        data: [
          { matchId: 'match-1', sessionPlayerId: 1, team: 'TEAM_A', position: 1 },
          { matchId: 'match-1', sessionPlayerId: 2, team: 'TEAM_A', position: 2 },
          { matchId: 'match-1', sessionPlayerId: 3, team: 'TEAM_B', position: 1 },
          { matchId: 'match-1', sessionPlayerId: 4, team: 'TEAM_B', position: 2 },
        ],
      });
    });

    it('reserves the matched players', async () => {
      primeAutoPath();

      await service.autoMatch(mockSession);

      expect(mockPrisma.sessionPlayer.updateMany).toHaveBeenCalledWith({
        where: { id: { in: [1, 2, 3, 4] } },
        data: { status: PlayerStatus.RESERVED },
      });
    });

    it('runs every write inside a single serializable transaction', async () => {
      primeAutoPath();

      await service.autoMatch(mockSession);

      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      expect(mockPrisma.$transaction).toHaveBeenCalledWith(
        expect.any(Function),
        { isolationLevel: 'Serializable' },
      );
    });
  });

  describe('createManualMatch', () => {
    beforeEach(() => {
      mockPrisma.sessionPlayer.findMany.mockResolvedValue([
        { id: 1, status: PlayerStatus.WAITING },
        { id: 2, status: PlayerStatus.WAITING },
        { id: 3, status: PlayerStatus.WAITING },
        { id: 4, status: PlayerStatus.WAITING },
      ]);
      mockPrisma.matchPlayer.findMany.mockResolvedValue([]);
      mockPrisma.sessionMatch.findFirst.mockResolvedValue({ sequence: 0 });
      mockPrisma.sessionMatch.create.mockResolvedValue({ id: 'match-2' });
      mockPrisma.sessionMatch.findUnique.mockResolvedValue({ id: 'match-2' });
    });

    it('rejects duplicate players across teams', async () => {
      await expect(
        service.createManualMatch(mockSession, {
          teamA: [1, 2],
          teamB: [2, 3],
        }),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.sessionMatch.create).not.toHaveBeenCalled();
    });

    it('rejects players that are not in the session', async () => {
      mockPrisma.sessionPlayer.findMany.mockResolvedValue([
        { id: 1, status: PlayerStatus.WAITING },
        { id: 2, status: PlayerStatus.WAITING },
      ]);

      await expect(
        service.createManualMatch(mockSession, {
          teamA: [1, 2],
          teamB: [3, 4],
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects players that are not waiting', async () => {
      mockPrisma.sessionPlayer.findMany.mockResolvedValue([
        { id: 1, status: PlayerStatus.WAITING },
        { id: 2, status: PlayerStatus.PLAYING },
        { id: 3, status: PlayerStatus.WAITING },
        { id: 4, status: PlayerStatus.WAITING },
      ]);

      await expect(
        service.createManualMatch(mockSession, {
          teamA: [1, 2],
          teamB: [3, 4],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects players already committed to an unfinished match', async () => {
      mockPrisma.matchPlayer.findMany.mockResolvedValue([
        { sessionPlayerId: 3 },
      ]);

      await expect(
        service.createManualMatch(mockSession, {
          teamA: [1, 2],
          teamB: [3, 4],
        }),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.sessionMatch.create).not.toHaveBeenCalled();
    });

    it('creates the match using the admin supplied teams', async () => {
      await service.createManualMatch(mockSession, {
        teamA: [1, 2],
        teamB: [3, 4],
      });

      expect(mockPrisma.sessionMatch.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          generatedBy: GenerateType.MANUAL,
          status: MatchStatus.QUEUED,
          sessionCourtId: null,
        }),
      });
      expect(composition.compose).not.toHaveBeenCalled();
      expect(mockPrisma.matchPlayer.createMany).toHaveBeenCalledWith({
        data: [
          { matchId: 'match-2', sessionPlayerId: 1, team: 'TEAM_A', position: 1 },
          { matchId: 'match-2', sessionPlayerId: 2, team: 'TEAM_A', position: 2 },
          { matchId: 'match-2', sessionPlayerId: 3, team: 'TEAM_B', position: 1 },
          { matchId: 'match-2', sessionPlayerId: 4, team: 'TEAM_B', position: 2 },
        ],
      });
    });
  });
});