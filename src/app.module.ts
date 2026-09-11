import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env/env.config.js';
import { EnvConfigModule } from './config/env/env.module.js';
import { PrismaModule } from './config/prisma/prisma.module.js';

@Module({
  imports: [ConfigModule.forRoot(
    {
      envFilePath: '.env',
      isGlobal: true,
      validate: validateEnv
    },
  ), EnvConfigModule, PrismaModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
