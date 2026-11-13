import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../config/prisma/prisma.service.js';
import { UpdateSessionSettingsDto } from './dto/update-session-settings.dto.js';
import { getLockedActiveSettings } from '../../shared/helpers/sport-sessions.helper.js';
import { expandMatchmakingPreset } from '../../../club-settings/matchmaking-presets.constant.js';
import { SessionStatus } from '../../../../prisma/generated/prisma/enums.js';
import { SessionContext } from '../../shared/types/sport-sessions.types.js';

@Injectable()
export class SessionSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async updateSettings(session: SessionContext, dto: UpdateSessionSettingsDto) {
    // A preset expands into priority fields, several of which are locked while
    // a session is active, so the lock check has to run on the expanded payload.
    const data = expandMatchmakingPreset(dto);

    if (session.status === SessionStatus.ACTIVE) {
      const invalid = getLockedActiveSettings(data);

      if (invalid.length > 0) {
        throw new BadRequestException(
          `Cannot change ${invalid.join(', ')} while the session is active`,
        );
      }
    }

    return this.prisma.sessionSettings.update({
      where: { sessionId: session.id },
      data,
    });
  }
}
