import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../../config/prisma/prisma.service.js';
import { SESSION_STATUSES_KEY } from '../../shared/decorators/session-statuses.decorator.js';
import type { SessionStatus } from '../../../../prisma/generated/prisma/enums.js';
import type { SportClub } from '../../../../prisma/generated/prisma/client.js';
import { SESSION_GUARD_INCLUDE } from '../constants/sport-sessions.constant.js';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface SessionScopedRequest {
  club?: SportClub;
  session?: unknown;
  params: { sessionId?: string };
}

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<SessionScopedRequest>();
    const club = request.club;
    const sessionId = request.params.sessionId;

    if (!club || !sessionId || !UUID_PATTERN.test(sessionId)) {
      throw new NotFoundException('Session not found');
    }

    const session = await this.prisma.sportSession.findFirst({
      where: { id: sessionId, clubId: club.id },
      include: SESSION_GUARD_INCLUDE,
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    request.session = session;

    const allowed = this.reflector.getAllAndOverride<SessionStatus[]>(
      SESSION_STATUSES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (allowed?.length && !allowed.includes(session.status)) {
      throw new BadRequestException(
        `Session must be in ${allowed.join(' or ')} status`,
      );
    }

    return true;
  }
}
