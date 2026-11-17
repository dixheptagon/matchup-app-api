import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../config/prisma/prisma.service.js';
import { PlayerStatus } from '../../../../../prisma/generated/prisma/enums.js';
import { BENCH_PLAYER_STATUSES } from '../../../shared/constants/sport-sessions.constant.js';
import {
  buildBenchPlayersWhere,
  promoteRestedPlayers,
} from '../../../shared/helpers/sport-sessions.helper.js';
import type { SessionContext } from '../../../shared/types/sport-sessions.types.js';
import { PlayerWeightingService } from './player-weighting.service.js';

@Injectable()
export class SessionPlayerEligibilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly playerWeighting: PlayerWeightingService,
  ) {}

  /**
   * The manual match picker's bench. Elapsed rests and timed breaks are
   * promoted first, so the returned status is the one a reservation would see.
   * WAITING keeps the fairness ranking, resting players follow by earliest
   * rest, and players on break sit at the bottom (indefinite breaks last).
   */
  async getEligiblePlayers(session: SessionContext, now: Date = new Date()) {
    const players = await this.prisma.$transaction(async (tx) => {
      await promoteRestedPlayers(tx, session.id, now);

      return tx.sessionPlayer.findMany({
        where: buildBenchPlayersWhere(session.id),
        include: { clubMember: true },
        orderBy: [{ checkedInAt: 'asc' }, { id: 'asc' }],
      });
    });

    console.log('>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>');
    console.log(players);

    // Weighting only decides the order of the waiting group; the breakdown is
    // not part of this payload.
    const rank = new Map(
      this.playerWeighting
        .weight(players, session, now)
        .map((player, index) => [player.id, index] as const),
    );

    const data = [...players]
      .sort((a, b) => {
        const group = this.benchGroup(a.status) - this.benchGroup(b.status);
        if (group !== 0) return group;

        if (a.status === PlayerStatus.WAITING) {
          return (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0) || a.id - b.id;
        }

        return this.compareRestUntil(a.restUntil, b.restUntil) || a.id - b.id;
      })
      .map((player) => ({
        ...player,
        isReady: player.status === PlayerStatus.WAITING,
      }));

    return {
      data,
      meta: {
        total: data.length,
        sessionId: session.id,
      },
    };
  }

  /** Waiting first, then resting, then break. */
  private benchGroup(status: PlayerStatus): number {
    return BENCH_PLAYER_STATUSES.indexOf(status);
  }

  /** Ascending rest end, with an indefinite (null) rest last. */
  private compareRestUntil(a: Date | null, b: Date | null): number {
    if (a === null || b === null) {
      return a === b ? 0 : a === null ? 1 : -1;
    }

    return a.getTime() - b.getTime();
  }
}
