import { Test, TestingModule } from '@nestjs/testing';
import { SportClubsService } from './sport-clubs.service.js';
import { PrismaService } from '../config/prisma/prisma.service.js';
import {
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';

describe('SportClubsService', () => {
  let service: SportClubsService;
  let mockPrisma: {
    sportClub: {
      create: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
    };
    user: {
      findUnique: ReturnType<typeof vi.fn>;
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

  const mockOwner = {
    id: 1,
    name: 'Test Owner',
    email: 'owner@example.com',
    deletedAt: null,
  };

  beforeEach(async () => {
    mockPrisma = {
      sportClub: {
        create: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        count: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      user: {
        findUnique: vi.fn(),
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
      mockPrisma.user.findUnique.mockResolvedValue(mockOwner);
      mockPrisma.sportClub.count.mockResolvedValue(0);
      mockPrisma.sportClub.findFirst.mockResolvedValue(null);
      mockPrisma.sportClub.create.mockResolvedValue(mockClub);

      const result = await service.create(1, { name: 'Test Club' });

      expect(result.id).toBe(1);
      expect(result.name).toBe('Test Club');
      expect(result.ownerId).toBe(1);
    });

    it('should call prisma with correct data including ownerId', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockOwner);
      mockPrisma.sportClub.count.mockResolvedValue(0);
      mockPrisma.sportClub.findFirst.mockResolvedValue(null);
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

    it('should throw NotFoundException if owner does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.create(999, { name: 'Test Club' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException if owner is deleted', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockOwner,
        deletedAt: new Date(),
      });

      await expect(service.create(1, { name: 'Test Club' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ConflictException if owner has reached max clubs (3)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockOwner);
      mockPrisma.sportClub.count.mockResolvedValue(3);

      await expect(service.create(1, { name: 'New Club' })).rejects.toThrow(
        ConflictException,
      );
      expect(mockPrisma.sportClub.count).toHaveBeenCalledWith({
        where: { ownerId: 1 },
      });
    });

    it('should throw ConflictException if club name already exists (case-insensitive)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockOwner);
      mockPrisma.sportClub.count.mockResolvedValue(0);
      mockPrisma.sportClub.findFirst.mockResolvedValue({
        id: 2,
        name: 'existing club',
      });

      await expect(
        service.create(1, { name: 'Existing Club' }),
      ).rejects.toThrow(ConflictException);
      expect(mockPrisma.sportClub.findFirst).toHaveBeenCalledWith({
        where: { name: { equals: 'Existing Club', mode: 'insensitive' } },
      });
    });

    it('should throw ConflictException if club name already exists with different case', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockOwner);
      mockPrisma.sportClub.count.mockResolvedValue(0);
      mockPrisma.sportClub.findFirst.mockResolvedValue({
        id: 2,
        name: 'MY CLUB',
      });

      await expect(service.create(1, { name: 'my club' })).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('findAllByOwner', () => {
    it('should return paginated clubs with counts', async () => {
      mockPrisma.sportClub.findMany.mockResolvedValue([mockClubWithCounts]);
      mockPrisma.sportClub.count.mockResolvedValue(1);

      const result = await service.findAllByOwner(1);

      expect(result.data).toHaveLength(1);
      expect(result.data[0]._count).toEqual({
        members: 5,
        sessions: 10,
        courts: 3,
      });
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
      mockPrisma.sportClub.findUnique.mockResolvedValue({
        ...mockClub,
        ownerId: 1,
      });

      await expect(service.update(1, 999, { name: 'Hacked' })).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw ConflictException when name already exists (case-insensitive)', async () => {
      mockPrisma.sportClub.findUnique.mockResolvedValueOnce(mockClub);
      mockPrisma.sportClub.findFirst.mockResolvedValueOnce({
        id: 2,
        name: 'Taken Name',
      });

      await expect(
        service.update(1, 1, { name: 'Taken Name' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException when name already exists with different case', async () => {
      mockPrisma.sportClub.findUnique.mockResolvedValueOnce(mockClub);
      mockPrisma.sportClub.findFirst.mockResolvedValueOnce({
        id: 2,
        name: 'TAKEN NAME',
      });

      await expect(
        service.update(1, 1, { name: 'taken name' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException when new name is same as current', async () => {
      mockPrisma.sportClub.findUnique.mockResolvedValueOnce(mockClub);

      await expect(service.update(1, 1, { name: 'Test Club' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException with correct message for same name', async () => {
      mockPrisma.sportClub.findUnique.mockResolvedValueOnce(mockClub);

      try {
        await service.update(1, 1, { name: 'Test Club' });
      } catch (error: any) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toBe(
          'New name must be different from current name',
        );
      }
    });

    it('should trim name before checking and updating', async () => {
      mockPrisma.sportClub.findUnique
        .mockResolvedValueOnce(mockClub)
        .mockResolvedValueOnce(null);
      mockPrisma.sportClub.update.mockResolvedValue({
        ...mockClub,
        name: 'Updated Club',
      });

      const result = await service.update(1, 1, { name: '  Updated Club  ' });

      expect(result.name).toBe('Updated Club');
    });

    it('should not check name uniqueness when name is not provided', async () => {
      mockPrisma.sportClub.findUnique.mockResolvedValueOnce(mockClub);
      mockPrisma.sportClub.update.mockResolvedValue(mockClub);

      const result = await service.update(1, 1, {});

      expect(result.name).toBe('Test Club');
      expect(mockPrisma.sportClub.findFirst).not.toHaveBeenCalled();
    });

    it('should exclude current club from name uniqueness check', async () => {
      mockPrisma.sportClub.findUnique
        .mockResolvedValueOnce(mockClub)
        .mockResolvedValueOnce(null);
      mockPrisma.sportClub.update.mockResolvedValue({
        ...mockClub,
        name: 'New Name',
      });

      await service.update(1, 1, { name: 'New Name' });

      expect(mockPrisma.sportClub.findFirst).toHaveBeenCalledWith({
        where: {
          name: { equals: 'New Name', mode: 'insensitive' },
          id: { not: 1 },
        },
      });
    });
  });

  describe('remove', () => {
    it('should delete club and return success message when owner', async () => {
      mockPrisma.sportClub.findUnique.mockResolvedValue(mockClub);
      mockPrisma.sportClub.delete.mockResolvedValue(mockClub);

      const result = await service.remove(1, 1);

      expect(result.message).toBe('Club deleted successfully');
      expect(mockPrisma.sportClub.delete).toHaveBeenCalledWith({
        where: { id: 1 },
      });
    });

    it('should throw NotFoundException when club not found', async () => {
      mockPrisma.sportClub.findUnique.mockResolvedValue(null);

      await expect(service.remove(999, 1)).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when user is not owner', async () => {
      mockPrisma.sportClub.findUnique.mockResolvedValue({
        ...mockClub,
        ownerId: 1,
      });

      await expect(service.remove(1, 999)).rejects.toThrow(ForbiddenException);
    });
  });
});
