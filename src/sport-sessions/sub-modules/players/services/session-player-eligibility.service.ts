import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../config/prisma/prisma.service.js';
import {
  applyEffectivePlayerStatus,
  buildEligiblePlayersWhere,
} from '../../../shared/helpers/sport-sessions.helper.js';
import type { SessionContext } from '../../../shared/types/sport-sessions.types.js';
import { PlayerWeightingService } from './player-weighting.service.js';

@Injectable()
export class SessionPlayerEligibilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly playerWeighting: PlayerWeightingService,
  ) {}

  async getEligiblePlayers(session: SessionContext, now: Date = new Date()) {
    const whereCondition = buildEligiblePlayersWhere(session.id, now);

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
      // Elapsed rests are presented as the waiting state they will get on the
      // next write, without this GET mutating anything.
      data: this.playerWeighting.weight(
        players.map((player) => applyEffectivePlayerStatus(player, now)),
        session,
      ),
      meta: {
        total: totalCount,
        sessionId: session.id,
      },
    };
  }
}
