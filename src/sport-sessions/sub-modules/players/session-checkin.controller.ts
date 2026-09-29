import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  UseGuards,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { SessionCheckinService } from './session-checkin.service.js';
import { SessionStatuses } from '../../shared/decorators/session-statuses.decorator.js';
import { SessionStatus } from '../../../../prisma/generated/prisma/enums.js';
import { CurrentSession } from '../../shared/decorators/current-session.decorator.js';
import { RolesGuard } from '../../../sport-members/guards/roles.guard.js';
import { Roles } from '../../../sport-members/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard.js';
import {
  CheckInMultiplePlayersDto,
  GetCheckInStatusDto,
} from './dto/session-checkin.dto.js';
import { SessionGuard } from '../../shared/guards/session.guard.js';
import type { SessionContext } from '../../shared/types/sport-sessions.types.js';

@Controller('sport-clubs/:clubSlug/sessions/:sessionId/checkin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('owner', 'admin')
export class SessionCheckinController {
  constructor(private readonly sessionCheckinService: SessionCheckinService) {}

  @Get()
  @UseGuards(SessionGuard)
  @SessionStatuses(SessionStatus.ACTIVE)
  async getCheckInStatus(
    @CurrentSession() session: SessionContext,
    @Query() query: GetCheckInStatusDto,
  ) {
    return this.sessionCheckinService.getCheckInStatus(session, query.status);
  }

  @Post()
  @UseGuards(SessionGuard)
  @SessionStatuses(SessionStatus.ACTIVE)
  async checkInMultiplePlayers(
    @CurrentSession() session: SessionContext,
    @Body() dto: CheckInMultiplePlayersDto,
  ) {
    return this.sessionCheckinService.checkInMultiplePlayers(session, dto);
  }

  @Patch(':sessionPlayerId')
  @UseGuards(SessionGuard)
  @SessionStatuses(SessionStatus.ACTIVE)
  async checkInSinglePlayer(
    @CurrentSession() session: SessionContext,
    @Param('sessionPlayerId', ParseIntPipe) sessionPlayerId: number,
  ) {
    return this.sessionCheckinService.checkInSinglePlayer(
      session,
      sessionPlayerId,
    );
  }

  @Post(':sessionPlayerId/checkout')
  @UseGuards(SessionGuard)
  @SessionStatuses(SessionStatus.ACTIVE)
  async checkOutPlayer(
    @CurrentSession() session: SessionContext,
    @Param('sessionPlayerId', ParseIntPipe) sessionPlayerId: number,
  ) {
    return this.sessionCheckinService.checkOutPlayer(session, sessionPlayerId);
  }
}
