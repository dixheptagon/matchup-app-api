import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../config/prisma/prisma.service.js';
import { CreateSessionDto } from './dto/create-session.dto.js';
import { UpdateSessionDetailsDto } from './dto/update-session-details.dto.js';
import { UpdateSessionSettingsDto } from './dto/update-session-settings.dto.js';
import { SetSessionCourtsDto } from './dto/set-session-courts.dto.js';
import { SetSessionPlayersDto } from './dto/set-session-players.dto.js';
import { CreateGuestPlayerDto } from './dto/create-guest-player.dto.js';
import { SessionQueryDto } from './dto/session-query.dto.js';
import { generateUniqueSlug } from '../common/utils/generate-slug.js';
import { DEFAULT_CLUB_SETTINGS } from '../club-settings/club-settings.constant.js';
import {
  buildFallbackTitle,
  buildSessionSettings,
  getLockedActiveSettings,
} from './sport-sessions.helper.js';
import {
  MIN_COURTS_TO_START,
  MIN_PLAYERS_TO_START,
  PUBLIC_SESSION_SELECT,
  SESSION_DETAIL_INCLUDE,
} from './sport-sessions.constant.js';
import type { SessionContext } from './sport-sessions.types.js';
import {
  RoleType,
  SessionStatus,
  SessionsType,
} from '../../prisma/generated/prisma/enums.js';
import type { SportClub } from '../../prisma/generated/prisma/client.js';

@Injectable()
export class SportSessionsService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertCourtsBelong(clubId: string, courtIds: number[]) {
    const unique = [...new Set(courtIds)];

    const courts = await this.prisma.court.findMany({
      where: { id: { in: unique }, clubId, isActive: true },
      select: { id: true },
    });

    if (courts.length !== unique.length) {
      throw new BadRequestException(
        'One or more courts are invalid or inactive',
      );
    }

