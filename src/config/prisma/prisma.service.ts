import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { PrismaClient } from "../../../prisma/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { EnvConfigService } from "../env/env.service.js";

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(private readonly envConfig: EnvConfigService) {
    const adapter = new PrismaPg({
      connectionString: envConfig.get("DATABASE_URL"),
    });

    super({
      adapter,
      log: envConfig.isDevelopment
        ? ["query", "info", "warn", "error"]
        : ["error"],
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
