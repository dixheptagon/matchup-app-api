import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../config/prisma/prisma.service.js';
import { SetSessionCourtsDto } from './dto/set-session-courts.dto.js';
import type { SessionContext } from './sport-sessions.types.js';

@Injectable()
export class SessionCourtsService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertCourtsBelong(clubId: string, courtIds: number[]) {
    const unique = [...new Set(courtIds)];

    const courts = await this.prisma.court.findMany({
      where: { id: { in: unique }, clubId, isActive: true },
      select: { id: true },
    });

    if (courts.length !== unique.length) {
      throw new BadRequestException(
        'One or more courts are invalid or inactive',
      );
    }

    return unique;
  }

  // TODO: Check overlapping court schedules
  async setCourts(session: SessionContext, dto: SetSessionCourtsDto) {
    const courtIds = await this.assertCourtsBelong(
      session.clubId,
      dto.courtIds,
    );

    return this.prisma.$transaction(async (tx) => {
      await tx.sessionCourt.deleteMany({
        where: { sessionId: session.id, courtId: { notIn: courtIds } },
      });

      await tx.sessionCourt.createMany({
        data: courtIds.map((courtId) => ({ sessionId: session.id, courtId })),
        skipDuplicates: true,
      });

      return tx.sessionCourt.findMany({
        where: { sessionId: session.id },
        include: { court: true },
      });
    });
  }

  // TODO : Remove addCourts and removeCourt service and use setCourts instead
  // Add master courts -> auto add to session courts
  // Remove master courts -> auto remove from session courts
  async addCourts(session: SessionContext, dto: SetSessionCourtsDto) {
    const courtIds = await this.assertCourtsBelong(
      session.clubId,
      dto.courtIds,
    );

    await this.prisma.sessionCourt.createMany({
      data: courtIds.map((courtId) => ({ sessionId: session.id, courtId })),
      skipDuplicates: true,
    });

    return this.prisma.sessionCourt.findMany({
      where: { sessionId: session.id },
      include: { court: true },
    });
  }

  async removeCourt(session: SessionContext, sessionCourtId: number) {
    const sessionCourt = await this.prisma.sessionCourt.findFirst({
      where: { id: sessionCourtId, sessionId: session.id },
    });

    if (!sessionCourt) {
      throw new NotFoundException('Session court not found');
    }

    const matches = await this.prisma.sessionMatch.count({
      where: { sessionCourtId: sessionCourt.id },
    });

    if (matches > 0) {
      throw new BadRequestException(
        'Cannot remove a court that already has matches',
      );
    }

    await this.prisma.sessionCourt.delete({
      where: { id: sessionCourt.id },
    });

    return { message: `Court removed from session` };
  }
}
