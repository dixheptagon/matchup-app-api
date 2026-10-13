import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../../config/prisma/prisma.service.js';
import { Prisma } from '../../../../../prisma/generated/prisma/client.js';
import {
  GenerateType,
  MatchStatus,
  PlayerStatus,
  TeamGroup,
} from '../../../../../prisma/generated/prisma/enums.js';
import {
  ACTIVE_MATCH_STATUSES,
  buildEligiblePlayersWhere,
} from '../../../shared/helpers/sport-sessions.helper.js';
import {
  MATCH_DETAIL_INCLUDE,
  PLAYERS_PER_MATCH,
} from '../../../shared/constants/sport-sessions.constant.js';
import type { SessionContext } from '../../../shared/types/sport-sessions.types.js';
import { PlayerWeightingService } from '../../players/services/player-weighting.service.js';
import { MatchCompositionService } from './match-composition.service.js';
import { CreateMatchDto } from '../dto/create-match.dto.js';

type Tx = Prisma.TransactionClient;

@Injectable()
export class SessionMatchmakingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly playerWeighting: PlayerWeightingService,
    private readonly composition: MatchCompositionService,
  ) {}

  async autoMatch(session: SessionContext) {
    return this.prisma.$transaction(
      async (tx) => {
        const settings = await tx.sessionSettings.findUnique({
          where: { sessionId: session.id },
        });

        if (!settings) {
          throw new BadRequestException('Session settings not found');
        }

        if (!settings.autoMatchMaking) {
          throw new BadRequestException(
            'Auto matchmaking is disabled for this session',
          );
        }

        const eligible = await tx.sessionPlayer.findMany({
          where: buildEligiblePlayersWhere(session.id),
          include: { clubMember: true },
        });

        if (eligible.length < PLAYERS_PER_MATCH) {
          throw new BadRequestException(
            `At least ${PLAYERS_PER_MATCH} waiting players are required to auto-match`,
          );
        }

        const ranked = this.playerWeighting.weight(eligible, {
          ...session,
          sessionSettings: settings,
        });

        const lineup = this.composition.compose(ranked, {
          mode: settings.matchMakingMode,
          genderPreference: settings.genderPreference,
        });

        return this.persistMatch(
          tx,
          session,
          [lineup.teamA, lineup.teamB],
          GenerateType.AUTO,
        );
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async createManualMatch(session: SessionContext, dto: CreateMatchDto) {
    return this.prisma.$transaction(
      async (tx) => {
        await this.assertPlayersAvailable(tx, session.id, dto);

        return this.persistMatch(
          tx,
          session,
          [dto.teamA, dto.teamB],
          GenerateType.MANUAL,
        );
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  private async assertPlayersAvailable(
    tx: Tx,
    sessionId: string,
    dto: CreateMatchDto,
  ) {
    const playerIds = [...dto.teamA, ...dto.teamB];

    if (new Set(playerIds).size !== PLAYERS_PER_MATCH) {
      throw new BadRequestException(
        'A match requires two distinct teams of two different players',
      );
    }

    const players = await tx.sessionPlayer.findMany({
      where: { id: { in: playerIds }, sessionId },
      select: {
        id: true,
        status: true,
        clubMember: {
          select: { displayName: true },
        },
      },
    });

    if (players.length !== playerIds.length) {
      throw new NotFoundException('One or more session players were not found');
    }

    const notWaiting = players.filter(
      (player) => player.status !== PlayerStatus.WAITING,
    );

    if (notWaiting.length > 0) {
      const details = notWaiting
        .map((player) => {
          const name = player.clubMember?.displayName ?? `Player ${player.id}`;
          return `${name} (Status: ${player.status})`;
        })
        .join(', ');

      throw new BadRequestException(
        `Cannot match players who are not in a waiting state: ${details}`,
      );
    }

    const locked = await tx.matchPlayer.findMany({
      where: {
        sessionPlayerId: { in: playerIds },
        match: { status: { in: ACTIVE_MATCH_STATUSES } },
      },
      select: { sessionPlayerId: true },
    });

    if (locked.length > 0) {
      throw new BadRequestException(
        `Player(s) already committed to an unfinished match: ${[
          ...new Set(locked.map((row) => row.sessionPlayerId)),
        ].join(', ')}`,
      );
    }
  }

  private async persistMatch(
    tx: Tx,
    session: SessionContext,
    teams: number[][],
    generatedBy: GenerateType,
  ) {
    const playerIds = teams.flat();

    // The play-order sequence stays null until the match actually starts.
    const match = await tx.sessionMatch.create({
      data: {
        sessionId: session.id,
        sessionCourtId: null,
        sequence: null,
        status: MatchStatus.QUEUED,
        generatedBy,
      },
    });

    await tx.matchPlayer.createMany({
      data: teams.flatMap((team, teamIndex) =>
        team.map((sessionPlayerId, position) => ({
          matchId: match.id,
          sessionPlayerId,
          team: teamIndex === 0 ? TeamGroup.TEAM_A : TeamGroup.TEAM_B,
          position: position + 1,
        })),
      ),
    });

    await tx.sessionPlayer.updateMany({
      where: { id: { in: playerIds } },
      data: { status: PlayerStatus.RESERVED },
    });

    return tx.sessionMatch.findUnique({
      where: { id: match.id },
      include: MATCH_DETAIL_INCLUDE,
    });
  }
}
