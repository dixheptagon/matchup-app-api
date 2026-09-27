import { Module } from '@nestjs/common';
import { SportSessionsController } from './sport-sessions.controller.js';
import { SessionsPublicController } from './sessions.public.controller.js';
import { SportSessionsService } from './sport-sessions.service.js';
import { SessionGuard } from './guards/session.guard.js';
import { RolesGuard } from '../sport-members/guards/roles.guard.js';
import { JwtStrategy } from '../auth/strategies/jwt.strategy.js';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({}),
  ],
  controllers: [SportSessionsController, SessionsPublicController],
  providers: [SportSessionsService, JwtStrategy, RolesGuard, SessionGuard],
})
export class SportSessionsModule {}
