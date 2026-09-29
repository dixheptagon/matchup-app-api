import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../config/prisma/prisma.service.js';
import { CreateSessionDto } from './dto/create-session.dto.js';
import { UpdateSessionDetailsDto } from './dto/update-session-details.dto.js';
import { SessionQueryDto } from './dto/session-query.dto.js';
import { generateUniqueSlug } from '../../common/utils/generate-slug.js';
import { DEFAULT_CLUB_SETTINGS } from '../../club-settings/club-settings.constant.js';
import {
  buildFallbackTitle,
  buildSessionSettings,
} from './sport-sessions.helper.js';
import {
  MIN_COURTS_TO_START,
  MIN_PLAYERS_TO_START,
  PUBLIC_SESSION_SELECT,
  SESSION_DETAIL_INCLUDE,
} from './sport-sessions.constant.js';
import type { SessionContext } from './sport-sessions.types.js';
import {
  SessionStatus,
  SessionsType,
} from '../../../prisma/generated/prisma/enums.js';
import type { SportClub } from '../../../prisma/generated/prisma/client.js';

@Injectable()
export class SportSessionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(club: SportClub, dto: CreateSessionDto) {
    const clubSettings = await this.prisma.clubSettings.findUnique({
      where: { clubId: club.id },
    });

    const settings = buildSessionSettings(
      clubSettings ?? DEFAULT_CLUB_SETTINGS,
    );
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

  async findAllByClub(club: SportClub, query: SessionQueryDto = {}) {
    const { page = 1, limit = 20 } = query;

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

  async findPublicBySlug(club: SportClub, slug: string) {
    const session = await this.prisma.sportSession.findUnique({
      where: { slug, clubId: club.id },
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
