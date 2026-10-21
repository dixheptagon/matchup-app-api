import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../../config/prisma/prisma.service.js';
import { PlayerStatus } from '../../../../../prisma/generated/prisma/enums.js';
import { DEFAULT_CLUB_SETTINGS } from '../../../../club-settings/club-settings.constant.js';
import {
  MILLISECONDS_PER_MINUTE,
  RESTABLE_PLAYER_STATUSES,
} from '../../../shared/constants/sport-sessions.constant.js';
import type { SessionContext } from '../../../shared/types/sport-sessions.types.js';
import { RestPlayerDto } from '../dto/rest-player.dto.js';

@Injectable()
export class SessionPlayerRestService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Puts a player on rest manually: either an unused WAITING player who asked
   * for a break, or an already-resting player whose cooldown is being extended.
   *
   * The read only produces a friendly message. The guarded updateMany is what
   * keeps a player who was reserved, playing, or checked out by a concurrent
   * request from being silently sent to rest.
   */
  async restPlayer(
    session: SessionContext,
    sessionPlayerId: number,
    dto: RestPlayerDto,
  ) {
    const player = await this.prisma.sessionPlayer.findFirst({
      where: { id: sessionPlayerId, sessionId: session.id },
    });

    if (!player) {
      throw new NotFoundException('Session player not found');
    }

    if (!RESTABLE_PLAYER_STATUSES.includes(player.status)) {
      throw new BadRequestException(`Cannot rest a ${player.status} player`);
    }

    const minutes = await this.resolveDuration(session.id, dto);

    const now = Date.now();
    const baseTime =
      player.status === PlayerStatus.RESTING &&
      player.restUntil &&
      player.restUntil.getTime() > now
        ? player.restUntil.getTime()
        : now;

    const restUntil = new Date(baseTime + minutes * MILLISECONDS_PER_MINUTE);

    const update = await this.prisma.sessionPlayer.updateMany({
      where: {
        id: player.id,
        sessionId: session.id,
        status: { in: RESTABLE_PLAYER_STATUSES },
      },
      data: { status: PlayerStatus.RESTING, restUntil },
    });

    if (update.count === 0) {
      throw new ConflictException('Player status changed by another request');
    }

    return this.prisma.sessionPlayer.findUnique({
      where: { id: player.id },
      include: { clubMember: true },
    });
  }

  /**
   * Ends a rest early and returns the player to the waiting pool. The lazy
   * promoteRestedPlayers check covers the same transition at the next
   * matchmaking call, but only once restUntil has passed.
   */
  async resumePlayer(session: SessionContext, sessionPlayerId: number) {
    const player = await this.prisma.sessionPlayer.findFirst({
      where: { id: sessionPlayerId, sessionId: session.id },
    });

    if (!player) {
      throw new NotFoundException('Session player not found');
    }

    if (player.status !== PlayerStatus.RESTING) {
      throw new BadRequestException(`Player is not resting (${player.status})`);
    }

    const update = await this.prisma.sessionPlayer.updateMany({
      where: {
        id: player.id,
        sessionId: session.id,
        status: PlayerStatus.RESTING,
      },
      data: { status: PlayerStatus.WAITING, restUntil: null },
    });

    if (update.count === 0) {
      throw new ConflictException('Player status changed by another request');
    }

    return this.prisma.sessionPlayer.findUnique({
      where: { id: player.id },
      include: { clubMember: true },
    });
  }

  private async resolveDuration(
    sessionId: string,
    dto: RestPlayerDto,
  ): Promise<number> {
    if (dto.durationMinutes !== undefined) {
      return dto.durationMinutes;
    }

    const settings = await this.prisma.sessionSettings.findUnique({
      where: { sessionId },
      select: { minimumRestTime: true },
    });

    const minutes =
      settings?.minimumRestTime ?? DEFAULT_CLUB_SETTINGS.minimumRestTime;

    if (minutes <= 0) {
      throw new BadRequestException(
        'Rest duration must be greater than 0; set durationMinutes for this session',
      );
    }

    return minutes;
  }
}
