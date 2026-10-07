import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../../sport-members/guards/roles.guard.js';
import { Roles } from '../../../sport-members/decorators/roles.decorator.js';
import { SessionPlayerEligibilityService } from './services/session-player-eligibility.service.js';
import { SessionGuard } from '../../shared/guards/session.guard.js';
import { SessionStatuses } from '../../shared/decorators/session-statuses.decorator.js';
import { SessionStatus } from '../../../../prisma/generated/prisma/enums.js';
import { CurrentSession } from '../../shared/decorators/current-session.decorator.js';
import type { SessionContext } from '../../shared/types/sport-sessions.types.js';

@Controller('sport-clubs/:clubSlug/sessions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('owner', 'admin')
export class SessionPlayerEligibilityController {
  constructor(
    private readonly sessionPlayerEligibilityService: SessionPlayerEligibilityService,
  ) {}

  // Player Eligibility

  @Get(':sessionId/players/eligible')
  @UseGuards(SessionGuard)
  @SessionStatuses(SessionStatus.ACTIVE)
  async getEligiblePlayers(@CurrentSession() session: SessionContext) {
    return this.sessionPlayerEligibilityService.getEligiblePlayers(session);
  }
}