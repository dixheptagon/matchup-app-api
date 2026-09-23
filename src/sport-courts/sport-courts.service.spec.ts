import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { SportCourtsService } from './sport-courts.service.js';
import { PrismaService } from '../config/prisma/prisma.service.js';
import type { SportClub } from '../../prisma/generated/prisma/client.js';

describe('SportCourtsService', () => {
  let service: SportCourtsService;
  let mockPrisma: {
    court: {
      findUnique: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
    };
    sessionCourt: {
      count: ReturnType<typeof vi.fn>;
    };
    $transaction: ReturnType<typeof vi.fn>;
  };

  const mockClub: SportClub = {
    id: 'club-1',
    ownerId: 'owner-1',
    name: 'Test Club',
    slug: 'test-club',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockCourt = {
    id: 1,
    clubId: 'club-1',
    name: 'Court A',
    displayOrder: 0,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    mockPrisma = {
      court: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      sessionCourt: {
        count: vi.fn(),
      },
      $transaction: vi.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SportCourtsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<SportCourtsService>(SportCourtsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a court with auto displayOrder', async () => {
      mockPrisma.court.findUnique.mockResolvedValue(null);
      mockPrisma.court.findFirst.mockResolvedValue({ displayOrder: 2 });
      mockPrisma.court.create.mockResolvedValue({ ...mockCourt, displayOrder: 3 });

      const result = await service.create(mockClub, { name: 'Court C' });

      expect(result.displayOrder).toBe(3);
      expect(mockPrisma.court.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'Court C',
          displayOrder: 3,
          isActive: true,
        }),
        select: expect.any(Object),
      });
    });

    it('should create a court with explicit displayOrder', async () => {
      mockPrisma.court.findUnique.mockResolvedValue(null);
      mockPrisma.court.findFirst.mockResolvedValue(null);
      mockPrisma.court.create.mockResolvedValue({ ...mockCourt, displayOrder: 5 });

      const result = await service.create(mockClub, {
        name: 'Court E',
        displayOrder: 5,
      });

      expect(result.displayOrder).toBe(5);
    });

    it('should throw ConflictException when name already exists', async () => {
      mockPrisma.court.findUnique.mockResolvedValue(mockCourt);

      await expect(service.create(mockClub, { name: 'Court A' })).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw ConflictException when explicit displayOrder already exists', async () => {
      mockPrisma.court.findUnique.mockResolvedValue(null);
      mockPrisma.court.findFirst.mockResolvedValue({ id: 2, displayOrder: 5 });

      await expect(
        service.create(mockClub, { name: 'Court E', displayOrder: 5 }),
      ).rejects.toThrow(ConflictException);
    });

    it('should default isActive to true when not provided', async () => {
      mockPrisma.court.findUnique.mockResolvedValue(null);
      mockPrisma.court.findFirst.mockResolvedValue({ displayOrder: 1 });
      mockPrisma.court.create.mockResolvedValue({ ...mockCourt, displayOrder: 2 });

      await service.create(mockClub, { name: 'Court B' });

      expect(mockPrisma.court.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ isActive: true }),
        select: expect.any(Object),
      });
    });
  });

  describe('findAll', () => {
    it('should return courts ordered by displayOrder ascending by default', async () => {
      mockPrisma.court.findMany.mockResolvedValue([mockCourt]);

      const result = await service.findAll(mockClub);

      expect(result).toEqual([mockCourt]);
      expect(mockPrisma.court.findMany).toHaveBeenCalledWith({
        where: { clubId: 'club-1' },
        select: expect.any(Object),
        orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
      });
    });

    it('should order descending when requested', async () => {
      mockPrisma.court.findMany.mockResolvedValue([mockCourt]);

      await service.findAll(mockClub, 'desc');

      expect(mockPrisma.court.findMany).toHaveBeenCalledWith({
        where: { clubId: 'club-1' },
        select: expect.any(Object),
        orderBy: [{ displayOrder: 'desc' }, { id: 'asc' }],
      });
    });
  });

  describe('update', () => {
    it('should update court name', async () => {
      mockPrisma.court.findFirst.mockResolvedValueOnce(mockCourt);
      mockPrisma.court.findUnique.mockResolvedValue(null);
      mockPrisma.court.update.mockResolvedValue({ ...mockCourt, name: 'Court B' });

      const result = await service.update(mockClub, 1, { name: 'Court B' });

      expect(result.name).toBe('Court B');
    });

    it('should update displayOrder', async () => {
      mockPrisma.court.findFirst
        .mockResolvedValueOnce(mockCourt)
        .mockResolvedValueOnce(null);
      mockPrisma.court.update.mockResolvedValue({ ...mockCourt, displayOrder: 5 });

      const result = await service.update(mockClub, 1, { displayOrder: 5 });

      expect(result.displayOrder).toBe(5);
    });

    it('should throw ConflictException on duplicate name', async () => {
      mockPrisma.court.findFirst.mockResolvedValueOnce(mockCourt);
      mockPrisma.court.findUnique.mockResolvedValue({ id: 2, name: 'Court B' });

      await expect(
        service.update(mockClub, 1, { name: 'Court B' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException on duplicate displayOrder', async () => {
      mockPrisma.court.findFirst
        .mockResolvedValueOnce(mockCourt)
        .mockResolvedValueOnce({ id: 2, displayOrder: 5 });

      await expect(
        service.update(mockClub, 1, { displayOrder: 5 }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw NotFoundException when court not found', async () => {
      mockPrisma.court.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.update(mockClub, 999, { name: 'New' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should skip uniqueness checks when values are unchanged', async () => {
      mockPrisma.court.findFirst.mockResolvedValueOnce(mockCourt);
      mockPrisma.court.update.mockResolvedValue(mockCourt);

      const result = await service.update(mockClub, 1, {
        name: 'Court A',
        displayOrder: 0,
      });

      expect(result.name).toBe('Court A');
      expect(mockPrisma.court.findUnique).not.toHaveBeenCalled();
      expect(mockPrisma.court.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { name: 'Court A', displayOrder: 0 },
        }),
      );
    });
  });

  describe('remove', () => {
    it('should delete court when no sessionCourts', async () => {
      mockPrisma.court.findFirst.mockResolvedValue(mockCourt);
      mockPrisma.sessionCourt.count.mockResolvedValue(0);
      mockPrisma.court.delete.mockResolvedValue(mockCourt);

      const result = await service.remove(mockClub, 1);

      expect(result.message).toBe('Court deleted successfully');
    });

    it('should throw BadRequestException when court has sessionCourts', async () => {
      mockPrisma.court.findFirst.mockResolvedValue(mockCourt);
      mockPrisma.sessionCourt.count.mockResolvedValue(2);

      await expect(service.remove(mockClub, 1)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException when court not found', async () => {
      mockPrisma.court.findFirst.mockResolvedValue(null);

      await expect(service.remove(mockClub, 999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('reorder', () => {
    it('should reorder courts successfully', async () => {
      mockPrisma.court.findMany
        .mockResolvedValueOnce([{ id: 1 }, { id: 2 }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          { ...mockCourt, id: 2, displayOrder: 0 },
          { ...mockCourt, id: 1, displayOrder: 1 },
        ]);

      const result = await service.reorder(mockClub, {
        items: [
          { id: 1, displayOrder: 1 },
          { id: 2, displayOrder: 0 },
        ],
      });

      expect(result).toHaveLength(2);
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('should throw BadRequestException for duplicate displayOrders in request', async () => {
      mockPrisma.court.findMany.mockResolvedValueOnce([{ id: 1 }, { id: 2 }]);

      await expect(
        service.reorder(mockClub, {
          items: [
            { id: 1, displayOrder: 1 },
            { id: 2, displayOrder: 1 },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when a court is not in the club', async () => {
      mockPrisma.court.findMany.mockResolvedValueOnce([{ id: 1 }]);

      await expect(
        service.reorder(mockClub, {
          items: [
            { id: 1, displayOrder: 0 },
            { id: 2, displayOrder: 1 },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException when new displayOrder conflicts with another court', async () => {
      mockPrisma.court.findMany
        .mockResolvedValueOnce([{ id: 1 }, { id: 2 }])
        .mockResolvedValueOnce([{ displayOrder: 5 }]);

      await expect(
        service.reorder(mockClub, {
          items: [
            { id: 1, displayOrder: 0 },
            { id: 2, displayOrder: 5 },
          ],
        }),
      ).rejects.toThrow(ConflictException);
    });
  });
});