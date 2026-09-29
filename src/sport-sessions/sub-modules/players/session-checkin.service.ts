import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../config/prisma/prisma.service.js';
import { CheckInMultiplePlayersDto } from './dto/session-checkin.dto.js';
import { PlayerStatus } from '../../../../prisma/generated/prisma/enums.js';
import { SessionContext } from '../../shared/types/sport-sessions.types.js';

@Injectable()
export class SessionCheckinService {
  constructor(private readonly prisma: PrismaService) {}

  private assertCheckInEnabled(session: SessionContext) {
    if (session.sessionSettings && !session.sessionSettings.attendanceCheckIn) {
      throw new BadRequestException(
        'Player check-in is disabled for this session. Please update session settings to allow check-ins.',
      );
    }
  }

  private async assertPlayersCheckInEligible(
    sessionId: string,
    playerIds: number[],
  ) {
    const unique = [...new Set(playerIds)];

    const players = await this.prisma.sessionPlayer.findMany({
      where: { id: { in: unique }, sessionId },
      select: {
        id: true,
        status: true,
        clubMember: { select: { displayName: true } },
      },
    });

    if (players.length !== unique.length) {
      throw new NotFoundException('One or more session players were not found');
    }

    const invalidPlayers = players.filter(
      (p) => p.status !== PlayerStatus.NOT_ARRIVED,
    );

    if (invalidPlayers.length > 0) {
      const playerDetails = invalidPlayers
        .map((p) => `${p.clubMember.displayName ?? 'Unknown'} (${p.status})`)
        .join(', ');

      throw new BadRequestException(
        `Cannot check in player(s) with active status: ${playerDetails}`,
      );
    }

    return unique;
  }

  private buildCheckInData(status: PlayerStatus) {
    return {
      status,
      checkedInAt: new Date(),
      playCount: 0,
      restCount: 0,
    };
  }

  async getCheckInStatus(
    session: SessionContext,
    status: PlayerStatus = PlayerStatus.NOT_ARRIVED,
  ) {
    return this.prisma.sessionPlayer.findMany({
      where: { sessionId: session.id, status: status },
      include: { clubMember: true },
      orderBy:
        status === PlayerStatus.NOT_ARRIVED
          ? { clubMember: { displayName: 'asc' } }
          : { checkedInAt: 'asc' },
    });
  }

  async checkInSinglePlayer(session: SessionContext, sessionPlayerId: number) {
    this.assertCheckInEnabled(session);

    const status = PlayerStatus.WAITING;
    const [id] = await this.assertPlayersCheckInEligible(session.id, [
      sessionPlayerId,
    ]);

    return this.prisma.sessionPlayer.update({
      where: { id },
      data: this.buildCheckInData(status),
      include: { clubMember: true },
    });
  }

  async checkInMultiplePlayers(
    session: SessionContext,
    dto: CheckInMultiplePlayersDto,
  ) {
    this.assertCheckInEnabled(session);

    const status = PlayerStatus.WAITING;
    const ids = await this.assertPlayersCheckInEligible(
      session.id,
      dto.sessionPlayerIds,
    );

    await this.prisma.sessionPlayer.updateMany({
      where: { id: { in: ids } },
      data: this.buildCheckInData(status),
    });

    return this.prisma.sessionPlayer.findMany({
      where: { id: { in: ids } },
      include: { clubMember: true },
      orderBy: { checkedInAt: 'asc' },
    });
  }

  async checkOutPlayer(session: SessionContext, sessionPlayerId: number) {
    const player = await this.prisma.sessionPlayer.findFirst({
      where: { id: sessionPlayerId, sessionId: session.id },
    });

    if (!player) {
      throw new NotFoundException('Session player not found');
    }

    if (player.status === PlayerStatus.LEFT) {
      throw new BadRequestException('Player has already left the session');
    }

    return this.prisma.sessionPlayer.update({
      where: { id: player.id },
      data: { status: PlayerStatus.LEFT, lastMatchFinishedAt: new Date() },
      include: { clubMember: true },
    });
  }
}
