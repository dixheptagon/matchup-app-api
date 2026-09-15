import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service.js';
import { PrismaService } from '../config/prisma/prisma.service.js';
import { ConflictException, NotFoundException } from '@nestjs/common';

describe('UsersService', () => {
  let service: UsersService;
  let mockPrisma: {
    user: {
      findUnique: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(async () => {
    mockPrisma = {
      user: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('updateProfile', () => {
    const userId = 1;
    const existingUser = {
      id: userId,
      name: 'Test User',
      username: 'testuser',
      email: 'test@example.com',
      gender: 'MALE',
      isVerified: true,
      createdAt: new Date(),
      deletedAt: null,
    };

    it('should update username and gender', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(existingUser);
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.user.update.mockResolvedValue({
        ...existingUser,
        username: 'newusername',
        gender: 'FEMALE',
      });

      const result = await service.updateProfile(userId, {
        username: 'newusername',
        gender: 'FEMALE',
      });

      expect(result.username).toBe('newusername');
      expect(result.gender).toBe('FEMALE');
    });

    it('should throw NotFoundException if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.updateProfile(userId, { username: 'new' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if user is deleted', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...existingUser,
        deletedAt: new Date(),
      });

      await expect(
        service.updateProfile(userId, { username: 'new' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if username already taken', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(existingUser);
      mockPrisma.user.findFirst.mockResolvedValue({ id: 2, username: 'taken' });

      await expect(
        service.updateProfile(userId, { username: 'taken' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should allow keeping the same username', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(existingUser);
      mockPrisma.user.update.mockResolvedValue(existingUser);

      const result = await service.updateProfile(userId, {
        username: 'testuser',
      });

      expect(result.username).toBe('testuser');
    });
  });
});
