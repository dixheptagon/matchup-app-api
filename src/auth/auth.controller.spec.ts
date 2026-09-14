import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { GoogleAuthGuard } from './guards/google.guard.js';

describe('AuthController', () => {
  let controller: AuthController;

  const mockAuthService = {
    generateTokens: vi.fn(),
    refreshTokens: vi.fn(),
    logout: vi.fn(),
    getProfile: vi.fn(),
  };

  const mockUser = {
    id: 3,
    email: 'forentino06@gmail.com',
    name: 'Foren tino',
  };

  const mockTokens = {
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token',
    user: {
      id: 3,
      name: 'Foren tino',
      email: 'forentino06@gmail.com',
      isVerified: true,
    },
  };

  const mockRequest = {
    user: mockUser,
    headers: {
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
    },
    ip: '127.0.0.1',
    socket: { remoteAddress: '127.0.0.1' },
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    mockAuthService.generateTokens.mockResolvedValue(mockTokens);
    mockAuthService.refreshTokens.mockResolvedValue(mockTokens);
    mockAuthService.logout.mockResolvedValue(undefined);
    mockAuthService.getProfile.mockResolvedValue(mockTokens.user);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(GoogleAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('googleAuthCallback', () => {
    it('should return tokens from authService', async () => {
      const result = await controller.googleAuthCallback(mockRequest as any);

      expect(result).toEqual(mockTokens);
    });

    it('should call authService.generateTokens with user and metadata', async () => {
      await controller.googleAuthCallback(mockRequest as any);

      expect(mockAuthService.generateTokens).toHaveBeenCalledWith(
        mockUser,
        expect.objectContaining({
          deviceName: expect.any(String),
          ipAddress: '127.0.0.1',
          userAgent: mockRequest.headers['user-agent'],
        }),
      );
    });

    it('should parse device name from user-agent', async () => {
      await controller.googleAuthCallback(mockRequest as any);

      const callArgs = mockAuthService.generateTokens.mock.calls[0][1];
      expect(callArgs.deviceName).toBe('Chrome on Windows');
    });
  });

  describe('refreshTokens', () => {
    it('should return tokens from authService', async () => {
      const dto = { refreshToken: 'old-refresh-token' };

      const result = await controller.refreshTokens(dto, mockRequest as any);

      expect(result).toEqual(mockTokens);
    });

    it('should call authService.refreshTokens with dto and metadata', async () => {
      const dto = { refreshToken: 'old-refresh-token' };

      await controller.refreshTokens(dto, mockRequest as any);

      expect(mockAuthService.refreshTokens).toHaveBeenCalledWith(
        dto.refreshToken,
        expect.objectContaining({
          deviceName: expect.any(String),
          ipAddress: '127.0.0.1',
          userAgent: mockRequest.headers['user-agent'],
        }),
      );
    });
  });

  describe('logout', () => {
    it('should return success message', async () => {
      const dto = { refreshToken: 'token-to-revoke' };

      const result = await controller.logout(dto);

      expect(result).toEqual({ message: 'Logged out successfully' });
    });

    it('should call authService.logout with the token', async () => {
      const dto = { refreshToken: 'token-to-revoke' };

      await controller.logout(dto);

      expect(mockAuthService.logout).toHaveBeenCalledWith(dto.refreshToken);
    });
  });

  describe('getProfile', () => {
    it('should return user profile', async () => {
      const req = { user: mockUser } as any;

      const result = await controller.getProfile(req);

      expect(result).toEqual(mockTokens.user);
    });

    it('should call authService.getProfile with user id', async () => {
      const req = { user: mockUser } as any;

      await controller.getProfile(req);

      expect(mockAuthService.getProfile).toHaveBeenCalledWith(mockUser.id);
    });
  });

  describe('parseDeviceName (via googleAuthCallback)', () => {
    it('should detect Chrome on Windows', async () => {
      const req = {
        ...mockRequest,
        headers: {
          'user-agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        },
      };

      await controller.googleAuthCallback(req as any);

      const callArgs = mockAuthService.generateTokens.mock.calls[0][1];
      expect(callArgs.deviceName).toBe('Chrome on Windows');
    });

    it('should detect Firefox on Mac', async () => {
      const req = {
        ...mockRequest,
        headers: {
          'user-agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Gecko/20100101 Firefox/121.0',
        },
      };

      await controller.googleAuthCallback(req as any);

      const callArgs = mockAuthService.generateTokens.mock.calls[0][1];
      expect(callArgs.deviceName).toBe('Firefox on Mac');
    });

    it('should detect Edge on Windows', async () => {
      const req = {
        ...mockRequest,
        headers: {
          'user-agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Edg/120.0.0.0',
        },
      };

      await controller.googleAuthCallback(req as any);

      const callArgs = mockAuthService.generateTokens.mock.calls[0][1];
      expect(callArgs.deviceName).toBe('Edge on Windows');
    });

    it('should detect Safari on Mac', async () => {
      const req = {
        ...mockRequest,
        headers: {
          'user-agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15',
        },
      };

      await controller.googleAuthCallback(req as any);

      const callArgs = mockAuthService.generateTokens.mock.calls[0][1];
      expect(callArgs.deviceName).toBe('Safari on Mac');
    });

    it('should return Unknown on Unknown for empty user-agent', async () => {
      const req = {
        ...mockRequest,
        headers: { 'user-agent': '' },
      };

      await controller.googleAuthCallback(req as any);

      const callArgs = mockAuthService.generateTokens.mock.calls[0][1];
      expect(callArgs.deviceName).toBe('Unknown on Unknown');
    });

    it('should fallback to unknown for missing user-agent', async () => {
      const req = {
        ...mockRequest,
        headers: {},
      };

      await controller.googleAuthCallback(req as any);

      const callArgs = mockAuthService.generateTokens.mock.calls[0][1];
      expect(callArgs.userAgent).toBe('unknown');
    });
  });
});
