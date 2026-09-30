import { Body, Controller, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../../sport-members/guards/roles.guard.js';
import { Roles } from '../../../sport-members/decorators/roles.decorator.js';
import { SessionSettingsService } from './session-settings.service.js';
import { SessionGuard } from '../../shared/guards/session.guard.js';
import { SessionStatus } from '../../../../prisma/generated/prisma/enums.js';
import { SessionStatuses } from '../../shared/decorators/session-statuses.decorator.js';
import { CurrentSession } from '../../shared/decorators/current-session.decorator.js';
import type { SessionContext } from '../../shared/types/sport-sessions.types.js';
import { UpdateSessionSettingsDto } from './dto/update-session-settings.dto.js';

@Controller('sport-clubs/:clubSlug/sessions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('owner', 'admin')
export class SessionSettingsController {
  constructor(
    private readonly sessionSettingsService: SessionSettingsService,
  ) {}

  // Session Settings

  @Patch(':sessionId/settings')
  @UseGuards(SessionGuard)
  @SessionStatuses(SessionStatus.DRAFT, SessionStatus.ACTIVE)
  async updateSettings(
    @CurrentSession() session: SessionContext,
    @Body() dto: UpdateSessionSettingsDto,
  ) {
    return this.sessionSettingsService.updateSettings(session, dto);
  }
}
