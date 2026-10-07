import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../config/prisma/prisma.service.js';
import {
  MatchStatus,
  PlayerStatus,
} from '../../../../../prisma/generated/prisma/enums.js';
import type { SessionContext } from '../../../shared/types/sport-sessions.types.js';
import { PlayerWeightingService } from './player-weighting.service.js';

@Injectable()
export class SessionPlayerEligibilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly playerWeighting: PlayerWeightingService,
  ) {}

  async getEligiblePlayers(session: SessionContext) {
    const whereCondition = {
      sessionId: session.id,
      status: PlayerStatus.WAITING,
      matchPlayers: {
        none: {
          match: {
            status: {
              in: [MatchStatus.QUEUED, MatchStatus.READY, MatchStatus.PLAYING],
            },
          },
        },
      },
    };

    const [players, totalCount] = await this.prisma.$transaction([
      this.prisma.sessionPlayer.findMany({
        where: whereCondition,
        include: {
          clubMember: true,
          _count: {
            select: {
              matchPlayers: true,
            },
          },
        },
        orderBy: [{ checkedInAt: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.sessionPlayer.count({
        where: whereCondition,
      }),
    ]);

    return {
      data: this.playerWeighting.weight(players, session),
      meta: {
        total: totalCount,
        sessionId: session.id,
      },
    };
  }
}
