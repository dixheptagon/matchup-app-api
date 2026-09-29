import { Module } from '@nestjs/common';
import { SportSessionsController } from './sport-sessions.controller.js';
import { SessionsPublicController } from './sessions.public.controller.js';
import { SportSessionsService } from './sport-sessions.service.js';
import { SessionSettingsService } from './session-settings.service.js';
import { SessionCourtsService } from './session-courts.service.js';
import { SessionPlayersService } from './session-players.service.js';
import { SessionGuard } from './guards/session.guard.js';
import { SportMembersModule } from '../../sport-members/sport-members.module.js';
import { JwtStrategy } from '../../auth/strategies/jwt.strategy.js';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { RolesGuard } from '../../sport-members/guards/roles.guard.js';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({}),
    SportMembersModule,
  ],
  controllers: [SportSessionsController, SessionsPublicController],
  providers: [
    SportSessionsService,
    SessionSettingsService,
    SessionCourtsService,
    SessionPlayersService,
    JwtStrategy,
    RolesGuard,
    SessionGuard,
  ],
})
export class SportSessionsModule {}
