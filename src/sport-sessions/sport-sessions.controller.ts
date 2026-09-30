import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../sport-members/guards/roles.guard.js';
import { Roles } from '../sport-members/decorators/roles.decorator.js';
import { CurrentClub } from '../sport-members/decorators/current-club.decorator.js';
import {
  SessionStatus,
  type SportClub,
} from '../../prisma/generated/prisma/client.js';
import { SportSessionsService } from './sport-sessions.service.js';
import { CreateSessionDto } from './dto/create-session.dto.js';
import { SessionQueryDto } from './dto/session-query.dto.js';
import type { SessionContext } from './shared/types/sport-sessions.types.js';
import { CurrentSession } from './shared/decorators/current-session.decorator.js';
import { SessionGuard } from './shared/guards/session.guard.js';
import { SessionStatuses } from './shared/decorators/session-statuses.decorator.js';
import { UpdateSessionDetailsDto } from './dto/update-session-details.dto.js';

@Controller('sport-clubs/:clubSlug/sessions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('owner', 'admin')
export class SportSessionsController {
  constructor(private readonly sportSessionsService: SportSessionsService) {}

  // Session Info

  @Post()
  async create(@CurrentClub() club: SportClub, @Body() dto: CreateSessionDto) {
    return this.sportSessionsService.create(club, dto);
  }

  @Get()
  async findAll(
    @CurrentClub() club: SportClub,
    @Query() query: SessionQueryDto,
  ) {
    return this.sportSessionsService.findAllByClub(club, query);
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

  // Start Session

  @Post(':sessionId/start')
  @UseGuards(SessionGuard)
  @SessionStatuses(SessionStatus.DRAFT)
  async start(@CurrentSession() session: SessionContext) {
    return this.sportSessionsService.start(session);
  }
}
