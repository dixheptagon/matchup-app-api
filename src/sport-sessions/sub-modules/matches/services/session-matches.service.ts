import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../../config/prisma/prisma.service.js';
import { Prisma } from '../../../../../prisma/generated/prisma/client.js';
import {
  MatchStatus,
  PlayerStatus,
} from '../../../../../prisma/generated/prisma/enums.js';
import {
  DELETABLE_MATCH_STATUSES,
  MATCH_DETAIL_INCLUDE,
  QUEUE_MATCH_STATUSES,
  RELEASABLE_PLAYER_STATUSES,
  SOFT_CANCEL_MATCH_STATUSES,
} from '../../../shared/constants/sport-sessions.constant.js';
import type { SessionContext } from '../../../shared/types/sport-sessions.types.js';
import { MatchQueueQueryDto } from '../dto/match-queue-query.dto.js';
import { CancelMatchDto } from '../dto/cancel-match.dto.js';

type Tx = Prisma.TransactionClient;

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

  /**
   * Cancels a match: never-started matches (QUEUED/READY) are hard deleted,
   * while a live (PLAYING) match is soft-cancelled and keeps its record.
   * Players that were committed to the match return to the waiting pool.
   */
  async cancelMatch(
    session: SessionContext,
    matchId: string,
    dto: CancelMatchDto = {},
  ) {
    return this.prisma.$transaction(async (tx) => {
      const match = await tx.sessionMatch.findFirst({
        where: { id: matchId, sessionId: session.id },
        include: {
          players: {
            include: { sessionPlayer: { select: { id: true, status: true } } },
          },
        },
      });

      if (!match) {
        throw new NotFoundException('Match not found');
      }

      const isDeletable = DELETABLE_MATCH_STATUSES.includes(match.status);
      const isSoftCancellable = SOFT_CANCEL_MATCH_STATUSES.includes(
        match.status,
      );

      if (!isDeletable && !isSoftCancellable) {
        throw new BadRequestException(`Cannot cancel a ${match.status} match`);
      }

      const releasedPlayerIds = match.players
        .filter((player) =>
          RELEASABLE_PLAYER_STATUSES.includes(player.sessionPlayer.status),
        )
        .map((player) => player.sessionPlayerId);

      const reason = dto.reason ?? null;

      if (isDeletable) {
        await tx.sessionMatch.delete({ where: { id: match.id } });
      } else {
        await tx.sessionMatch.update({
          where: { id: match.id },
          data: {
            status: MatchStatus.CANCELLED,
            cancelReason: reason,
            cancelledAt: new Date(),
          },
        });
      }

      await this.releasePlayers(tx, releasedPlayerIds);

      return {
        action: isDeletable ? 'DELETED' : 'CANCELLED',
        matchId: match.id,
        sequence: match.sequence,
        releasedPlayerIds,
        cancelReason: isDeletable ? null : reason,
      };
    });
  }

  private async releasePlayers(tx: Tx, playerIds: number[]) {
    if (playerIds.length === 0) return;

    await tx.sessionPlayer.updateMany({
      where: {
        id: { in: playerIds },
        status: { in: RELEASABLE_PLAYER_STATUSES },
      },
      data: { status: PlayerStatus.WAITING },
    });
  }
}
