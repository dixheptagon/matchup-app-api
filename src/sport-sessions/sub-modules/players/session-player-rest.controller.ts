import {
  Body,
  Controller,
  Delete,
  Param,
  ParseIntPipe,
  Post,
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
import { SessionPlayerRestService } from './services/session-player-rest.service.js';
import { RestPlayerDto } from './dto/rest-player.dto.js';

@Controller('sport-clubs/:clubSlug/sessions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('owner', 'admin')
export class SessionPlayerRestController {
  constructor(
    private readonly sessionPlayerRestService: SessionPlayerRestService,
  ) {}

  @Post(':sessionId/players/:sessionPlayerId/rest')
  @UseGuards(SessionGuard)
  @SessionStatuses(SessionStatus.ACTIVE)
  async restPlayer(
    @CurrentSession() session: SessionContext,
    @Param('sessionPlayerId', ParseIntPipe) sessionPlayerId: number,
    @Body() dto: RestPlayerDto,
  ) {
    return this.sessionPlayerRestService.restPlayer(
      session,
      sessionPlayerId,
      dto,
    );
  }

  @Delete(':sessionId/players/:sessionPlayerId/rest')
  @UseGuards(SessionGuard)
  @SessionStatuses(SessionStatus.ACTIVE)
  async resumePlayer(
    @CurrentSession() session: SessionContext,
    @Param('sessionPlayerId', ParseIntPipe) sessionPlayerId: number,
  ) {
    return this.sessionPlayerRestService.resumePlayer(session, sessionPlayerId);
  }
}
