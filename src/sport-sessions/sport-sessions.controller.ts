import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { SportSessionsService } from './sport-sessions.service.js';
import { CreateSessionDto } from './dto/create-session.dto.js';
import { UpdateSessionDetailsDto } from './dto/update-session-details.dto.js';
import { UpdateSessionSettingsDto } from './dto/update-session-settings.dto.js';
import { SetSessionCourtsDto } from './dto/set-session-courts.dto.js';
import { SetSessionPlayersDto } from './dto/set-session-players.dto.js';
import { CreateGuestPlayerDto } from './dto/create-guest-player.dto.js';
import { SessionQueryDto } from './dto/session-query.dto.js';
import { RolesGuard } from '../sport-members/guards/roles.guard.js';
import { Roles } from '../sport-members/decorators/roles.decorator.js';
import { CurrentClub } from '../sport-members/decorators/current-club.decorator.js';
import { SessionGuard } from './guards/session.guard.js';
import { SessionStatuses } from './decorators/session-statuses.decorator.js';
import { CurrentSession } from './decorators/current-session.decorator.js';
import { SessionStatus } from '../../prisma/generated/prisma/enums.js';
import type { SessionContext } from './sport-sessions.types.js';
import type { SportClub } from '../../prisma/generated/prisma/client.js';

@Controller('sport-clubs/:clubSlug/sessions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('owner', 'admin')
export class SportSessionsController {
  constructor(private readonly sportSessionsService: SportSessionsService) {}

  @Post()
  async create(
    @CurrentClub() club: SportClub,
    @Body() dto: CreateSessionDto,
  ) {
    return this.sportSessionsService.create(club, dto);
  }

  @Get()
  async findAll(
    @CurrentClub() club: SportClub,
    @Query() query: SessionQueryDto,
  ) {
    return this.sportSessionsService.findAllByClub(
      club,
      query.page ?? 1,
      query.limit ?? 20,
      query,
    );
  }

  @Get(':sessionId')
  @UseGuards(SessionGuard)
  async findOne(@CurrentSession() session: SessionContext) {
    return this.sportSessionsService.findOne(session);
  }

  @Patch(':sessionId')
  @UseGuards(SessionGuard)
  @SessionStatuses(SessionStatus.DRAFT)
  async updateDetails(
    @CurrentSession() session: SessionContext,
    @Body() dto: UpdateSessionDetailsDto,
  ) {
    return this.sportSessionsService.updateDetails(session, dto);
  }

  @Delete(':sessionId')
  @UseGuards(SessionGuard)
  @SessionStatuses(SessionStatus.DRAFT)
  async remove(@CurrentSession() session: SessionContext) {
    return this.sportSessionsService.remove(session);
  }

  @Patch(':sessionId/settings')
  @UseGuards(SessionGuard)
  @SessionStatuses(SessionStatus.DRAFT, SessionStatus.ACTIVE)
  async updateSettings(
    @CurrentSession() session: SessionContext,
    @Body() dto: UpdateSessionSettingsDto,
  ) {
    return this.sportSessionsService.updateSettings(session, dto);
  }

  @Put(':sessionId/courts')
  @UseGuards(SessionGuard)
  @SessionStatuses(SessionStatus.DRAFT)
  async setCourts(
    @CurrentSession() session: SessionContext,
    @Body() dto: SetSessionCourtsDto,
  ) {
    return this.sportSessionsService.setCourts(session, dto);
  }

  @Post(':sessionId/courts')
  @UseGuards(SessionGuard)
  @SessionStatuses(SessionStatus.DRAFT, SessionStatus.ACTIVE)
  async addCourts(
    @CurrentSession() session: SessionContext,
    @Body() dto: SetSessionCourtsDto,
  ) {
    return this.sportSessionsService.addCourts(session, dto);
  }

  @Delete(':sessionId/courts/:sessionCourtId')
  @UseGuards(SessionGuard)
  @SessionStatuses(SessionStatus.DRAFT)
  async removeCourt(
    @CurrentSession() session: SessionContext,
    @Param('sessionCourtId', ParseIntPipe) sessionCourtId: number,
  ) {
    return this.sportSessionsService.removeCourt(session, sessionCourtId);
  }

  @Put(':sessionId/players')
  @UseGuards(SessionGuard)
  @SessionStatuses(SessionStatus.DRAFT)
  async setPlayers(
    @CurrentSession() session: SessionContext,
    @Body() dto: SetSessionPlayersDto,
  ) {
    return this.sportSessionsService.setPlayers(session, dto);
  }

  @Post(':sessionId/players')
  @UseGuards(SessionGuard)
  @SessionStatuses(SessionStatus.DRAFT, SessionStatus.ACTIVE)
  async addPlayers(
    @CurrentSession() session: SessionContext,
    @Body() dto: SetSessionPlayersDto,
  ) {
    return this.sportSessionsService.addPlayers(session, dto);
  }

  @Post(':sessionId/players/guest')
  @UseGuards(SessionGuard)
  @SessionStatuses(SessionStatus.DRAFT, SessionStatus.ACTIVE)
  async addGuest(
    @CurrentSession() session: SessionContext,
    @Body() dto: CreateGuestPlayerDto,
  ) {
    return this.sportSessionsService.addGuest(session, dto);
  }

  @Delete(':sessionId/players/:sessionPlayerId')
  @UseGuards(SessionGuard)
  @SessionStatuses(SessionStatus.DRAFT)
  async removePlayer(
    @CurrentSession() session: SessionContext,
    @Param('sessionPlayerId', ParseIntPipe) sessionPlayerId: number,
  ) {
    return this.sportSessionsService.removePlayer(session, sessionPlayerId);
  }

  @Post(':sessionId/start')
  @UseGuards(SessionGuard)
  @SessionStatuses(SessionStatus.DRAFT)
  async start(@CurrentSession() session: SessionContext) {
    return this.sportSessionsService.start(session);
  }
}
