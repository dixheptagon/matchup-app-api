import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../config/prisma/prisma.service.js';
import {
  MatchStatus,
  PlayerStatus,
} from '../../../../../prisma/generated/prisma/enums.js';
import type { SessionContext } from '../../../shared/types/sport-sessions.types.js';

@Injectable()
export class PlayerPoolService {
  constructor(private readonly prisma: PrismaService) {}

  async getEligiblePlayers(session: SessionContext) {
    return this.prisma.sessionPlayer.findMany({
      where: {
        sessionId: session.id,
        status: PlayerStatus.WAITING,
        matchPlayers: {
          none: {
            match: {
              status: {
                in: [
                  MatchStatus.QUEUED,
                  MatchStatus.READY,
                  MatchStatus.PLAYING,
                ],
              },
            },
          },
        },
      },
      include: { clubMember: true },
      orderBy: [{ checkedInAt: 'asc' }, { id: 'asc' }],
    });
  }
}
