import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SessionCheckinService } from './session-checkin.service.js';
import { PrismaService } from '../../../config/prisma/prisma.service.js';
import { PlayerStatus } from '../../../../prisma/generated/prisma/enums.js';
import type { SessionContext } from '../../draft/sport-sessions.types.js';

describe('SessionCheckinService', () => {
  let service: SessionCheckinService;
  let mockPrisma: any;

  const mockSession: SessionContext = {
    id: 'session-1',
    clubId: 'club-1',
    status: 'ACTIVE',
    title: 'Open Play 2026-09-23',
    sessionSettings: { attendanceCheckIn: true },
    _count: { sessionCourts: 1, players: 4 },
  };

  const notArrived = { id: 1, status: PlayerStatus.NOT_ARRIVED };
  const waiting = { id: 2, status: PlayerStatus.WAITING };

  beforeEach(async () => {
    mockPrisma = {
      sessionPlayer: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionCheckinService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<SessionCheckinService>(SessionCheckinService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getCheckInStatus', () => {
    it('should return session players ordered by check-in time', async () => {
      mockPrisma.sessionPlayer.findMany.mockResolvedValue([notArrived]);

      const result = await service.getCheckInStatus(mockSession);

      expect(mockPrisma.sessionPlayer.findMany).toHaveBeenCalledWith({
        where: { sessionId: 'session-1' },
        include: { clubMember: true },
        orderBy: { checkedInAt: 'asc' },
      });
      expect(result).toEqual([notArrived]);
    });
  });

  describe('checkInSinglePlayer', () => {
    it('should reject when check-in is disabled for the session', async () => {
      const disabledSession: SessionContext = {
        ...mockSession,
        sessionSettings: { attendanceCheckIn: false },
      };

      await expect(
        service.checkInSinglePlayer(disabledSession, 1),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.sessionPlayer.findMany).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when the player is not in the session', async () => {
      mockPrisma.sessionPlayer.findMany.mockResolvedValue([]);

      await expect(service.checkInSinglePlayer(mockSession, 1)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should reject a player that is already checked in', async () => {
      mockPrisma.sessionPlayer.findMany.mockResolvedValue([waiting]);

      await expect(service.checkInSinglePlayer(mockSession, 2)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockPrisma.sessionPlayer.update).not.toHaveBeenCalled();
    });

    it('should check in a player with a default WAITING status', async () => {
      mockPrisma.sessionPlayer.findMany.mockResolvedValue([notArrived]);
      mockPrisma.sessionPlayer.update.mockResolvedValue({
        ...notArrived,
        status: PlayerStatus.WAITING,
      });

      await service.checkInSinglePlayer(mockSession, 1);

      expect(mockPrisma.sessionPlayer.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          status: PlayerStatus.WAITING,
          checkedInAt: expect.any(Date),
          playCount: 0,
          restCount: 0,
        },
        include: { clubMember: true },
      });
    });

    it('should honor an explicit status override', async () => {
      mockPrisma.sessionPlayer.findMany.mockResolvedValue([notArrived]);
      mockPrisma.sessionPlayer.update.mockResolvedValue({});

      await service.checkInSinglePlayer(mockSession, 1, {
        status: PlayerStatus.RESERVED,
      });

      expect(mockPrisma.sessionPlayer.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: PlayerStatus.RESERVED }),
        }),
      );
    });
  });

  describe('checkInMultiplePlayers', () => {
    it('should reject when any player is already checked in', async () => {
      mockPrisma.sessionPlayer.findMany.mockResolvedValue([
        notArrived,
        waiting,
      ]);

      await expect(
        service.checkInMultiplePlayers(mockSession, {
          sessionPlayerIds: [1, 2],
        }),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.sessionPlayer.updateMany).not.toHaveBeenCalled();
    });

    it('should check in all eligible players', async () => {
      mockPrisma.sessionPlayer.findMany
        .mockResolvedValueOnce([notArrived])
        .mockResolvedValueOnce([{ ...notArrived, status: 'WAITING' }]);
      mockPrisma.sessionPlayer.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.checkInMultiplePlayers(mockSession, {
        sessionPlayerIds: [1],
      });

      expect(mockPrisma.sessionPlayer.updateMany).toHaveBeenCalledWith({
        where: { id: { in: [1] } },
        data: {
          status: PlayerStatus.WAITING,
          checkedInAt: expect.any(Date),
          playCount: 0,
          restCount: 0,
        },
      });
      expect(result).toHaveLength(1);
    });
  });

  describe('checkOutPlayer', () => {
    it('should throw NotFoundException when the player is not in the session', async () => {
      mockPrisma.sessionPlayer.findFirst.mockResolvedValue(null);

      await expect(service.checkOutPlayer(mockSession, 9)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should reject checking out a player that already left', async () => {
      mockPrisma.sessionPlayer.findFirst.mockResolvedValue({
        id: 9,
        status: PlayerStatus.LEFT,
      });

      await expect(service.checkOutPlayer(mockSession, 9)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should mark the player as LEFT', async () => {
      mockPrisma.sessionPlayer.findFirst.mockResolvedValue({ id: 9 });
      mockPrisma.sessionPlayer.update.mockResolvedValue({
        id: 9,
        status: PlayerStatus.LEFT,
      });

      await service.checkOutPlayer(mockSession, 9);

      expect(mockPrisma.sessionPlayer.update).toHaveBeenCalledWith({
        where: { id: 9 },
        data: {
          status: PlayerStatus.LEFT,
          lastMatchFinishedAt: expect.any(Date),
        },
        include: { clubMember: true },
      });
    });
  });
});
