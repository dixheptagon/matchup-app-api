import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env/env.config.js';
import { EnvConfigModule } from './config/env/env.module.js';
import { PrismaModule } from './config/prisma/prisma.module.js';
import { UsersModule } from './users/users.module.js';
import { AuthModule } from './auth/auth.module.js';
import { SportClubsModule } from './sport-clubs/sport-clubs.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: '.env',
      isGlobal: true,
      validate: validateEnv,
      expandVariables: true,
    }),
    EnvConfigModule,
    PrismaModule,
    UsersModule,
    AuthModule,
    SportClubsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
