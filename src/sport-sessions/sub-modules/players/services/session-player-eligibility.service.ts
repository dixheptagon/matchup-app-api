import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../config/prisma/prisma.service.js';
import { buildEligiblePlayersWhere } from '../../../shared/helpers/sport-sessions.helper.js';
import type { SessionContext } from '../../../shared/types/sport-sessions.types.js';
import { PlayerWeightingService } from './player-weighting.service.js';

@Injectable()
export class SessionPlayerEligibilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly playerWeighting: PlayerWeightingService,
  ) {}

  async getEligiblePlayers(session: SessionContext) {
    const whereCondition = buildEligiblePlayersWhere(session.id);

    const [players, totalCount] = await this.prisma.$transaction([
      this.prisma.sessionPlayer.findMany({
        where: whereCondition,
        include: {
          clubMember: true,
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
