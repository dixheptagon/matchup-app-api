import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../../sport-members/guards/roles.guard.js';
import { Roles } from '../../../sport-members/decorators/roles.decorator.js';
import { SessionGuard } from '../../shared/guards/session.guard.js';
import { SessionStatuses } from '../../shared/decorators/session-statuses.decorator.js';
import { SessionStatus } from '../../../../prisma/generated/prisma/enums.js';
import { CurrentSession } from '../../shared/decorators/current-session.decorator.js';
import type { SessionContext } from '../../shared/types/sport-sessions.types.js';
import { SessionMatchmakingService } from './services/session-matchmaking.service.js';
import { CreateMatchDto } from './dto/create-match.dto.js';

@Controller('sport-clubs/:clubSlug/sessions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('owner', 'admin')
export class SessionMatchesController {
  constructor(
    private readonly sessionMatchmakingService: SessionMatchmakingService,
  ) {}

  // Matchmaking

  @Post(':sessionId/matches/auto')
  @UseGuards(SessionGuard)
  @SessionStatuses(SessionStatus.ACTIVE)
  async autoMatch(@CurrentSession() session: SessionContext) {
    return this.sessionMatchmakingService.autoMatch(session);
  }

  @Post(':sessionId/matches')
  @UseGuards(SessionGuard)
  @SessionStatuses(SessionStatus.ACTIVE)
  async createManualMatch(
    @CurrentSession() session: SessionContext,
    @Body() dto: CreateMatchDto,
  ) {
    return this.sessionMatchmakingService.createManualMatch(session, dto);
  }
}