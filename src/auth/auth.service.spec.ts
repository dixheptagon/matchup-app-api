import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service.js';
import { PrismaService } from '../config/prisma/prisma.service.js';
import { TokenService } from './token.service.js';
import { UnauthorizedException } from '@nestjs/common';

describe('AuthService', () => {
  let service: AuthService;

  const mockPrisma = {
    authAccount: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  };

  const mockTokenService = {
    signAccessToken: vi.fn(),
    signRefreshToken: vi.fn(),
    createRefreshSession: vi.fn(),
    revokeRefreshSession: vi.fn(),
    validateRefreshSession: vi.fn(),
  };

  const mockUser = {
    id: 3,
    name: 'Foren tino',
    email: 'forentino06@gmail.com',
    isVerified: true,
    gender: 'MALE' as const,
    username: null,
    createdAt: new Date('2026-09-14'),
    updatedAt: new Date('2026-09-14'),
    deletedAt: null,
  };

  const mockGoogleProfile = {
    id: 'google-id-12345',
    email: 'forentino06@gmail.com',
    displayName: 'Foren tino',
    photos: [{ value: 'https://photo.jpg' }],
  };

  const mockMetadata = {
    deviceName: 'Chrome on Windows',
    ipAddress: '127.0.0.1',
    userAgent: 'Mozilla/5.0 Chrome/120',
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    mockTokenService.signAccessToken.mockReturnValue('mock-access-token');
    mockTokenService.signRefreshToken.mockReturnValue('mock-refresh-token');
    mockTokenService.createRefreshSession.mockResolvedValue({ id: 1 });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: TokenService, useValue: mockTokenService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateGoogleUser', () => {
    it('should return existing user when Google account already exists', async () => {
      const existingAccount = {
        id: 1,
        userId: mockUser.id,
        provider: 'google',
        providerAccountId: mockGoogleProfile.id,
        user: mockUser,
      };

      mockPrisma.authAccount.findFirst.mockResolvedValue(existingAccount);

      const result = await service.validateGoogleUser(mockGoogleProfile);

      expect(mockPrisma.authAccount.findFirst).toHaveBeenCalledWith({
        where: {
          provider: 'google',
          providerAccountId: mockGoogleProfile.id,
        },
        include: { user: true },
      });
      expect(result).toEqual(mockUser);
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });

    it('should link Google account to existing user by email', async () => {
      mockPrisma.authAccount.findFirst.mockResolvedValue(null);
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.authAccount.create.mockResolvedValue({
        id: 1,
        userId: mockUser.id,
        provider: 'google',
        providerAccountId: mockGoogleProfile.id,
      });

      const result = await service.validateGoogleUser(mockGoogleProfile);

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: mockGoogleProfile.email },
      });
      expect(mockPrisma.authAccount.create).toHaveBeenCalledWith({
        data: {
          userId: mockUser.id,
          provider: 'google',
          providerAccountId: mockGoogleProfile.id,
        },
      });
      expect(result).toEqual(mockUser);
    });

    it('should create new user when no account or email match', async () => {
      const newUser = { ...mockUser, id: 4 };
      const newGoogleProfile = {
        id: 'new-google-id',
        email: 'newuser@gmail.com',
        displayName: 'New User',
        photos: [],
      };

      mockPrisma.authAccount.findFirst.mockResolvedValue(null);
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue(newUser);

      const result = await service.validateGoogleUser(newGoogleProfile);

      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: {
          name: newGoogleProfile.displayName,
          email: newGoogleProfile.email,
          isVerified: true,
          authAccounts: {
            create: {
              provider: 'google',
              providerAccountId: newGoogleProfile.id,
            },
          },
        },
      });
      expect(result).toEqual(newUser);
    });

    it('should set isVerified to false when email is null', async () => {
      const profileNoEmail = {
        id: 'google-no-email',
        email: null as unknown as string,
        displayName: 'No Email User',
        photos: [],
      };

      mockPrisma.authAccount.findFirst.mockResolvedValue(null);
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        ...mockUser,
        isVerified: false,
      });

      await service.validateGoogleUser(profileNoEmail);

      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          isVerified: false,
        }),
      });
    });
  });

  describe('generateTokens', () => {
    it('should return access token, refresh token, and user info', async () => {
      const result = await service.generateTokens(mockUser, mockMetadata);

      expect(result).toEqual({
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        user: {
          id: mockUser.id,
          name: mockUser.name,
          email: mockUser.email,
          isVerified: mockUser.isVerified,
        },
      });
    });

    it('should call tokenService.signAccessToken with user', async () => {
      await service.generateTokens(mockUser, mockMetadata);

      expect(mockTokenService.signAccessToken).toHaveBeenCalledWith(mockUser);
    });

    it('should call tokenService.signRefreshToken with userId', async () => {
      await service.generateTokens(mockUser, mockMetadata);

      expect(mockTokenService.signRefreshToken).toHaveBeenCalledWith(
        mockUser.id,
      );
    });

    it('should call tokenService.createRefreshSession with correct args', async () => {
      await service.generateTokens(mockUser, mockMetadata);

      expect(mockTokenService.createRefreshSession).toHaveBeenCalledWith(
        mockUser.id,
        'mock-refresh-token',
        mockMetadata,
      );
    });
  });

  describe('refreshTokens', () => {
    it('should return new tokens when refresh token is valid', async () => {
      const session = { id: 1, userId: mockUser.id };

      mockTokenService.validateRefreshSession.mockResolvedValue(session);
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockTokenService.signAccessToken.mockReturnValue('new-access-token');
      mockTokenService.signRefreshToken.mockReturnValue('new-refresh-token');

      const result = await service.refreshTokens(
        'old-refresh-token',
        mockMetadata,
      );

      expect(result).toEqual({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        user: {
          id: mockUser.id,
          name: mockUser.name,
          email: mockUser.email,
          isVerified: mockUser.isVerified,
        },
      });
    });

    it('should revoke old refresh token', async () => {
      const session = { id: 1, userId: mockUser.id };

      mockTokenService.validateRefreshSession.mockResolvedValue(session);
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      await service.refreshTokens('old-refresh-token', mockMetadata);

      expect(mockTokenService.revokeRefreshSession).toHaveBeenCalledWith(
        'old-refresh-token',
      );
    });

    it('should create new refresh session', async () => {
      const session = { id: 1, userId: mockUser.id };

      mockTokenService.validateRefreshSession.mockResolvedValue(session);
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      await service.refreshTokens('old-refresh-token', mockMetadata);

      expect(mockTokenService.createRefreshSession).toHaveBeenCalledWith(
        mockUser.id,
        'mock-refresh-token',
        mockMetadata,
      );
    });

    it('should throw UnauthorizedException when token is invalid', async () => {
      mockTokenService.validateRefreshSession.mockResolvedValue(null);

      await expect(
        service.refreshTokens('invalid-token', mockMetadata),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when user not found', async () => {
      const session = { id: 1, userId: 999 };

      mockTokenService.validateRefreshSession.mockResolvedValue(session);
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.refreshTokens('valid-token', mockMetadata),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when user is soft-deleted', async () => {
      const session = { id: 1, userId: mockUser.id };
      const deletedUser = { ...mockUser, deletedAt: new Date() };

      mockTokenService.validateRefreshSession.mockResolvedValue(session);
      mockPrisma.user.findUnique.mockResolvedValue(deletedUser);

      await expect(
        service.refreshTokens('valid-token', mockMetadata),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('should call revokeRefreshSession with the token', async () => {
      await service.logout('refresh-token-to-revoke');

      expect(mockTokenService.revokeRefreshSession).toHaveBeenCalledWith(
        'refresh-token-to-revoke',
      );
    });
  });

  describe('getProfile', () => {
    it('should return user profile', async () => {
      const profileData = {
        id: mockUser.id,
        name: mockUser.name,
        username: mockUser.username,
        email: mockUser.email,
        gender: mockUser.gender,
        isVerified: mockUser.isVerified,
        createdAt: mockUser.createdAt,
      };

      mockPrisma.user.findUnique.mockResolvedValue(profileData);

      const result = await service.getProfile(mockUser.id);

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        select: {
          id: true,
          name: true,
          username: true,
          email: true,
          gender: true,
          isVerified: true,
          createdAt: true,
        },
      });
      expect(result).toEqual(profileData);
    });

    it('should throw UnauthorizedException when user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getProfile(999)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
