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
import { SessionCourtsService } from './session-courts.service.js';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../../sport-members/guards/roles.guard.js';
import { Roles } from '../../../sport-members/decorators/roles.decorator.js';
import { SessionGuard } from '../../shared/guards/session.guard.js';
import { SessionStatuses } from '../../shared/decorators/session-statuses.decorator.js';
import { SessionStatus } from '../../../../prisma/generated/prisma/enums.js';
import { CurrentSession } from '../../shared/decorators/current-session.decorator.js';
import type { SessionContext } from '../../shared/types/sport-sessions.types.js';
import { SetSessionCourtsDto } from './dto/set-session-courts.dto.js';

@Controller('sport-clubs/:clubSlug/sessions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('owner', 'admin')
export class SessionCourtsController {
  constructor(private readonly sessionCourtsService: SessionCourtsService) {}

  // Session Courts

  @Put(':sessionId/courts')
  @UseGuards(SessionGuard)
  @SessionStatuses(SessionStatus.DRAFT)
  async setCourts(
    @CurrentSession() session: SessionContext,
    @Body() dto: SetSessionCourtsDto,
  ) {
    return this.sessionCourtsService.setCourts(session, dto);
  }

  @Post(':sessionId/courts')
  @UseGuards(SessionGuard)
  @SessionStatuses(SessionStatus.DRAFT, SessionStatus.ACTIVE)
  async addCourts(
    @CurrentSession() session: SessionContext,
    @Body() dto: SetSessionCourtsDto,
  ) {
    return this.sessionCourtsService.addCourts(session, dto);
  }

  @Delete(':sessionId/courts/:sessionCourtId')
  @UseGuards(SessionGuard)
  @SessionStatuses(SessionStatus.DRAFT)
  async removeCourt(
    @CurrentSession() session: SessionContext,
    @Param('sessionCourtId', ParseIntPipe) sessionCourtId: number,
  ) {
    return this.sessionCourtsService.removeCourt(session, sessionCourtId);
  }
}
