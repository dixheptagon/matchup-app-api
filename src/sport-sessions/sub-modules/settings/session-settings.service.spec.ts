import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { SessionSettingsService } from './session-settings.service.js';
import { PrismaService } from '../../../config/prisma/prisma.service.js';
import { MatchmakingPreset } from '../../../club-settings/matchmaking-presets.constant.js';
import { SessionContext } from '../../shared/types/sport-sessions.types.js';

describe('SessionSettingsService', () => {
  let service: SessionSettingsService;
  let mockPrisma: {
    sessionSettings: { update: ReturnType<typeof vi.fn> };
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
      sessionSettings: { update: vi.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionSettingsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<SessionSettingsService>(SessionSettingsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

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

  it('should expand a preset into the priority fields', async () => {
    mockPrisma.sessionSettings.update.mockResolvedValue({});

    await service.updateSettings(mockSession, {
      preset: MatchmakingPreset.SKILL_BASED,
    });

    expect(mockPrisma.sessionSettings.update).toHaveBeenCalledWith({
      where: { sessionId: 'session-1' },
      data: {
        equalPlayPriority: 'MEDIUM',
        prioritizeWaitingPlayers: 'MEDIUM',
        balancedTeams: 'HIGH',
        skillBandPriority: 'MAX',
        partnerVariety: 'LOW',
        opponentVariety: 'LOW',
      },
    });
  });

  it('should let explicit fields override the preset values', async () => {
    mockPrisma.sessionSettings.update.mockResolvedValue({});

    await service.updateSettings(mockSession, {
      preset: MatchmakingPreset.RANDOM,
      balancedTeams: 'MEDIUM',
    });

    expect(mockPrisma.sessionSettings.update).toHaveBeenCalledWith({
      where: { sessionId: 'session-1' },
      data: expect.objectContaining({
        balancedTeams: 'MEDIUM',
        skillBandPriority: 'LOW',
      }),
    });
  });

  it('should reject a preset while the session is active', async () => {
    await expect(
      service.updateSettings(
        { ...mockSession, status: 'ACTIVE' },
        { preset: MatchmakingPreset.BALANCED },
      ),
    ).rejects.toThrow(BadRequestException);
    expect(mockPrisma.sessionSettings.update).not.toHaveBeenCalled();
  });
});
