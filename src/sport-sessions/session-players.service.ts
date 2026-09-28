import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../config/prisma/prisma.service.js';
import { SportMembersService } from '../sport-members/sport-members.service.js';
import { SetSessionPlayersDto } from './dto/set-session-players.dto.js';
import { CreateGuestPlayerDto } from './dto/create-guest-player.dto.js';
import type { SessionContext } from './sport-sessions.types.js';

@Injectable()
export class SessionPlayersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sportMembers: SportMembersService,
  ) {}

  private async assertMembersBelong(clubId: string, memberIds: string[]) {
    const unique = [...new Set(memberIds)];

    const members = await this.prisma.clubMember.findMany({
      where: { id: { in: unique }, clubId },
      select: { id: true },
    });

    if (members.length !== unique.length) {
      throw new BadRequestException('One or more members are invalid');
    }

    return unique;
  }

  async setPlayers(session: SessionContext, dto: SetSessionPlayersDto) {
    const memberIds = await this.assertMembersBelong(
      session.clubId,
      dto.clubMemberIds,
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.sessionPlayer.deleteMany({
        where: { sessionId: session.id, clubMemberId: { notIn: memberIds } },
      });
      await tx.sessionPlayer.createMany({
        data: memberIds.map((clubMemberId) => ({
          sessionId: session.id,
          clubMemberId,
        })),
        skipDuplicates: true,
      });
    });

    return this.prisma.sessionPlayer.findMany({
      where: { sessionId: session.id },
      include: { clubMember: true },
    });
  }

  async addPlayers(session: SessionContext, dto: SetSessionPlayersDto) {
    const memberIds = await this.assertMembersBelong(
      session.clubId,
      dto.clubMemberIds,
    );

    await this.prisma.sessionPlayer.createMany({
      data: memberIds.map((clubMemberId) => ({
        sessionId: session.id,
        clubMemberId,
      })),
      skipDuplicates: true,
    });

    return this.prisma.sessionPlayer.findMany({
      where: { sessionId: session.id },
      include: { clubMember: true },
    });
  }

  async addGuest(session: SessionContext, dto: CreateGuestPlayerDto) {
    return this.prisma.$transaction(async (tx) => {
      const member = await this.sportMembers.createMember(
        {
          clubId: session.clubId,
          displayName: dto.displayName,
          isGuest: true,
          createdBySessionId: session.id,
          gender: dto.gender,
          skillLevel: dto.skillLevel,
        },
        tx,
      );

      return tx.sessionPlayer.create({
        data: { sessionId: session.id, clubMemberId: member.id },
        include: { clubMember: true },
      });
    });
  }

  async removePlayer(session: SessionContext, sessionPlayerId: number) {
    const player = await this.prisma.sessionPlayer.findFirst({
      where: { id: sessionPlayerId, sessionId: session.id },
    });

    if (!player) {
      throw new NotFoundException('Session player not found');
    }

    const matches = await this.prisma.matchPlayer.count({
      where: { sessionPlayerId: player.id },
    });

    if (matches > 0) {
      throw new BadRequestException(
        'Cannot remove a player that already has matches',
      );
    }

    await this.prisma.sessionPlayer.delete({ where: { id: player.id } });

    return { message: 'Player removed from session' };
  }
}
