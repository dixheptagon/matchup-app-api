import { Test, TestingModule } from '@nestjs/testing';
import { TokenService } from './token.service.js';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../config/prisma/prisma.service.js';
import { createHash } from 'node:crypto';

describe('TokenService', () => {
  let service: TokenService;

  const mockJwtService = {
    sign: vi.fn(),
    verify: vi.fn(),
  };

  const mockConfigService = {
    get: vi.fn(),
  };

  const mockPrisma = {
    refreshSession: {
      create: vi.fn(),
      findFirst: vi.fn(),
      updateMany: vi.fn(),
    },
  };

  const mockUser = {
    id: '3',
    name: 'Foren tino',
    email: 'forentino06@gmail.com',
    isVerified: true,
    gender: 'MALE' as const,
    username: null,
    usernameChangedAt: null,
    createdAt: new Date('2026-09-14'),
    updatedAt: new Date('2026-09-14'),
    deletedAt: null,
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    mockConfigService.get.mockImplementation((key: string) => {
      const config: Record<string, string> = {
        JWT_ACCESS_SECRET: 'test-access-secret-key-32chars!!!!',
        JWT_REFRESH_SECRET: 'test-refresh-secret-key-32chars!!!',
        JWT_ACCESS_EXPIRATION: '15m',
        JWT_REFRESH_EXPIRATION: '7d',
      };
      return config[key];
    });

    mockJwtService.sign.mockReturnValue('mock-jwt-token');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenService,
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<TokenService>(TokenService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('signAccessToken', () => {
    it('should call jwtService.sign with correct payload and options', () => {
      service.signAccessToken(mockUser);

      expect(mockJwtService.sign).toHaveBeenCalledWith(
        {
          sub: mockUser.id,
          email: mockUser.email,
          name: mockUser.name,
        },
        {
          secret: 'test-access-secret-key-32chars!!!!',
          expiresIn: '15m',
        },
      );
    });

    it('should return the signed token', () => {
      const result = service.signAccessToken(mockUser);
      expect(result).toBe('mock-jwt-token');
    });
  });

  describe('signRefreshToken', () => {
    it('should call jwtService.sign with userId and refresh options', () => {
      service.signRefreshToken(mockUser.id);

      expect(mockJwtService.sign).toHaveBeenCalledWith(
        { sub: mockUser.id },
        {
          secret: 'test-refresh-secret-key-32chars!!!',
          expiresIn: '7d',
        },
      );
    });

    it('should return the signed token', () => {
      const result = service.signRefreshToken(mockUser.id);
      expect(result).toBe('mock-jwt-token');
    });
  });

  describe('hashToken', () => {
    it('should return SHA-256 hash of the token', () => {
      const token = 'test-token-12345';
      const expectedHash = createHash('sha256').update(token).digest('hex');

      const result = service.hashToken(token);
      expect(result).toBe(expectedHash);
    });

    it('should return consistent hash for same input', () => {
      const token = 'consistent-token';
      const hash1 = service.hashToken(token);
      const hash2 = service.hashToken(token);
      expect(hash1).toBe(hash2);
    });

    it('should return different hash for different input', () => {
      const hash1 = service.hashToken('token-a');
      const hash2 = service.hashToken('token-b');
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('createRefreshSession', () => {
    it('should create a refresh session in the database', async () => {
      const token = 'test-refresh-token';
      const metadata = {
        deviceName: 'Chrome on Windows',
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0 Chrome/120',
      };

      mockPrisma.refreshSession.create.mockResolvedValue({
        id: 1,
        userId: mockUser.id,
        hashedToken: service.hashToken(token),
        ...metadata,
        expiredAt: new Date(),
        createdAt: new Date(),
        revokedAt: null,
      });

      const result = await service.createRefreshSession(
        mockUser.id,
        token,
        metadata,
      );

      expect(mockPrisma.refreshSession.create).toHaveBeenCalledWith({
        data: {
          userId: mockUser.id,
          hashedToken: service.hashToken(token),
          deviceName: metadata.deviceName,
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
          expiredAt: expect.any(Date),
        },
      });

      expect(result).toBeDefined();
    });

    it('should hash the token before storing', async () => {
      const token = 'plain-text-token';

      mockPrisma.refreshSession.create.mockResolvedValue({ id: 1 });

      await service.createRefreshSession(mockUser.id, token, {
        deviceName: 'Test',
        ipAddress: '127.0.0.1',
        userAgent: 'Test',
      });

      const createCall = mockPrisma.refreshSession.create.mock.calls[0][0];
      expect(createCall.data.hashedToken).toBe(
        createHash('sha256').update(token).digest('hex'),
      );
      expect(createCall.data.hashedToken).not.toBe(token);
    });
  });

  describe('validateRefreshSession', () => {
    it('should return session when valid token exists', async () => {
      const token = 'valid-refresh-token';
      const hashedToken = service.hashToken(token);

      const mockSession = {
        id: 1,
        userId: mockUser.id,
        hashedToken,
        expiredAt: new Date(Date.now() + 86400000),
        revokedAt: null,
      };

      mockPrisma.refreshSession.findFirst.mockResolvedValue(mockSession);

      const result = await service.validateRefreshSession(token);

      expect(mockPrisma.refreshSession.findFirst).toHaveBeenCalledWith({
        where: {
          hashedToken,
          revokedAt: null,
          expiredAt: { gt: expect.any(Date) },
        },
      });
      expect(result).toEqual(mockSession);
    });

    it('should return null when token not found', async () => {
      mockPrisma.refreshSession.findFirst.mockResolvedValue(null);

      const result = await service.validateRefreshSession('nonexistent-token');
      expect(result).toBeNull();
    });
  });

  describe('revokeRefreshSession', () => {
    it('should update revokedAt on matching session', async () => {
      const token = 'token-to-revoke';

      mockPrisma.refreshSession.updateMany.mockResolvedValue({ count: 1 });

      await service.revokeRefreshSession(token);

      expect(mockPrisma.refreshSession.updateMany).toHaveBeenCalledWith({
        where: { hashedToken: service.hashToken(token) },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });

  describe('revokeAllUserSessions', () => {
    it('should revoke all active sessions for a user', async () => {
      mockPrisma.refreshSession.updateMany.mockResolvedValue({ count: 3 });

      await service.revokeAllUserSessions(mockUser.id);

      expect(mockPrisma.refreshSession.updateMany).toHaveBeenCalledWith({
        where: { userId: mockUser.id, revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });

  describe('parseExpiration (via createRefreshSession)', () => {
    it('should parse "15m" as 900000ms', async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'JWT_REFRESH_EXPIRATION') return '15m';
        return 'test';
      });

      mockPrisma.refreshSession.create.mockResolvedValue({ id: 1 });

      const before = Date.now();
      await service.createRefreshSession(mockUser.id, 'token', {
        deviceName: 'Test',
        ipAddress: '127.0.0.1',
        userAgent: 'Test',
      });
      const after = Date.now();

      const createCall = mockPrisma.refreshSession.create.mock.calls[0][0];
      const expiredAt = createCall.data.expiredAt.getTime();
      const expectedMs = 15 * 60 * 1000;

      expect(expiredAt).toBeGreaterThanOrEqual(before + expectedMs);
      expect(expiredAt).toBeLessThanOrEqual(after + expectedMs);
    });

    it('should parse "7d" as 604800000ms', async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'JWT_REFRESH_EXPIRATION') return '7d';
        return 'test';
      });

      mockPrisma.refreshSession.create.mockResolvedValue({ id: 1 });

      const before = Date.now();
      await service.createRefreshSession(mockUser.id, 'token', {
        deviceName: 'Test',
        ipAddress: '127.0.0.1',
        userAgent: 'Test',
      });
      const after = Date.now();

      const createCall = mockPrisma.refreshSession.create.mock.calls[0][0];
      const expiredAt = createCall.data.expiredAt.getTime();
      const expectedMs = 7 * 24 * 60 * 60 * 1000;

      expect(expiredAt).toBeGreaterThanOrEqual(before + expectedMs);
      expect(expiredAt).toBeLessThanOrEqual(after + expectedMs);
    });

    it('should default to 7 days for invalid format', async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'JWT_REFRESH_EXPIRATION') return 'invalid';
        return 'test';
      });

      mockPrisma.refreshSession.create.mockResolvedValue({ id: 1 });

      const before = Date.now();
      await service.createRefreshSession(mockUser.id, 'token', {
        deviceName: 'Test',
        ipAddress: '127.0.0.1',
        userAgent: 'Test',
      });
      const after = Date.now();

      const createCall = mockPrisma.refreshSession.create.mock.calls[0][0];
      const expiredAt = createCall.data.expiredAt.getTime();
      const expectedMs = 7 * 24 * 60 * 60 * 1000;

      expect(expiredAt).toBeGreaterThanOrEqual(before + expectedMs);
      expect(expiredAt).toBeLessThanOrEqual(after + expectedMs);
    });
  });
});
