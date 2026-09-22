import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service.js';
import { PrismaService } from '../config/prisma/prisma.service.js';
import { EnvConfigService } from '../config/env/env.service.js';
import {
  ConflictException,
  NotFoundException,
  BadRequestException,
  HttpException,
} from '@nestjs/common';

describe('UsersService', () => {
  let service: UsersService;
  let mockPrisma: {
    user: {
      findUnique: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
  };
  let mockEnv: { get: ReturnType<typeof vi.fn> };

  const userId = '1';
  const existingUser = {
    id: userId,
    name: 'Test User',
    username: 'testuser',
    email: 'test@example.com',
    gender: 'MALE',
    isVerified: true,
    usernameChangedAt: null as Date | null,
    createdAt: new Date(),
    deletedAt: null,
  };

  beforeEach(async () => {
    mockPrisma = {
      user: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
    };
    mockEnv = { get: vi.fn().mockReturnValue(0) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EnvConfigService, useValue: mockEnv },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('updateProfile', () => {
    it('should update username and gender', async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(existingUser)
        .mockResolvedValueOnce(null);
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

    it('should lowercase the username before saving', async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(existingUser)
        .mockResolvedValueOnce(null);
      mockPrisma.user.update.mockResolvedValue({
        ...existingUser,
        username: 'newusername',
      });

      await service.updateProfile(userId, { username: 'NewUserName' });

      expect(mockPrisma.user.findUnique).toHaveBeenLastCalledWith({
        where: { username: 'newusername' },
      });
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ username: 'newusername' }),
        }),
      );
    });

    it('should set usernameChangedAt when the username changes', async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(existingUser)
        .mockResolvedValueOnce(null);
      mockPrisma.user.update.mockResolvedValue(existingUser);

      await service.updateProfile(userId, { username: 'newusername' });

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            username: 'newusername',
            usernameChangedAt: expect.any(Date),
          }),
        }),
      );
    });

    it('should update the name without a uniqueness check', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(existingUser);
      mockPrisma.user.update.mockResolvedValue({
        ...existingUser,
        name: 'New Name',
      });

      const result = await service.updateProfile(userId, {
        name: 'New Name',
      });

      expect(result.name).toBe('New Name');
      expect(mockPrisma.user.findUnique).toHaveBeenCalledTimes(1);
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { name: 'New Name' } }),
      );
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
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(existingUser)
        .mockResolvedValueOnce({ id: '2', username: 'taken' });

      await expect(
        service.updateProfile(userId, { username: 'taken' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should not conflict when the username belongs to the same user', async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce({
          ...existingUser,
          username: 'oldname',
        })
        .mockResolvedValueOnce({ id: userId, username: 'newname' });
      mockPrisma.user.update.mockResolvedValue({
        ...existingUser,
        username: 'newname',
      });

      const result = await service.updateProfile(userId, {
        username: 'newname',
      });

      expect(result.username).toBe('newname');
    });

    it('should throw BadRequestException if new username is same as current', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(existingUser);

      await expect(
        service.updateProfile(userId, { username: 'testuser' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException with correct message for same username', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(existingUser);

      try {
        await service.updateProfile(userId, { username: 'testuser' });
      } catch (error: any) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toBe(
          'New username must be different from current username',
        );
      }
    });

    it('should update only gender when username not provided', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(existingUser);
      mockPrisma.user.update.mockResolvedValue({
        ...existingUser,
        gender: 'FEMALE',
      });

      const result = await service.updateProfile(userId, {
        gender: 'FEMALE',
      });

      expect(result.gender).toBe('FEMALE');
      expect(result.username).toBe('testuser');
      expect(mockPrisma.user.findUnique).toHaveBeenCalledTimes(1);
    });

    it('should update only username when gender not provided', async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(existingUser)
        .mockResolvedValueOnce(null);
      mockPrisma.user.update.mockResolvedValue({
        ...existingUser,
        username: 'anothername',
      });

      const result = await service.updateProfile(userId, {
        username: 'anothername',
      });

      expect(result.username).toBe('anothername');
    });

    describe('username change cooldown', () => {
      it('should allow the change when cooldown is disabled', async () => {
        mockEnv.get.mockReturnValue(0);
        mockPrisma.user.findUnique
          .mockResolvedValueOnce({
            ...existingUser,
            usernameChangedAt: new Date(),
          })
          .mockResolvedValueOnce(null);
        mockPrisma.user.update.mockResolvedValue({
          ...existingUser,
          username: 'newusername',
        });

        const result = await service.updateProfile(userId, {
          username: 'newusername',
        });

        expect(result.username).toBe('newusername');
      });

      it('should throw a 429 error when within the cooldown', async () => {
        mockEnv.get.mockReturnValue(14);
        mockPrisma.user.findUnique
          .mockResolvedValueOnce({
            ...existingUser,
            usernameChangedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
          })
          .mockResolvedValueOnce(null);

        await expect(
          service.updateProfile(userId, { username: 'newusername' }),
        ).rejects.toThrow(HttpException);
      });

      it('should allow the change once the cooldown has expired', async () => {
        mockEnv.get.mockReturnValue(14);
        mockPrisma.user.findUnique
          .mockResolvedValueOnce({
            ...existingUser,
            usernameChangedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
          })
          .mockResolvedValueOnce(null);
        mockPrisma.user.update.mockResolvedValue({
          ...existingUser,
          username: 'newusername',
        });

        const result = await service.updateProfile(userId, {
          username: 'newusername',
        });

        expect(result.username).toBe('newusername');
      });
    });
  });
});
