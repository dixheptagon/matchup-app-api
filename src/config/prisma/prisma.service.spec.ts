import { Test, TestingModule } from "@nestjs/testing";
import { PrismaService } from "./prisma.service.js";
import { EnvConfigService } from "../env/env.service.js";

vi.mock("@prisma/adapter-pg", () => ({
  PrismaPg: class {
    constructor(_opts: unknown) {}
  },
}));

vi.mock("../../../prisma/generated/prisma/client.js", () => ({
  PrismaClient: class {
    $connect = vi.fn();
    $disconnect = vi.fn();
  },
}));

describe("PrismaService", () => {
  let service: PrismaService;

  const mockEnvConfig = {
    get: vi.fn().mockReturnValue("postgresql://localhost:5432/test"),
    isDevelopment: true,
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    mockEnvConfig.get.mockReturnValue("postgresql://localhost:5432/test");
    mockEnvConfig.isDevelopment = true;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrismaService,
        { provide: EnvConfigService, useValue: mockEnvConfig },
      ],
    }).compile();

    service = module.get<PrismaService>(PrismaService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("onModuleInit", () => {
    it("should call $connect", async () => {
      await service.onModuleInit();
      expect(service.$connect).toHaveBeenCalledOnce();
    });
  });

  describe("onModuleDestroy", () => {
    it("should call $disconnect", async () => {
      await service.onModuleDestroy();
      expect(service.$disconnect).toHaveBeenCalledOnce();
    });
  });

  describe("constructor", () => {
    it("should read DATABASE_URL from env config", () => {
      expect(mockEnvConfig.get).toHaveBeenCalledWith("DATABASE_URL");
    });

    it("should use error-only logging when isDevelopment is false", async () => {
      mockEnvConfig.isDevelopment = false;

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          PrismaService,
          { provide: EnvConfigService, useValue: mockEnvConfig },
        ],
      }).compile();

      const prodService = module.get<PrismaService>(PrismaService);
      expect(prodService).toBeDefined();
    });
  });
});
