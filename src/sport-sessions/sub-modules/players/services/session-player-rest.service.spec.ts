import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { SessionPlayerRestService } from './session-player-rest.service.js';
import { PrismaService } from '../../../../config/prisma/prisma.service.js';
import { PlayerStatus } from '../../../../../prisma/generated/prisma/enums.js';
import { DEFAULT_CLUB_SETTINGS } from '../../../../club-settings/club-settings.constant.js';
import {
  MILLISECONDS_PER_MINUTE,
  RESTABLE_PLAYER_STATUSES,
} from '../../../shared/constants/sport-sessions.constant.js';
import type { SessionContext } from '../../../shared/types/sport-sessions.types.js';

const NOW = new Date('2026-01-01T00:00:00.000Z');

describe('SessionPlayerRestService', () => {
  let service: SessionPlayerRestService;
  let mockPrisma: any;

  const mockSession: SessionContext = {
    id: 'session-1',
    clubId: 'club-1',
    status: 'ACTIVE',
    title: 'Open Play',
    sessionSettings: { attendanceCheckIn: true },
    _count: { sessionCourts: 1, players: 4 },
  };

  const waiting = {
    id: 2,
    sessionId: 'session-1',
    status: PlayerStatus.WAITING,
    restUntil: null,
    playCount: 0,
    checkedInAt: new Date('2025-12-31T12:00:00.000Z'),
  };

  const resting = {
    ...waiting,
    id: 3,
    status: PlayerStatus.RESTING,
    restUntil: new Date('2026-01-01T00:03:00.000Z'),
  };

  function restUntil(call = 0) {
    return mockPrisma.sessionPlayer.updateMany.mock.calls[call][0].data
      .restUntil as Date;
  }

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);

    mockPrisma = {
      sessionPlayer: {
        findFirst: vi.fn(),
        findUnique: vi.fn().mockResolvedValue(waiting),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      sessionSettings: {
        findUnique: vi.fn().mockResolvedValue({ minimumRestTime: 5 }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionPlayerRestService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<SessionPlayerRestService>(SessionPlayerRestService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('restPlayer', () => {
    it('throws NotFound when the player is not in the session', async () => {
      mockPrisma.sessionPlayer.findFirst.mockResolvedValue(null);

      await expect(
        service.restPlayer(mockSession, 99, {}),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.sessionPlayer.updateMany).not.toHaveBeenCalled();
    });

    it.each([
      PlayerStatus.NOT_ARRIVED,
      PlayerStatus.RESERVED,
      PlayerStatus.PLAYING,
      PlayerStatus.LEFT,
    ])('rejects resting a %s player', async (status) => {
      mockPrisma.sessionPlayer.findFirst.mockResolvedValue({
        ...waiting,
        status,
      });

      await expect(
        service.restPlayer(mockSession, 2, {}),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.sessionPlayer.updateMany).not.toHaveBeenCalled();
    });

    it('puts a waiting player on rest until the configured time', async () => {
      mockPrisma.sessionPlayer.findFirst.mockResolvedValue(waiting);

      await service.restPlayer(mockSession, 2, {});

      expect(mockPrisma.sessionPlayer.updateMany).toHaveBeenCalledWith({
        where: {
          id: 2,
          sessionId: 'session-1',
          status: { in: RESTABLE_PLAYER_STATUSES },
        },
        data: {
          status: PlayerStatus.RESTING,
          restUntil: new Date('2026-01-01T00:05:00.000Z'),
        },
      });
      expect(mockPrisma.sessionSettings.findUnique).toHaveBeenCalledWith({
        where: { sessionId: 'session-1' },
        select: { minimumRestTime: true },
      });
    });

    it('overrides the configured rest time when durationMinutes is given', async () => {
      mockPrisma.sessionPlayer.findFirst.mockResolvedValue(waiting);

      await service.restPlayer(mockSession, 2, { durationMinutes: 30 });

      expect(restUntil()).toEqual(
        new Date('2026-01-01T00:30:00.000Z'),
      );
      expect(mockPrisma.sessionSettings.findUnique).not.toHaveBeenCalled();
    });

    it('extends the rest of an already resting player', async () => {
      mockPrisma.sessionPlayer.findFirst.mockResolvedValue(resting);

      await service.restPlayer(mockSession, 3, {});

      expect(mockPrisma.sessionPlayer.updateMany).toHaveBeenCalledWith({
        where: {
          id: 3,
          sessionId: 'session-1',
          status: { in: RESTABLE_PLAYER_STATUSES },
        },
        data: {
          status: PlayerStatus.RESTING,
          restUntil: new Date('2026-01-01T00:05:00.000Z'),
        },
      });
    });

    it('rejects a default duration of zero', async () => {
      mockPrisma.sessionPlayer.findFirst.mockResolvedValue(waiting);
      mockPrisma.sessionSettings.findUnique.mockResolvedValue({
        minimumRestTime: 0,
      });

      await expect(
        service.restPlayer(mockSession, 2, {}),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.sessionPlayer.updateMany).not.toHaveBeenCalled();
    });

    it('falls back to the club default when minimumRestTime is missing', async () => {
      mockPrisma.sessionPlayer.findFirst.mockResolvedValue(waiting);
      mockPrisma.sessionSettings.findUnique.mockResolvedValue(null);

      await service.restPlayer(mockSession, 2, {});

      expect(restUntil()).toEqual(
        new Date(
          NOW.getTime() +
            DEFAULT_CLUB_SETTINGS.minimumRestTime * MILLISECONDS_PER_MINUTE,
        ),
      );
    });

    it('throws Conflict when the guarded update matches no row', async () => {
      mockPrisma.sessionPlayer.findFirst.mockResolvedValue(waiting);
      mockPrisma.sessionPlayer.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.restPlayer(mockSession, 2, {}),
      ).rejects.toThrow(ConflictException);
      expect(mockPrisma.sessionPlayer.findUnique).not.toHaveBeenCalled();
    });

    it('returns the resting player with their club member', async () => {
      mockPrisma.sessionPlayer.findFirst.mockResolvedValue(waiting);
      const restingPlayer = { ...waiting, status: PlayerStatus.RESTING };
      mockPrisma.sessionPlayer.findUnique.mockResolvedValue(restingPlayer);

      const result = await service.restPlayer(mockSession, 2, {});

      expect(result).toEqual(restingPlayer);
      expect(mockPrisma.sessionPlayer.findUnique).toHaveBeenCalledWith({
        where: { id: 2 },
        include: { clubMember: true },
      });
    });

    it('scopes the lookup to the current session', async () => {
      mockPrisma.sessionPlayer.findFirst.mockResolvedValue(waiting);

      await service.restPlayer(mockSession, 2, {});

      expect(mockPrisma.sessionPlayer.findFirst).toHaveBeenCalledWith({
        where: { id: 2, sessionId: 'session-1' },
      });
    });
  });

  describe('resumePlayer', () => {
    it('throws NotFound when the player is not in the session', async () => {
      mockPrisma.sessionPlayer.findFirst.mockResolvedValue(null);

      await expect(service.resumePlayer(mockSession, 99)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrisma.sessionPlayer.updateMany).not.toHaveBeenCalled();
    });

    it.each([
      PlayerStatus.WAITING,
      PlayerStatus.NOT_ARRIVED,
      PlayerStatus.RESERVED,
      PlayerStatus.PLAYING,
      PlayerStatus.LEFT,
    ])('rejects resuming a %s player', async (status) => {
      mockPrisma.sessionPlayer.findFirst.mockResolvedValue({
        ...waiting,
        status,
      });

      await expect(service.resumePlayer(mockSession, 2)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockPrisma.sessionPlayer.updateMany).not.toHaveBeenCalled();
    });

    it('returns a resting player to waiting and clears their cooldown', async () => {
      mockPrisma.sessionPlayer.findFirst.mockResolvedValue(resting);

      await service.resumePlayer(mockSession, 3);

      expect(mockPrisma.sessionPlayer.updateMany).toHaveBeenCalledWith({
        where: {
          id: 3,
          sessionId: 'session-1',
          status: PlayerStatus.RESTING,
        },
        data: { status: PlayerStatus.WAITING, restUntil: null },
      });
    });

    it('throws Conflict when another request resumed the player first', async () => {
      mockPrisma.sessionPlayer.findFirst.mockResolvedValue(resting);
      mockPrisma.sessionPlayer.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.resumePlayer(mockSession, 3)).rejects.toThrow(
        ConflictException,
      );
      expect(mockPrisma.sessionPlayer.findUnique).not.toHaveBeenCalled();
    });

    it('returns the resumed player with their club member', async () => {
      mockPrisma.sessionPlayer.findFirst.mockResolvedValue(resting);
      const resumed = { ...resting, status: PlayerStatus.WAITING };
      mockPrisma.sessionPlayer.findUnique.mockResolvedValue(resumed);

      const result = await service.resumePlayer(mockSession, 3);

      expect(result).toEqual(resumed);
      expect(mockPrisma.sessionPlayer.findUnique).toHaveBeenCalledWith({
        where: { id: 3 },
        include: { clubMember: true },
      });
    });
  });
});
