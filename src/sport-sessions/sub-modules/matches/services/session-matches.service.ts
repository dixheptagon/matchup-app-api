import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../../config/prisma/prisma.service.js';
import { Prisma } from '../../../../../prisma/generated/prisma/client.js';
import {
  CourtStatus,
  MatchStatus,
  PlayerStatus,
} from '../../../../../prisma/generated/prisma/enums.js';
import {
  ASSIGNABLE_MATCH_STATUSES,
  DELETABLE_MATCH_STATUSES,
  MATCH_DETAIL_INCLUDE,
  QUEUE_MATCH_STATUSES,
  RELEASABLE_PLAYER_STATUSES,
  SOFT_CANCEL_MATCH_STATUSES,
} from '../../../shared/constants/sport-sessions.constant.js';
import type { SessionContext } from '../../../shared/types/sport-sessions.types.js';
import { MatchQueueQueryDto } from '../dto/match-queue-query.dto.js';
import { CancelMatchDto } from '../dto/cancel-match.dto.js';
import { AssignCourtDto } from '../dto/assign-court.dto.js';

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
        // Queued matches have no play-order sequence yet, so fall back to creation order.
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
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
      await this.releaseCourt(tx, match.sessionCourtId);

      return {
        action: isDeletable ? 'DELETED' : 'CANCELLED',
        matchId: match.id,
        sequence: match.sequence,
        releasedPlayerIds,
        cancelReason: isDeletable ? null : reason,
      };
    });
  }

  /**
   * Assigns an available session court to a queued match, moving it to READY and
   * taking the court out of circulation until the match ends or is cancelled.
   *
   * The reads above only produce friendly errors; the guarded updateMany calls
   * are what make this safe. Under PostgreSQL ReadCommitted an UPDATE that waits
   * on a row lock re-evaluates its WHERE against the committed row, so a
   * concurrent writer that got there first leaves count at 0 and we roll back.
   */
  async assignCourt(
    session: SessionContext,
    matchId: string,
    dto: AssignCourtDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const match = await tx.sessionMatch.findFirst({
        where: { id: matchId, sessionId: session.id },
      });

      if (!match) {
        throw new NotFoundException('Match not found');
      }

      if (!ASSIGNABLE_MATCH_STATUSES.includes(match.status)) {
        throw new BadRequestException(
          `Cannot assign a court to a ${match.status} match`,
        );
      }

      const sessionCourt = await tx.sessionCourt.findFirst({
        where: { id: dto.sessionCourtId, sessionId: session.id },
      });

      if (!sessionCourt) {
        throw new NotFoundException('Court not found in this session');
      }

      if (sessionCourt.status !== CourtStatus.AVAILABLE) {
        throw new BadRequestException(
          `Court is not available (${sessionCourt.status})`,
        );
      }

      // Lock order is match -> court, matching cancelMatch.
      const matchUpdate = await tx.sessionMatch.updateMany({
        where: {
          id: match.id,
          status: { in: ASSIGNABLE_MATCH_STATUSES },
        },
        data: {
          sessionCourtId: sessionCourt.id,
          status: MatchStatus.READY,
          assignedAt: new Date(),
        },
      });

      if (matchUpdate.count === 0) {
        throw new ConflictException('Match was assigned by another request');
      }

      const courtUpdate = await tx.sessionCourt.updateMany({
        where: {
          id: sessionCourt.id,
          status: CourtStatus.AVAILABLE,
        },
        data: { status: CourtStatus.IN_USE },
      });

      if (courtUpdate.count === 0) {
        throw new ConflictException('Court was taken by another request');
      }

      return tx.sessionMatch.findUnique({
        where: { id: match.id },
        include: MATCH_DETAIL_INCLUDE,
      });
    });
  }

  private async releaseCourt(tx: Tx, sessionCourtId: number | null | undefined) {
    if (sessionCourtId === null || sessionCourtId === undefined) return;

    await tx.sessionCourt.update({
      where: { id: sessionCourtId },
      data: { status: CourtStatus.AVAILABLE },
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
