import { Module } from '@nestjs/common';
import { SportSessionsService } from './sport-sessions.service.js';
import { SessionSettingsService } from './sub-modules/settings/session-settings.service.js';
import { SessionCourtsService } from './sub-modules/courts/session-courts.service.js';
import { SportMembersModule } from '../sport-members/sport-members.module.js';
import { JwtStrategy } from '../auth/strategies/jwt.strategy.js';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { RolesGuard } from '../sport-members/guards/roles.guard.js';
import { SessionCheckinController } from './sub-modules/players/session-checkin.controller.js';
import { SessionCheckinService } from './sub-modules/players/services/session-checkin.service.js';
import { SportSessionsController } from './sport-sessions.controller.js';
import { SessionsPublicController } from './sessions.public.controller.js';
import { SessionPlayersService } from './sub-modules/players/services/session-player-draft.service.js';
import { PlayerPoolService } from './sub-modules/players/services/session-player-eligibility.service.js';
import { SessionGuard } from './shared/guards/session.guard.js';
import { SessionPlayerController } from './sub-modules/players/session-player.controller.js';
import { SessionCourtsController } from './sub-modules/courts/session-courts.controller.js';
import { SessionSettingsController } from './sub-modules/settings/session-settings.controller.js';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({}),
    SportMembersModule,
  ],
  controllers: [
    SportSessionsController,
    SessionsPublicController,
    SessionCheckinController,
    SessionPlayerController,
    SessionCourtsController,
    SessionSettingsController,
  ],
  providers: [
    SportSessionsService,
    SessionSettingsService,
    SessionCourtsService,
    SessionPlayersService,
    JwtStrategy,
    RolesGuard,
    SessionGuard,
    SessionCheckinService,
    PlayerPoolService,
  ],
})
export class SportSessionsModule {}
