import { Global, Module } from "@nestjs/common";
import { EnvConfigService } from "./env.service.js";

@Global()
@Module({
  providers: [EnvConfigService],
  exports: [EnvConfigService],
})
export class EnvConfigModule {}