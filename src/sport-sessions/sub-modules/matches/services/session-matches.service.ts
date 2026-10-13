import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../config/prisma/prisma.service.js';
import {
  MATCH_DETAIL_INCLUDE,
  QUEUE_MATCH_STATUSES,
} from '../../../shared/constants/sport-sessions.constant.js';
import type { SessionContext } from '../../../shared/types/sport-sessions.types.js';
import { MatchQueueQueryDto } from '../dto/match-queue-query.dto.js';

@Injectable()
export class SessionMatchesService {
  constructor(private readonly prisma: PrismaService) {}

  async getMatchQueue(session: SessionContext, query: MatchQueueQueryDto = {}) {
    const where = {
      sessionId: session.id,
      status: { in: query.status ? [query.status] : QUEUE_MATCH_STATUSES },
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.sessionMatch.findMany({
        where,
        include: MATCH_DETAIL_INCLUDE,
        orderBy: { sequence: 'asc' },
      }),
      this.prisma.sessionMatch.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        sessionId: session.id,
      },
    };
  }
}