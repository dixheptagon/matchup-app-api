import {
  Body,
  Controller,
  Delete,
  Param,
  ParseIntPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../../sport-members/guards/roles.guard.js';
import { Roles } from '../../../sport-members/decorators/roles.decorator.js';
import { SessionPlayersService } from './services/session-player-draft.service.js';
import { SessionGuard } from '../../shared/guards/session.guard.js';
import { SessionStatuses } from '../../shared/decorators/session-statuses.decorator.js';
import { SessionStatus } from '../../../../prisma/generated/prisma/enums.js';
import { CurrentSession } from '../../shared/decorators/current-session.decorator.js';
import type { SessionContext } from '../../shared/types/sport-sessions.types.js';
import { SetSessionPlayersDto } from './dto/set-session-players.dto.js';
import { CreateGuestPlayerDto } from './dto/create-guest-player.dto.js';

@Controller('sport-clubs/:clubSlug/sessions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('owner', 'admin')
export class SessionPlayerController {
  constructor(private readonly sessionPlayersService: SessionPlayersService) {}

  // Session Players

  @Put(':sessionId/players')
  @UseGuards(SessionGuard)
  @SessionStatuses(SessionStatus.DRAFT)
  async setPlayers(
    @CurrentSession() session: SessionContext,
    @Body() dto: SetSessionPlayersDto,
  ) {
    return this.sessionPlayersService.setPlayers(session, dto);
  }

  @Post(':sessionId/players')
  @UseGuards(SessionGuard)
  @SessionStatuses(SessionStatus.DRAFT, SessionStatus.ACTIVE)
  async addPlayers(
    @CurrentSession() session: SessionContext,
    @Body() dto: SetSessionPlayersDto,
  ) {
    return this.sessionPlayersService.addPlayers(session, dto);
  }

  @Post(':sessionId/players/guest')
  @UseGuards(SessionGuard)
  @SessionStatuses(SessionStatus.DRAFT, SessionStatus.ACTIVE)
  async addGuest(
    @CurrentSession() session: SessionContext,
    @Body() dto: CreateGuestPlayerDto,
  ) {
    return this.sessionPlayersService.addGuest(session, dto);
  }

  @Delete(':sessionId/players/:sessionPlayerId')
  @UseGuards(SessionGuard)
  @SessionStatuses(SessionStatus.DRAFT)
  async removePlayer(
    @CurrentSession() session: SessionContext,
    @Param('sessionPlayerId', ParseIntPipe) sessionPlayerId: number,
  ) {
    return this.sessionPlayersService.removePlayer(session, sessionPlayerId);
  }
}
