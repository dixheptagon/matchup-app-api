import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ClubSettingsService } from './club-settings.service.js';
import { PrismaService } from '../config/prisma/prisma.service.js';
import type { SportClub } from '../../prisma/generated/prisma/client.js';

describe('ClubSettingsService', () => {
  let service: ClubSettingsService;
  let mockPrisma: {
    clubSettings: {
      findUnique: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
  };

  const mockClub: SportClub = {
    id: 'club-1',
    ownerId: 'owner-1',
    name: 'Test Club',
    slug: 'test-club',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockSettings = {
    id: 1,
    clubId: 'club-1',
    defaultSport: 'BADMINTON',
    trackMatchScore: true,
    allowEndWithoutScore: false,
    attendanceCheckIn: true,
    lateJoinerPolicy: null,
    leaderBoardMode: 'OFF',
    queueDepth: null,
    autoMatchMaking: true,
    matchMakingMode: 'BALANCED',
    equalPlayPriority: 'MEDIUM',
    balancedTeams: 'HIGH',
    partnerVariety: 'MEDIUM',
    opponentVariety: 'MEDIUM',
    prioritizeWaitingPlayers: 'HIGH',
    minimumRestTime: null,
    carryBalance: 'LOW',
    carryEvaluation: 'LOW',
    genderPreference: null,
    fairnessThreshold: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    mockPrisma = {
      clubSettings: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClubSettingsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ClubSettingsService>(ClubSettingsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('find', () => {
    it('should return settings when they exist', async () => {
      mockPrisma.clubSettings.findUnique.mockResolvedValue(mockSettings);

      const result = await service.find(mockClub);

      expect(result).toEqual(mockSettings);
      expect(mockPrisma.clubSettings.findUnique).toHaveBeenCalledWith({
        where: { clubId: 'club-1' },
      });
    });

    it('should throw NotFoundException when settings do not exist', async () => {
      mockPrisma.clubSettings.findUnique.mockResolvedValue(null);

      await expect(service.find(mockClub)).rejects.toThrow(NotFoundException);
    });
  });

  describe('upsert', () => {
    it('should create settings on first update', async () => {
      mockPrisma.clubSettings.findUnique.mockResolvedValue(null);
      mockPrisma.clubSettings.create.mockResolvedValue(mockSettings);

      const result = await service.upsert(mockClub, {
        defaultSport: 'BADMINTON',
        leaderBoardMode: 'OFF',
      });

      expect(result).toEqual(mockSettings);
      expect(mockPrisma.clubSettings.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          clubId: 'club-1',
          defaultSport: 'BADMINTON',
          leaderBoardMode: 'OFF',
        }),
      });
    });

    it('should throw BadRequestException when creating without required fields', async () => {
      mockPrisma.clubSettings.findUnique.mockResolvedValue(null);

      await expect(
        service.upsert(mockClub, { trackMatchScore: false }),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.clubSettings.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when missing leaderBoardMode only', async () => {
      mockPrisma.clubSettings.findUnique.mockResolvedValue(null);

      await expect(
        service.upsert(mockClub, { defaultSport: 'TENNIS' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should update settings when they already exist', async () => {
      mockPrisma.clubSettings.findUnique.mockResolvedValue({ id: 1 });
      mockPrisma.clubSettings.update.mockResolvedValue({
        ...mockSettings,
        matchMakingMode: 'LOOSE_SOCIAL',
      });

      const result = await service.upsert(mockClub, {
        matchMakingMode: 'LOOSE_SOCIAL',
      });

      expect(result.matchMakingMode).toBe('LOOSE_SOCIAL');
      expect(mockPrisma.clubSettings.update).toHaveBeenCalledWith({
        where: { clubId: 'club-1' },
        data: { matchMakingMode: 'LOOSE_SOCIAL' },
      });
      expect(mockPrisma.clubSettings.create).not.toHaveBeenCalled();
    });

    it('should not require defaultSport and leaderBoardMode on update', async () => {
      mockPrisma.clubSettings.findUnique.mockResolvedValue({ id: 1 });
      mockPrisma.clubSettings.update.mockResolvedValue(mockSettings);

      await service.upsert(mockClub, { queueDepth: 10 });

      expect(mockPrisma.clubSettings.update).toHaveBeenCalledWith({
        where: { clubId: 'club-1' },
        data: { queueDepth: 10 },
      });
    });
  });
});
