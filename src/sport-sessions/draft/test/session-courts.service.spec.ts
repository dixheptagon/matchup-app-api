import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SessionCourtsService } from '../session-courts.service.js';
import { PrismaService } from '../../../config/prisma/prisma.service.js';
import type { SessionContext } from '../sport-sessions.types.js';

describe('SessionCourtsService', () => {
  let service: SessionCourtsService;
  let mockPrisma: any;

  const mockSession: SessionContext = {
    id: 'session-1',
    clubId: 'club-1',
    status: 'DRAFT',
    title: 'Open Play 2026-09-23',
    _count: { sessionCourts: 1, players: 4 },
  };

  beforeEach(async () => {
    mockPrisma = {
      court: { findMany: vi.fn() },
      sessionCourt: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        createMany: vi.fn(),
        deleteMany: vi.fn(),
        delete: vi.fn(),
      },
      sessionMatch: { count: vi.fn() },
    };
    mockPrisma.$transaction = vi.fn(
      async (arg: ((tx: unknown) => Promise<unknown>) | Promise<unknown>[]) =>
        typeof arg === 'function' ? arg(mockPrisma) : Promise.all(arg),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionCourtsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<SessionCourtsService>(SessionCourtsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
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

  describe('addCourts', () => {
    it('should add courts without removing existing ones', async () => {
      mockPrisma.court.findMany.mockResolvedValue([{ id: 3 }]);
      mockPrisma.sessionCourt.findMany.mockResolvedValue([]);

      await service.addCourts(mockSession, { courtIds: [3] });

      expect(mockPrisma.sessionCourt.createMany).toHaveBeenCalled();
      expect(mockPrisma.sessionCourt.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe('removeCourt', () => {
    it('should throw NotFoundException when the court is not in the session', async () => {
      mockPrisma.sessionCourt.findFirst.mockResolvedValue(null);

      await expect(service.removeCourt(mockSession, 9)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should reject removing a court that has matches', async () => {
      mockPrisma.sessionCourt.findFirst.mockResolvedValue({ id: 9 });
      mockPrisma.sessionMatch.count.mockResolvedValue(2);

      await expect(service.removeCourt(mockSession, 9)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should remove the court on success', async () => {
      mockPrisma.sessionCourt.findFirst.mockResolvedValue({ id: 9 });
      mockPrisma.sessionMatch.count.mockResolvedValue(0);

      const result = await service.removeCourt(mockSession, 9);

      expect(result.message).toBe('Court removed from session');
      expect(mockPrisma.sessionCourt.delete).toHaveBeenCalledWith({
        where: { id: 9 },
      });
    });
  });
});
