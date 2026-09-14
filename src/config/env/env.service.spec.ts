import { Test, TestingModule } from "@nestjs/testing";
import { EnvConfigService } from "./env.service.js";
import { ConfigService } from "@nestjs/config";

describe("EnvConfigService", () => {
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

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("get", () => {
    it("should return PORT value", () => {
      mockConfigService.get.mockReturnValue(8000);

      const result = service.get("PORT");

      expect(result).toBe(8000);
      expect(mockConfigService.get).toHaveBeenCalledWith("PORT", {
        infer: true,
      });
    });

    it("should return NODE_ENV value", () => {
      mockConfigService.get.mockReturnValue("development");

      const result = service.get("NODE_ENV");

      expect(result).toBe("development");
      expect(mockConfigService.get).toHaveBeenCalledWith("NODE_ENV", {
        infer: true,
      });
    });

    it("should return DATABASE_URL value", () => {
      mockConfigService.get.mockReturnValue("postgresql://localhost:5432/test");

      const result = service.get("DATABASE_URL");

      expect(result).toBe("postgresql://localhost:5432/test");
      expect(mockConfigService.get).toHaveBeenCalledWith("DATABASE_URL", {
        infer: true,
      });
    });
  });

  describe("isDevelopment", () => {
    it("should return true when NODE_ENV is development", () => {
      mockConfigService.get.mockReturnValue("development");

      expect(service.isDevelopment).toBe(true);
    });

    it("should return false when NODE_ENV is production", () => {
      mockConfigService.get.mockReturnValue("production");

      expect(service.isDevelopment).toBe(false);
    });

    it("should return false when NODE_ENV is test", () => {
      mockConfigService.get.mockReturnValue("test");

      expect(service.isDevelopment).toBe(false);
    });
  });
});
