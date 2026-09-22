import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { SportMembersService } from './sport-members.service.js';
import { PrismaService } from '../config/prisma/prisma.service.js';
import type { SportClub } from '../../prisma/generated/prisma/client.js';

describe('SportMembersService', () => {
  let service: SportMembersService;
  let mockPrisma: {
    clubMember: {
      findFirst: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
    };
  };

  const mockClub = {
    id: 'club-1',
    name: 'Test Club',
    slug: 'test-club',
    ownerId: 'owner-1',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  } satisfies SportClub;

  const mockMember = {
    id: 'member-1',
    clubId: 'club-1',
    userId: null,
    displayName: 'John Doe',
    role: 'MEMBER',
    gender: 'MALE',
    skillLevel: 'BEGINNER',
    isGuest: false,
    joinedAt: new Date('2026-01-01'),
    user: null,
  };

  beforeEach(async () => {
    mockPrisma = {
      clubMember: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SportMembersService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<SportMembersService>(SportMembersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a member scoped to the club', async () => {
      mockPrisma.clubMember.findFirst.mockResolvedValue(null);
      mockPrisma.clubMember.create.mockResolvedValue(mockMember);

      const result = await service.create(mockClub, {
        displayName: 'John Doe',
      });

      expect(result).toEqual(mockMember);
      expect(mockPrisma.clubMember.create).toHaveBeenCalledWith({
        data: {
          clubId: 'club-1',
          displayName: 'John Doe',
          isGuest: false,
          role: 'MEMBER',
        },
        select: expect.any(Object),
      });
    });

    it('should include optional gender, skillLevel and isGuest', async () => {
      mockPrisma.clubMember.findFirst.mockResolvedValue(null);
      mockPrisma.clubMember.create.mockResolvedValue(mockMember);

      await service.create(mockClub, {
        displayName: 'John Doe',
        gender: 'MALE',
        skillLevel: 'ADVANCE',
        isGuest: true,
      });

      expect(mockPrisma.clubMember.create).toHaveBeenCalledWith({
        data: {
          clubId: 'club-1',
          displayName: 'John Doe',
          isGuest: true,
          role: 'MEMBER',
          gender: 'MALE',
          skillLevel: 'ADVANCE',
        },
        select: expect.any(Object),
      });
    });

    it('should throw ConflictException when displayName already exists', async () => {
      mockPrisma.clubMember.findFirst.mockResolvedValue(mockMember);

      await expect(
        service.create(mockClub, { displayName: 'John Doe' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findAllByClub', () => {
    it('should return paginated members for the club', async () => {
      mockPrisma.clubMember.findMany.mockResolvedValue([mockMember]);
      mockPrisma.clubMember.count.mockResolvedValue(1);

      const result = await service.findAllByClub(mockClub);

      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual({ page: 1, limit: 20, total: 1 });
      expect(mockPrisma.clubMember.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { clubId: 'club-1' } }),
      );
    });

    it('should apply filters and pagination', async () => {
      mockPrisma.clubMember.findMany.mockResolvedValue([]);
      mockPrisma.clubMember.count.mockResolvedValue(0);

      await service.findAllByClub(mockClub, 2, 5, {
        role: 'ADMIN',
        skillLevel: 'ADVANCE',
        isGuest: true,
        search: 'john',
      });

      expect(mockPrisma.clubMember.findMany).toHaveBeenCalledWith({
        where: {
          clubId: 'club-1',
          role: 'ADMIN',
          skillLevel: 'ADVANCE',
          isGuest: true,
          displayName: { contains: 'john', mode: 'insensitive' },
        },
        select: expect.any(Object),
        orderBy: { joinedAt: 'desc' },
        skip: 5,
        take: 5,
      });
    });
  });

  describe('findOne', () => {
    it('should return a member scoped to the club', async () => {
      mockPrisma.clubMember.findFirst.mockResolvedValue(mockMember);

      const result = await service.findOne(mockClub, 'member-1');

      expect(result).toEqual(mockMember);
      expect(mockPrisma.clubMember.findFirst).toHaveBeenCalledWith({
        where: { id: 'member-1', clubId: 'club-1' },
        select: expect.any(Object),
      });
    });

    it('should throw NotFoundException when member not in club', async () => {
      mockPrisma.clubMember.findFirst.mockResolvedValue(null);

      await expect(service.findOne(mockClub, 'member-999')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should allow the owner to promote a member to admin', async () => {
      mockPrisma.clubMember.findFirst.mockResolvedValue(mockMember);
      mockPrisma.clubMember.update.mockResolvedValue({
        ...mockMember,
        role: 'ADMIN',
      });

      const result = await service.update('owner-1', mockClub, 'member-1', {
        role: 'ADMIN',
      });

      expect(result.role).toBe('ADMIN');
      expect(mockPrisma.clubMember.update).toHaveBeenCalledWith({
        where: { id: 'member-1' },
        data: { role: 'ADMIN' },
        select: expect.any(Object),
      });
    });

    it('should reject assigning the OWNER role', async () => {
      mockPrisma.clubMember.findFirst.mockResolvedValue(mockMember);

      await expect(
        service.update('owner-1', mockClub, 'member-1', { role: 'OWNER' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject role changes by an admin', async () => {
      mockPrisma.clubMember.findFirst.mockResolvedValue(mockMember);

      await expect(
        service.update('admin-1', mockClub, 'member-1', { role: 'ADMIN' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject changing the owner role', async () => {
      mockPrisma.clubMember.findFirst.mockResolvedValue({
        ...mockMember,
        role: 'OWNER',
      });

      await expect(
        service.update('owner-1', mockClub, 'owner-row', { role: 'MEMBER' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ConflictException on duplicate displayName', async () => {
      mockPrisma.clubMember.findFirst
        .mockResolvedValueOnce(mockMember)
        .mockResolvedValueOnce({ id: 'member-2' });

      await expect(
        service.update('owner-1', mockClub, 'member-1', {
          displayName: 'Taken Name',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should update skillLevel for an admin', async () => {
      mockPrisma.clubMember.findFirst.mockResolvedValue(mockMember);
      mockPrisma.clubMember.update.mockResolvedValue({
        ...mockMember,
        skillLevel: 'ADVANCE',
      });

      const result = await service.update('admin-1', mockClub, 'member-1', {
        skillLevel: 'ADVANCE',
      });

      expect(result.skillLevel).toBe('ADVANCE');
      expect(mockPrisma.clubMember.update).toHaveBeenCalledWith({
        where: { id: 'member-1' },
        data: { skillLevel: 'ADVANCE' },
        select: expect.any(Object),
      });
    });

    it('should throw NotFoundException when member not found', async () => {
      mockPrisma.clubMember.findFirst.mockResolvedValue(null);

      await expect(
        service.update('owner-1', mockClub, 'missing', {
          displayName: 'New Name',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should allow the owner to remove a member', async () => {
      mockPrisma.clubMember.findFirst.mockResolvedValue(mockMember);
      mockPrisma.clubMember.delete.mockResolvedValue(mockMember);

      const result = await service.remove('owner-1', mockClub, 'member-1');

      expect(result.message).toBe('Member removed successfully');
      expect(mockPrisma.clubMember.delete).toHaveBeenCalledWith({
        where: { id: 'member-1' },
      });
    });

    it('should reject an admin removing another admin', async () => {
      mockPrisma.clubMember.findFirst.mockResolvedValue({
        ...mockMember,
        role: 'ADMIN',
      });

      await expect(
        service.remove('admin-1', mockClub, 'member-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject removing the club owner', async () => {
      mockPrisma.clubMember.findFirst.mockResolvedValue({
        ...mockMember,
        role: 'OWNER',
      });

      await expect(
        service.remove('owner-1', mockClub, 'owner-row'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when member not found', async () => {
      mockPrisma.clubMember.findFirst.mockResolvedValue(null);

      await expect(
        service.remove('owner-1', mockClub, 'missing'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
