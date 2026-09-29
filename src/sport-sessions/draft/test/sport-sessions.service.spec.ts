import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SportSessionsService } from '../sport-sessions.service.js';
import { PrismaService } from '../../../config/prisma/prisma.service.js';
import type { SessionContext } from '../sport-sessions.types.js';
import type { SportClub } from '../../../../prisma/generated/prisma/client.js';

describe('SportSessionsService', () => {
  let service: SportSessionsService;
  let mockPrisma: {
    sportSession: {
      findUnique: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
    };
    clubSettings: { findUnique: ReturnType<typeof vi.fn> };
  };

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
    };

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

      const result = await service.findAllByClub(mockClub, {
        page: 1,
        limit: 10,
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
    it('should return the public projection scoped to the club', async () => {
      mockPrisma.sportSession.findUnique.mockResolvedValue({
        title: 'Open Play',
      });

      const result = await service.findPublicBySlug(mockClub, 'open-play');

      expect(result).toEqual({ title: 'Open Play' });
      expect(mockPrisma.sportSession.findUnique).toHaveBeenCalledWith({
        where: { slug: 'open-play', clubId: 'club-1' },
        select: expect.any(Object),
      });
    });

    it('should throw NotFoundException when not found', async () => {
      mockPrisma.sportSession.findUnique.mockResolvedValue(null);

      await expect(
        service.findPublicBySlug(mockClub, 'missing'),
      ).rejects.toThrow(NotFoundException);
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
