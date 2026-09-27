import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { SportSessionsService } from './sport-sessions.service.js';
import { PrismaService } from '../config/prisma/prisma.service.js';
import type { SessionContext } from './sport-sessions.types.js';
import type { SportClub } from '../../prisma/generated/prisma/client.js';

describe('SportSessionsService', () => {
  let service: SportSessionsService;
  let mockPrisma: any;

  const mockClub: SportClub = {
    id: 'club-1',
    ownerId: 'owner-1',
    name: 'Test Club',
    slug: 'test-club',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockClubSettings = {
    id: 1,
    clubId: 'club-1',
    defaultSport: 'TENNIS',
    trackMatchScore: true,
    allowEndWithoutScore: false,
    attendanceCheckIn: true,
    lateJoinerPolicy: null,
    leaderBoardMode: 'WINS',
    pointsToWin: 11,
    queueDepth: 5,
    autoMatchMaking: true,
    matchMakingMode: 'BALANCED',
    equalPlayPriority: 'MEDIUM',
    balancedTeams: 'HIGH',
    partnerVariety: 'MEDIUM',
    opponentVariety: 'MEDIUM',
    prioritizeWaitingPlayers: 'HIGH',
    minimumRestTime: 5,
    carryBalance: 'LOW',
    carryEvaluation: 'LOW',
    genderPreference: null,
    fairnessThreshold: 10,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockSession: SessionContext = {
    id: 'session-1',
    clubId: 'club-1',
    status: 'DRAFT',
    title: 'Open Play 2026-09-23',
    _count: { sessionCourts: 1, players: 4 },
  };

  beforeEach(async () => {
    mockPrisma = {
      sportSession: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        count: vi.fn(),
      },
      clubSettings: { findUnique: vi.fn() },
      sessionSettings: { update: vi.fn() },
      sessionCourt: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        createMany: vi.fn(),
        deleteMany: vi.fn(),
        delete: vi.fn(),
      },
      sessionPlayer: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        createMany: vi.fn(),
        create: vi.fn(),
        deleteMany: vi.fn(),
        delete: vi.fn(),
      },
      clubMember: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
      },
      court: { findMany: vi.fn() },
      sessionMatch: { count: vi.fn() },
      matchPlayer: { count: vi.fn() },
    };
    mockPrisma.$transaction = vi.fn(
      async (arg: ((tx: unknown) => Promise<unknown>) | Promise<unknown>[]) =>
        typeof arg === 'function' ? arg(mockPrisma) : Promise.all(arg),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SportSessionsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<SportSessionsService>(SportSessionsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should snapshot club settings (without row metadata) as DRAFT', async () => {
      mockPrisma.clubSettings.findUnique.mockResolvedValue(mockClubSettings);
      mockPrisma.sportSession.count.mockResolvedValue(0);
      mockPrisma.sportSession.create.mockResolvedValue({});

      await service.create(mockClub, { title: 'Friday Night' });

      expect(mockPrisma.sportSession.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            clubId: 'club-1',
            title: 'Friday Night',
            status: 'DRAFT',
            sessionSettings: {
              create: expect.objectContaining({
                defaultSport: 'TENNIS',
                leaderBoardMode: 'WINS',
                pointsToWin: 11,
              }),
            },
          }),
        }),
      );

      const createdSettings =
        mockPrisma.sportSession.create.mock.calls[0][0].data.sessionSettings
          .create;
      expect(createdSettings).not.toHaveProperty('clubId');
      expect(createdSettings).not.toHaveProperty('id');
      expect(createdSettings).not.toHaveProperty('createdAt');
      expect(createdSettings).not.toHaveProperty('updatedAt');
    });

    it('should fall back to DEFAULT_CLUB_SETTINGS when the club has none', async () => {
      mockPrisma.clubSettings.findUnique.mockResolvedValue(null);
      mockPrisma.sportSession.count.mockResolvedValue(0);
      mockPrisma.sportSession.create.mockResolvedValue({});

      await service.create(mockClub, {});

      expect(mockPrisma.sportSession.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: expect.stringContaining('Open Play'),
            sessionSettings: {
              create: expect.objectContaining({ defaultSport: 'BADMINTON' }),
            },
          }),
        }),
      );
    });
  });

  describe('findAllByClub', () => {
    it('should return a paginated list', async () => {
      mockPrisma.sportSession.findMany.mockResolvedValue([mockSession]);
      mockPrisma.sportSession.count.mockResolvedValue(1);

      const result = await service.findAllByClub(mockClub, 1, 10, {
        status: 'DRAFT',
      });

      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual({ page: 1, limit: 10, total: 1 });
      expect(mockPrisma.sportSession.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { clubId: 'club-1', status: 'DRAFT' },
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return the resolved session', async () => {
      const result = await service.findOne(mockSession);

      expect(result).toEqual(mockSession);
    });
  });

  describe('findPublicBySlug', () => {
    it('should return the public projection', async () => {
      mockPrisma.sportSession.findUnique.mockResolvedValue({
        title: 'Open Play',
      });

      const result = await service.findPublicBySlug('open-play');

      expect(result).toEqual({ title: 'Open Play' });
    });

    it('should throw NotFoundException when not found', async () => {
      mockPrisma.sportSession.findUnique.mockResolvedValue(null);

      await expect(service.findPublicBySlug('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateDetails', () => {
    it('should regenerate the slug when the title changes', async () => {
      mockPrisma.sportSession.count.mockResolvedValue(0);
      mockPrisma.sportSession.update.mockResolvedValue(mockSession);

      await service.updateDetails(mockSession, { title: 'New Title' });

      expect(mockPrisma.sportSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: 'New Title',
            slug: 'new-title',
          }),
        }),
      );
    });

    it('should not regenerate the slug when the title is unchanged', async () => {
      mockPrisma.sportSession.update.mockResolvedValue(mockSession);

      await service.updateDetails(mockSession, { title: mockSession.title });

      expect(mockPrisma.sportSession.count).not.toHaveBeenCalled();
      expect(mockPrisma.sportSession.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { title: mockSession.title } }),
      );
    });
  });

  describe('updateSettings', () => {
    it('should allow any field on a draft session', async () => {
      mockPrisma.sessionSettings.update.mockResolvedValue({});

      await service.updateSettings(mockSession, { defaultSport: 'PADEL' });

      expect(mockPrisma.sessionSettings.update).toHaveBeenCalledWith({
        where: { sessionId: 'session-1' },
        data: { defaultSport: 'PADEL' },
      });
    });

    it('should allow whitelisted fields while active', async () => {
      mockPrisma.sessionSettings.update.mockResolvedValue({});

      await service.updateSettings(
        { ...mockSession, status: 'ACTIVE' },
        { leaderBoardMode: 'SCORE_DIFF', pointsToWin: 21 },
      );

      expect(mockPrisma.sessionSettings.update).toHaveBeenCalled();
    });

    it('should reject non-whitelisted fields while active', async () => {
      await expect(
        service.updateSettings(
          { ...mockSession, status: 'ACTIVE' },
          { defaultSport: 'PADEL' },
        ),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.sessionSettings.update).not.toHaveBeenCalled();
    });
  });

  describe('setCourts', () => {
    it('should reject when a court is invalid or inactive', async () => {
      mockPrisma.court.findMany.mockResolvedValue([{ id: 1 }]);

      await expect(
        service.setCourts(mockSession, { courtIds: [1, 2] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should replace the courts on success', async () => {
      mockPrisma.court.findMany.mockResolvedValue([{ id: 1 }, { id: 2 }]);
      mockPrisma.sessionCourt.findMany.mockResolvedValue([]);

      await service.setCourts(mockSession, { courtIds: [1, 2] });

      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockPrisma.sessionCourt.deleteMany).toHaveBeenCalledWith({
        where: { sessionId: 'session-1', courtId: { notIn: [1, 2] } },
      });
      expect(mockPrisma.sessionCourt.createMany).toHaveBeenCalledWith({
        data: [
          { sessionId: 'session-1', courtId: 1 },
          { sessionId: 'session-1', courtId: 2 },
        ],
        skipDuplicates: true,
      });
    });
  });

  describe('addGuest', () => {
    it('should reject a duplicate display name', async () => {
      mockPrisma.clubMember.findFirst.mockResolvedValue({ id: 'm1' });

      await expect(
        service.addGuest(mockSession, { displayName: 'John' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should create the guest member and add them as a player', async () => {
      mockPrisma.clubMember.findFirst.mockResolvedValue(null);
      mockPrisma.clubMember.create.mockResolvedValue({
        id: 'guest-1',
        displayName: 'John',
      });
      mockPrisma.sessionPlayer.create.mockResolvedValue({ id: 10 });

      const result = await service.addGuest(mockSession, {
        displayName: 'John',
      });

      expect(mockPrisma.clubMember.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            clubId: 'club-1',
            displayName: 'John',
            isGuest: true,
            createdBySessionId: 'session-1',
          }),
        }),
      );
      expect(result).toEqual({ id: 10 });
    });
  });

  describe('start', () => {
    it('should require at least one court', async () => {
      await expect(
        service.start({
          ...mockSession,
          _count: { sessionCourts: 0, players: 4 },
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should require at least four players', async () => {
      await expect(
        service.start({
          ...mockSession,
          _count: { sessionCourts: 1, players: 3 },
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should activate the session when prerequisites are met', async () => {
      mockPrisma.sportSession.update.mockResolvedValue({
        ...mockSession,
        status: 'ACTIVE',
      });

      const result = await service.start(mockSession);

      expect(result.status).toBe('ACTIVE');
      expect(mockPrisma.sportSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'ACTIVE',
            startedAt: expect.any(Date),
          }),
        }),
      );
    });
  });

  describe('remove', () => {
    it('should delete the session', async () => {
      mockPrisma.sportSession.delete.mockResolvedValue(mockSession);

      const result = await service.remove(mockSession);

      expect(result.message).toBe('Session deleted successfully');
      expect(mockPrisma.sportSession.delete).toHaveBeenCalledWith({
        where: { id: 'session-1' },
      });
    });
  });
});
