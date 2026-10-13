import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../../sport-members/guards/roles.guard.js';
import { Roles } from '../../../sport-members/decorators/roles.decorator.js';
import { SessionGuard } from '../../shared/guards/session.guard.js';
import { SessionStatuses } from '../../shared/decorators/session-statuses.decorator.js';
import { SessionStatus } from '../../../../prisma/generated/prisma/enums.js';
import { CurrentSession } from '../../shared/decorators/current-session.decorator.js';
import type { SessionContext } from '../../shared/types/sport-sessions.types.js';
import { SessionMatchmakingService } from './services/session-matchmaking.service.js';
import { SessionMatchesService } from './services/session-matches.service.js';
import { CreateMatchDto } from './dto/create-match.dto.js';
import { MatchQueueQueryDto } from './dto/match-queue-query.dto.js';
import { CancelMatchDto } from './dto/cancel-match.dto.js';
import { AssignCourtDto } from './dto/assign-court.dto.js';

@Controller('sport-clubs/:clubSlug/sessions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('owner', 'admin')
export class SessionMatchesController {
  constructor(
    private readonly sessionMatchmakingService: SessionMatchmakingService,
    private readonly sessionMatchesService: SessionMatchesService,
  ) {}

  // Match Queue

  @Get(':sessionId/matches/queue')
  @UseGuards(SessionGuard)
  @SessionStatuses(SessionStatus.ACTIVE)
  async getMatchQueue(
    @CurrentSession() session: SessionContext,
    @Query() query: MatchQueueQueryDto,
  ) {
    return this.sessionMatchesService.getMatchQueue(session, query);
  }

  @Delete(':sessionId/matches/:matchId/cancel')
  @UseGuards(SessionGuard)
  @SessionStatuses(SessionStatus.ACTIVE)
  async cancelMatch(
    @CurrentSession() session: SessionContext,
    @Param('matchId') matchId: string,
    @Body() dto: CancelMatchDto,
  ) {
    return this.sessionMatchesService.cancelMatch(session, matchId, dto);
  }

  // Court Assignment

  @Post(':sessionId/matches/:matchId/court')
  @UseGuards(SessionGuard)
  @SessionStatuses(SessionStatus.ACTIVE)
  async assignCourt(
    @CurrentSession() session: SessionContext,
    @Param('matchId') matchId: string,
    @Body() dto: AssignCourtDto,
  ) {
    return this.sessionMatchesService.assignCourt(session, matchId, dto);
  }

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
