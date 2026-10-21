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
import { SessionPlayerRestService } from './sub-modules/players/services/session-player-rest.service.js';
import { SessionGuard } from './shared/guards/session.guard.js';
import { SessionPlayerController } from './sub-modules/players/session-player-draft.controller.js';
import { SessionPlayerRestController } from './sub-modules/players/session-player-rest.controller.js';
import { SessionCourtsController } from './sub-modules/courts/session-courts.controller.js';
import { SessionSettingsController } from './sub-modules/settings/session-settings.controller.js';
import { SessionPlayerEligibilityService } from './sub-modules/players/services/session-player-eligibility.service.js';
import { PlayerWeightingService } from './sub-modules/players/services/player-weighting.service.js';
import { SessionPlayerEligibilityController } from './sub-modules/players/session-player-eligibility.controller.js';
import { SessionMatchesController } from './sub-modules/matches/session-matches.controller.js';
import { SessionMatchmakingService } from './sub-modules/matches/services/session-matchmaking.service.js';
import { SessionMatchesService } from './sub-modules/matches/services/session-matches.service.js';
import { SessionMatchResultService } from './sub-modules/matches/services/session-match-result.service.js';
import { MatchCompositionService } from './sub-modules/matches/services/match-composition.service.js';
import { SessionStatsController } from './sub-modules/stats/session-stats.controller.js';
import { SessionStatsService } from './sub-modules/stats/services/session-stats.service.js';

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
    SessionPlayerRestController,
    SessionCourtsController,
    SessionSettingsController,
    SessionPlayerEligibilityController,
    SessionMatchesController,
    SessionStatsController,
  ],
  providers: [
    SportSessionsService,
    SessionSettingsService,
    SessionCourtsService,
    SessionPlayersService,
    SessionPlayerRestService,
    JwtStrategy,
    RolesGuard,
    SessionGuard,
    SessionCheckinService,
    SessionPlayerEligibilityService,
    PlayerWeightingService,
    SessionMatchmakingService,
    SessionMatchesService,
    SessionMatchResultService,
    MatchCompositionService,
    SessionStatsService,
  ],
})
export class SportSessionsModule {}