    return unique;
  }

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

  async create(club: SportClub, dto: CreateSessionDto) {
    const clubSettings = await this.prisma.clubSettings.findUnique({
      where: { clubId: club.id },
    });

    const settings = buildSessionSettings(clubSettings ?? DEFAULT_CLUB_SETTINGS);
    const title = dto.title?.trim() || buildFallbackTitle(dto.type);
    const slug = await generateUniqueSlug(title, this.prisma, 'sportSession');

    return this.prisma.sportSession.create({
      data: {
        clubId: club.id,
        title,
        slug,
        description: dto.description,
        type: dto.type ?? SessionsType.OPEN_PLAY,
        scheduledAt: dto.scheduledAt,
        status: SessionStatus.DRAFT,
        sessionSettings: { create: settings },
      },
      include: SESSION_DETAIL_INCLUDE,
    });
  }

  async findAllByClub(
    club: SportClub,
    page = 1,
    limit = 20,
    query: SessionQueryDto = {},
  ) {
    const where: {
      clubId: string;
      status?: SessionStatus;
      type?: SessionsType;
      title?: { contains: string; mode: 'insensitive' };
    } = { clubId: club.id };

    if (query.status !== undefined) where.status = query.status;
    if (query.type !== undefined) where.type = query.type;
    if (query.search) {
      where.title = { contains: query.search, mode: 'insensitive' };
    }

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.sportSession.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          _count: { select: { players: true, sessionCourts: true } },
        },
      }),
      this.prisma.sportSession.count({ where }),
    ]);

    return { data, meta: { page, limit, total } };
  }

  async findOne(session: SessionContext) {
    return session;
  }

  async findPublicBySlug(slug: string) {
    const session = await this.prisma.sportSession.findUnique({
      where: { slug },
      select: PUBLIC_SESSION_SELECT,
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    return session;
  }

  async updateDetails(session: SessionContext, dto: UpdateSessionDetailsDto) {
    const data: {
      title?: string | null;
      slug?: string;
      description?: string | null;
      type?: SessionsType;
      scheduledAt?: Date | null;
    } = {};

    if (dto.title !== undefined) {
      data.title = dto.title;
      if (dto.title && dto.title !== session.title) {
        data.slug = await generateUniqueSlug(
          dto.title,
          this.prisma,
          'sportSession',
        );
      }
    }
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.scheduledAt !== undefined) data.scheduledAt = dto.scheduledAt;

    return this.prisma.sportSession.update({
      where: { id: session.id },
      data,
      include: SESSION_DETAIL_INCLUDE,
    });
  }

  async updateSettings(
    session: SessionContext,
    dto: UpdateSessionSettingsDto,
  ) {
    if (session.status === SessionStatus.ACTIVE) {
      const invalid = getLockedActiveSettings(dto);

      if (invalid.length > 0) {
        throw new BadRequestException(
          `Cannot change ${invalid.join(', ')} while the session is active`,
        );
      }
    }

    return this.prisma.sessionSettings.update({
      where: { sessionId: session.id },
      data: dto,
    });
  }

  async setCourts(session: SessionContext, dto: SetSessionCourtsDto) {
    const courtIds = await this.assertCourtsBelong(
      session.clubId,
      dto.courtIds,
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.sessionCourt.deleteMany({
        where: { sessionId: session.id, courtId: { notIn: courtIds } },
      });
      await tx.sessionCourt.createMany({
        data: courtIds.map((courtId) => ({ sessionId: session.id, courtId })),
        skipDuplicates: true,
      });
    });

    return this.prisma.sessionCourt.findMany({
      where: { sessionId: session.id },
      include: { court: true },
    });
  }

  async addCourts(session: SessionContext, dto: SetSessionCourtsDto) {
    const courtIds = await this.assertCourtsBelong(
      session.clubId,
      dto.courtIds,
    );

    await this.prisma.sessionCourt.createMany({
      data: courtIds.map((courtId) => ({ sessionId: session.id, courtId })),
      skipDuplicates: true,
    });

    return this.prisma.sessionCourt.findMany({
      where: { sessionId: session.id },
      include: { court: true },
    });
  }

  async removeCourt(session: SessionContext, sessionCourtId: number) {
    const sessionCourt = await this.prisma.sessionCourt.findFirst({
      where: { id: sessionCourtId, sessionId: session.id },
    });

    if (!sessionCourt) {
      throw new NotFoundException('Session court not found');
    }

    const matches = await this.prisma.sessionMatch.count({
      where: { sessionCourtId: sessionCourt.id },
    });

    if (matches > 0) {
      throw new BadRequestException(
        'Cannot remove a court that already has matches',
      );
    }

    await this.prisma.sessionCourt.delete({
      where: { id: sessionCourt.id },
    });

    return { message: 'Court removed from session' };
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
    const duplicate = await this.prisma.clubMember.findFirst({
      where: {
        clubId: session.clubId,
        displayName: { equals: dto.displayName, mode: 'insensitive' },
      },
    });

    if (duplicate) {
      throw new ConflictException('Member with this name already exists');
    }

    return this.prisma.$transaction(async (tx) => {
      const member = await tx.clubMember.create({
        data: {
          clubId: session.clubId,
          displayName: dto.displayName,
          isGuest: true,
          role: RoleType.MEMBER,
          createdBySessionId: session.id,
          ...(dto.gender !== undefined ? { gender: dto.gender } : {}),
          ...(dto.skillLevel !== undefined
            ? { skillLevel: dto.skillLevel }
            : {}),
        },
      });

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

  async start(session: SessionContext) {
    if (session._count.sessionCourts < MIN_COURTS_TO_START) {
      throw new BadRequestException(
        `At least ${MIN_COURTS_TO_START} court(s) are required to start`,
      );
    }

    if (session._count.players < MIN_PLAYERS_TO_START) {
      throw new BadRequestException(
        `At least ${MIN_PLAYERS_TO_START} players are required to start`,
      );
    }

    return this.prisma.sportSession.update({
      where: { id: session.id },
      data: { status: SessionStatus.ACTIVE, startedAt: new Date() },
      include: SESSION_DETAIL_INCLUDE,
    });
  }

  async remove(session: SessionContext) {
    await this.prisma.sportSession.delete({ where: { id: session.id } });

    return { message: 'Session deleted successfully' };
  }
}
