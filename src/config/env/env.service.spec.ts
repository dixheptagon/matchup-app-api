import { Test, TestingModule } from '@nestjs/testing';
import { EnvConfigService } from './env.service.js';
import { ConfigService } from '@nestjs/config';

describe('EnvConfigService', () => {
  let service: EnvConfigService;

  const mockConfigService = {
    get: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EnvConfigService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<EnvConfigService>(EnvConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('isDevelopment', () => {
    it('should return true when NODE_ENV is development', () => {
      mockConfigService.get.mockReturnValue('development');

      expect(service.isDevelopment).toBe(true);
    });

    it('should return false when NODE_ENV is production', () => {
      mockConfigService.get.mockReturnValue('production');

      expect(service.isDevelopment).toBe(false);
    });

    it('should return false when NODE_ENV is test', () => {
      mockConfigService.get.mockReturnValue('test');

      expect(service.isDevelopment).toBe(false);
    });
  });
});
