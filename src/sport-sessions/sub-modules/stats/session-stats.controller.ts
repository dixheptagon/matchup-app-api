import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../../sport-members/guards/roles.guard.js';
import { Roles } from '../../../sport-members/decorators/roles.decorator.js';
import { SessionGuard } from '../../shared/guards/session.guard.js';
import { SessionStatuses } from '../../shared/decorators/session-statuses.decorator.js';
import { SessionStatus } from '../../../../prisma/generated/prisma/enums.js';
import { CurrentSession } from '../../shared/decorators/current-session.decorator.js';
import type { SessionContext } from '../../shared/types/sport-sessions.types.js';
import { SessionStatsService } from './services/session-stats.service.js';
import { PlayerListQueryDto } from './dto/player-list-query.dto.js';

@Controller('sport-clubs/:clubSlug/sessions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('owner', 'admin')
export class SessionStatsController {
  constructor(private readonly sessionStatsService: SessionStatsService) {}

  // Player List & Status

  @Get(':sessionId/players')
  @UseGuards(SessionGuard)
  @SessionStatuses(SessionStatus.DRAFT, SessionStatus.ACTIVE)
  async getRoster(
    @CurrentSession() session: SessionContext,
    @Query() query: PlayerListQueryDto,
  ) {
    return this.sessionStatsService.getRoster(session, query);
  }

  // Leaderboard

  @Get(':sessionId/leaderboard')
  @UseGuards(SessionGuard)
  @SessionStatuses(SessionStatus.ACTIVE, SessionStatus.FINISHED)
  async getLeaderboard(@CurrentSession() session: SessionContext) {
    return this.sessionStatsService.getLeaderboard(session);
  }
}
