import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { SessionCheckinService } from './session-checkin.service.js';
import { SessionStatuses } from '../../../draft/decorators/session-statuses.decorator.js';
import { SessionStatus } from '../../../../../prisma/generated/prisma/enums.js';
import { CurrentSession } from '../../../draft/decorators/current-session.decorator.js';
import type { SessionContext } from '../../../draft/sport-sessions.types.js';
import { RolesGuard } from '../../../../sport-members/guards/roles.guard.js';
import { SessionGuard } from '../../../draft/guards/session.guard.js';
import { Roles } from '../../../../sport-members/decorators/roles.decorator.js';
import {
  AdminCheckInDto,
  AdminUpdateStatusDto,
} from './dto/session-checkin.dto.js';

@Controller('session-checkin')
export class SessionCheckinController {
  constructor(private readonly sessionCheckinService: SessionCheckinService) {}

  @Get(':sessionId/checkin')
  @UseGuards(SessionGuard)
  @SessionStatuses(SessionStatus.ACTIVE)
  async getCheckInStatus(@CurrentSession() session: SessionContext) {
    return this.sessionCheckinService.getCheckInStatus(session);
  }

  @Post(':sessionId/checkin')
  @UseGuards(SessionGuard, RolesGuard)
  @SessionStatuses(SessionStatus.ACTIVE)
  @Roles('owner', 'admin')
  async checkInPlayers(
    @CurrentSession() session: SessionContext,
    @Body() dto: AdminCheckInDto,
  ) {
    return this.sessionCheckinService.checkInPlayers(
      session,
      dto.sessionPlayerIds,
    );
  }

  @Patch(':sessionId/checkin/:sessionPlayerId')
  @UseGuards(SessionGuard, RolesGuard)
  @SessionStatuses(SessionStatus.ACTIVE)
  @Roles('owner', 'admin')
  async updatePlayerStatus(
    @CurrentSession() session: SessionContext,
    @Param('sessionPlayerId', ParseIntPipe) playerId: number,
    @Body() dto: AdminUpdateStatusDto,
  ) {
    return this.sessionCheckinService.updatePlayerStatus(
      session,
      playerId,
      dto.status,
    );
  }

  @Post(':sessionId/checkout/:sessionPlayerId')
  @UseGuards(SessionGuard, RolesGuard)
  @SessionStatuses(SessionStatus.ACTIVE)
  @Roles('owner', 'admin')
  async checkOutPlayer(
    @CurrentSession() session: SessionContext,
    @Param('sessionPlayerId', ParseIntPipe) playerId: number,
  ) {
    return this.sessionCheckinService.checkOutPlayer(session, playerId);
  }
}
