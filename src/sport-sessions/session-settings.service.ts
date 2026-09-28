import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../config/prisma/prisma.service.js';
import { UpdateSessionSettingsDto } from './dto/update-session-settings.dto.js';
import { getLockedActiveSettings } from './sport-sessions.helper.js';
import { SessionStatus } from '../../prisma/generated/prisma/enums.js';
import type { SessionContext } from './sport-sessions.types.js';

@Injectable()
export class SessionSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async updateSettings(
    session: SessionContext,
    dto: UpdateSessionSettingsDto,
  ) {
    if (session.status === SessionStatus.ACTIVE) {
      const invalid = getLockedActiveSettings(dto);

      if (invalid.length > 0) {
        throw new BadRequestException(
          `Cannot change ${invalid.join(', ')} while the session is active`,
        );
      }
    }

    return this.prisma.sessionSettings.update({
      where: { sessionId: session.id },
      data: dto,
    });
  }
}
