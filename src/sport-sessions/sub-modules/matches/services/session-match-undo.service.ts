import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../../config/prisma/prisma.service.js';
import { Prisma } from '../../../../../prisma/generated/prisma/client.js';
import {
  MatchStatus,
  PlayerStatus,
} from '../../../../../prisma/generated/prisma/enums.js';
import {
  MATCH_DETAIL_INCLUDE,
  POST_FINISH_PLAYER_STATUSES,
  UNDOABLE_MATCH_STATUSES,
} from '../../../shared/constants/sport-sessions.constant.js';
import { ACTIVE_MATCH_STATUSES } from '../../../shared/helpers/sport-sessions.helper.js';
import type { SessionContext } from '../../../shared/types/sport-sessions.types.js';
import { SessionMatchResultService } from './session-match-result.service.js';

type Tx = Prisma.TransactionClient;

/**
 * Reverses a finished match. Kept apart from SessionMatchesService because the
 * undo writes a wide, cross-cutting set of rows and has its own locking order.
 */
@Injectable()
export class SessionMatchUndoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly matchResults: SessionMatchResultService,
  ) {}

  /**
   * The match record goes back to the queue, its players are reserved again,
   * and every derived counter is recomputed from the matches that are still
   * finished.
   *
   * The match keeps its createdAt and gets no requeuedAt marker, so the queue
   * (which orders by creation) puts it back where it originally sat. The court
   * was released when the match finished, so a requeued match holds no court.
   */
  async undoFinishMatch(session: SessionContext, matchId: string) {
    return this.prisma.$transaction(async (tx) => {
      const match = await tx.sessionMatch.findFirst({
        where: { id: matchId, sessionId: session.id },
        include: { players: { select: { sessionPlayerId: true } } },
      });

      if (!match) {
        throw new NotFoundException('Match not found');
      }

      if (!UNDOABLE_MATCH_STATUSES.includes(match.status)) {
        throw new BadRequestException(`Cannot undo a ${match.status} match`);
      }

      const playerIds = [
        ...new Set(match.players.map((p) => p.sessionPlayerId)),
      ].sort((left, right) => left - right);

      await this.assertPlayersRecoverable(tx, session.id, match.id, playerIds);

      // Lock order is match -> stats -> players -> matchResult.
      const matchUpdate = await tx.sessionMatch.updateMany({
        where: { id: match.id, status: { in: UNDOABLE_MATCH_STATUSES } },
        data: {
          status: MatchStatus.QUEUED,
          sessionCourtId: null,
          assignedAt: null,
          startedAt: null,
          endedAt: null,
          scoreTeamA: 0,
          scoreTeamB: 0,
          cancelReason: null,
          cancelledAt: null,
        },
      });

      if (matchUpdate.count === 0) {
        throw new ConflictException('Match was undone by another request');
      }

      const aggregates = await this.matchResults.reconcilePlayers(
        tx,
        session.id,
        playerIds,
      );

      for (const id of playerIds) {
        const aggregate = aggregates.get(id);

        const playerUpdate = await tx.sessionPlayer.updateMany({
          where: {
            id,
            sessionId: session.id,
            status: { in: POST_FINISH_PLAYER_STATUSES },
          },
          data: {
            status: PlayerStatus.RESERVED,
            restUntil: null,
            playCount: aggregate?.playCount ?? 0,
            lastMatchFinishedAt: aggregate?.lastMatchFinishedAt ?? null,
          },
        });

        if (playerUpdate.count === 0) {
          throw new ConflictException(
            'One or more players are no longer available to reserve',
          );
        }
      }

      await tx.matchResult.deleteMany({ where: { matchId: match.id } });

      return tx.sessionMatch.findUnique({
        where: { id: match.id },
        include: MATCH_DETAIL_INCLUDE,
      });
    });
  }

  /**
   * A finish only puts players into RESTING or WAITING, so anything else means
   * someone checked out, left, or was already pulled into another match.
   */
  private async assertPlayersRecoverable(
    tx: Tx,
    sessionId: string,
    matchId: string,
    playerIds: number[],
  ) {
    if (playerIds.length === 0) return;

    const players = await tx.sessionPlayer.findMany({
      where: { id: { in: playerIds }, sessionId },
      select: { id: true, status: true },
    });

    if (players.length !== playerIds.length) {
      throw new ConflictException(
        'One or more players no longer belong to this session',
      );
    }

    if (
      players.some(
        (player) => !POST_FINISH_PLAYER_STATUSES.includes(player.status),
      )
    ) {
      throw new ConflictException(
        'One or more players are not resting or waiting',
      );
    }

    const committed = await tx.matchPlayer.count({
      where: {
        sessionPlayerId: { in: playerIds },
        matchId: { not: matchId },
        match: { status: { in: ACTIVE_MATCH_STATUSES } },
      },
    });

    if (committed > 0) {
      throw new ConflictException(
        'One or more players are committed to another active match',
      );
    }
  }
}
