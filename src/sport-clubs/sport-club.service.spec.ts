import { Test, TestingModule } from '@nestjs/testing';
import { SportClubsService } from './sport-clubs.service.js';
import { PrismaService } from '../config/prisma/prisma.service.js';
import {
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';

describe('SportClubsService', () => {
  let service: SportClubsService;
  let mockPrisma: {
    sportClub: {
      create: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
    };
  };

  const mockClub = {
    id: 1,
    name: 'Test Club',
    ownerId: 1,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };

  const mockClubWithCounts = {
    ...mockClub,
    _count: { members: 5, sessions: 10, courts: 3 },
  };

  beforeEach(async () => {
    mockPrisma = {
      sportClub: {
        create: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
        count: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SportClubsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<SportClubsService>(SportClubsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new club', async () => {
      mockPrisma.sportClub.create.mockResolvedValue(mockClub);

      const result = await service.create(1, { name: 'Test Club' });

      expect(result.id).toBe(1);
      expect(result.name).toBe('Test Club');
      expect(result.ownerId).toBe(1);
    });

    it('should call prisma with correct data including ownerId', async () => {
      mockPrisma.sportClub.create.mockResolvedValue(mockClub);

      await service.create(42, { name: 'My Club' });

      expect(mockPrisma.sportClub.create).toHaveBeenCalledWith({
        data: { name: 'My Club', ownerId: 42 },
        select: {
          id: true,
          name: true,
          ownerId: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    });
  });

  describe('findAllByOwner', () => {
    it('should return paginated clubs with counts', async () => {
      mockPrisma.sportClub.findMany.mockResolvedValue([mockClubWithCounts]);
      mockPrisma.sportClub.count.mockResolvedValue(1);

      const result = await service.findAllByOwner(1);

      expect(result.data).toHaveLength(1);
      expect(result.data[0]._count).toEqual({ members: 5, sessions: 10, courts: 3 });
      expect(result.meta).toEqual({ page: 1, limit: 20, total: 1 });
    });

    it('should return empty data array when user has no clubs', async () => {
      mockPrisma.sportClub.findMany.mockResolvedValue([]);
      mockPrisma.sportClub.count.mockResolvedValue(0);

      const result = await service.findAllByOwner(999);

      expect(result.data).toHaveLength(0);
      expect(result.meta.total).toBe(0);
    });

    it('should handle custom page and limit values', async () => {
      mockPrisma.sportClub.findMany.mockResolvedValue([]);
      mockPrisma.sportClub.count.mockResolvedValue(0);

      await service.findAllByOwner(1, 3, 5);

      expect(mockPrisma.sportClub.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 5 }),
      );
    });

    it('should return correct meta with total count', async () => {
      mockPrisma.sportClub.findMany.mockResolvedValue([]);
      mockPrisma.sportClub.count.mockResolvedValue(42);

      const result = await service.findAllByOwner(1, 2, 10);

      expect(result.meta).toEqual({ page: 2, limit: 10, total: 42 });
    });
  });

  describe('findOne', () => {
    it('should return club with counts when found', async () => {
      mockPrisma.sportClub.findUnique.mockResolvedValue(mockClubWithCounts);

      const result = await service.findOne(1);

      expect(result.id).toBe(1);
      expect(result._count).toEqual({ members: 5, sessions: 10, courts: 3 });
    });

    it('should throw NotFoundException when club not found', async () => {
      mockPrisma.sportClub.findUnique.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update club name when user is owner', async () => {
      mockPrisma.sportClub.findUnique
        .mockResolvedValueOnce(mockClub)
        .mockResolvedValueOnce(null);
      mockPrisma.sportClub.update.mockResolvedValue({
        ...mockClub,
        name: 'Updated Club',
      });

      const result = await service.update(1, 1, { name: 'Updated Club' });

      expect(result.name).toBe('Updated Club');
    });

    it('should throw NotFoundException when club not found', async () => {
      mockPrisma.sportClub.findUnique.mockResolvedValue(null);

      await expect(service.update(999, 1, { name: 'New' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException when user is not owner', async () => {
      mockPrisma.sportClub.findUnique.mockResolvedValue({ ...mockClub, ownerId: 1 });

      await expect(service.update(1, 999, { name: 'Hacked' })).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw ConflictException when name already exists', async () => {
      mockPrisma.sportClub.findUnique
        .mockResolvedValueOnce(mockClub)
        .mockResolvedValueOnce({ id: 2, name: 'Taken Name' });

      await expect(
        service.update(1, 1, { name: 'Taken Name' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should allow keeping the same name without conflict', async () => {
      mockPrisma.sportClub.findUnique.mockResolvedValueOnce(mockClub);
      mockPrisma.sportClub.update.mockResolvedValue(mockClub);

      const result = await service.update(1, 1, { name: 'Test Club' });

      expect(result.name).toBe('Test Club');
      // findUnique should only be called once (for ownership check), not twice (no name conflict check needed)
      expect(mockPrisma.sportClub.findUnique).toHaveBeenCalledTimes(1);
    });
  });

  describe('remove', () => {
    it('should delete club and return success message when owner', async () => {
      mockPrisma.sportClub.findUnique.mockResolvedValue(mockClub);
      mockPrisma.sportClub.delete.mockResolvedValue(mockClub);

      const result = await service.remove(1, 1);

      expect(result.message).toBe('Club deleted successfully');
      expect(mockPrisma.sportClub.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    });

    it('should throw NotFoundException when club not found', async () => {
      mockPrisma.sportClub.findUnique.mockResolvedValue(null);

      await expect(service.remove(999, 1)).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when user is not owner', async () => {
      mockPrisma.sportClub.findUnique.mockResolvedValue({ ...mockClub, ownerId: 1 });

      await expect(service.remove(1, 999)).rejects.toThrow(ForbiddenException);
    });
  });
});
