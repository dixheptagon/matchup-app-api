import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SessionPlayersService } from '../session-players.service.js';
import { SportMembersService } from '../../../sport-members/sport-members.service.js';
import { PrismaService } from '../../../config/prisma/prisma.service.js';
import type { SessionContext } from '../sport-sessions.types.js';

describe('SessionPlayersService', () => {
  let service: SessionPlayersService;
  let mockPrisma: any;
  let mockMembers: { createMember: ReturnType<typeof vi.fn> };

  const mockSession: SessionContext = {
    id: 'session-1',
    clubId: 'club-1',
    status: 'DRAFT',
    title: 'Open Play 2026-09-23',
    _count: { sessionCourts: 1, players: 4 },
  };

  beforeEach(async () => {
    mockPrisma = {
      clubMember: { findMany: vi.fn() },
      sessionPlayer: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        createMany: vi.fn(),
        create: vi.fn(),
        deleteMany: vi.fn(),
        delete: vi.fn(),
      },
      matchPlayer: { count: vi.fn() },
    };
    mockPrisma.$transaction = vi.fn(
      async (arg: ((tx: unknown) => Promise<unknown>) | Promise<unknown>[]) =>
        typeof arg === 'function' ? arg(mockPrisma) : Promise.all(arg),
    );
    mockMembers = { createMember: vi.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionPlayersService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: SportMembersService, useValue: mockMembers },
      ],
    }).compile();

    service = module.get<SessionPlayersService>(SessionPlayersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('setPlayers', () => {
    it('should reject when a member is invalid', async () => {
      mockPrisma.clubMember.findMany.mockResolvedValue([{ id: 'm1' }]);

      await expect(
        service.setPlayers(mockSession, { clubMemberIds: ['m1', 'm2'] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should replace the roster on success', async () => {
      mockPrisma.clubMember.findMany.mockResolvedValue([
        { id: 'm1' },
        { id: 'm2' },
      ]);
      mockPrisma.sessionPlayer.findMany.mockResolvedValue([]);

      await service.setPlayers(mockSession, { clubMemberIds: ['m1', 'm2'] });

      expect(mockPrisma.sessionPlayer.deleteMany).toHaveBeenCalledWith({
        where: {
          sessionId: 'session-1',
          clubMemberId: { notIn: ['m1', 'm2'] },
        },
      });
      expect(mockPrisma.sessionPlayer.createMany).toHaveBeenCalledWith({
        data: [
          { sessionId: 'session-1', clubMemberId: 'm1' },
          { sessionId: 'session-1', clubMemberId: 'm2' },
        ],
        skipDuplicates: true,
      });
    });
  });

  describe('addPlayers', () => {
    it('should add members without removing existing ones', async () => {
      mockPrisma.clubMember.findMany.mockResolvedValue([{ id: 'm3' }]);
      mockPrisma.sessionPlayer.findMany.mockResolvedValue([]);

      await service.addPlayers(mockSession, { clubMemberIds: ['m3'] });

      expect(mockPrisma.sessionPlayer.createMany).toHaveBeenCalled();
      expect(mockPrisma.sessionPlayer.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe('addGuest', () => {
    it('should create the guest member and add them as a player', async () => {
      mockMembers.createMember.mockResolvedValue({ id: 'guest-1' });
      mockPrisma.sessionPlayer.create.mockResolvedValue({ id: 10 });

      const result = await service.addGuest(mockSession, {
        displayName: 'John',
      });

      expect(mockMembers.createMember).toHaveBeenCalledWith(
        expect.objectContaining({
          clubId: 'club-1',
          displayName: 'John',
          isGuest: true,
          createdBySessionId: 'session-1',
        }),
        mockPrisma,
      );
      expect(result).toEqual({ id: 10 });
    });
  });

  describe('removePlayer', () => {
    it('should throw NotFoundException when the player is not in the session', async () => {
      mockPrisma.sessionPlayer.findFirst.mockResolvedValue(null);

      await expect(service.removePlayer(mockSession, 9)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should reject removing a player that has matches', async () => {
      mockPrisma.sessionPlayer.findFirst.mockResolvedValue({ id: 9 });
      mockPrisma.matchPlayer.count.mockResolvedValue(1);

      await expect(service.removePlayer(mockSession, 9)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should remove the player on success', async () => {
      mockPrisma.sessionPlayer.findFirst.mockResolvedValue({ id: 9 });
      mockPrisma.matchPlayer.count.mockResolvedValue(0);

      const result = await service.removePlayer(mockSession, 9);

      expect(result.message).toBe('Player removed from session');
    });
  });
});
