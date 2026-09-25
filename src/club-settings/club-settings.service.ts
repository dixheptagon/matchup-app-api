import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../config/prisma/prisma.service.js';
import { UpdateClubSettingsDto } from './dto/update-club-settings.dto.js';
import { DEFAULT_CLUB_SETTINGS } from './club-settings.constant.js';
import type { SportClub } from '../../prisma/generated/prisma/client.js';

@Injectable()
export class ClubSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async find(club: SportClub) {
    const settings = await this.prisma.clubSettings.findUnique({
      where: { clubId: club.id },
    });

    if (!settings) {
      return {
        id: null,
        clubId: club.id,
        ...DEFAULT_CLUB_SETTINGS,
      };
    }

    return settings;
  }

  async upsert(club: SportClub, dto: UpdateClubSettingsDto) {
    const existing = await this.prisma.clubSettings.findUnique({
      where: { clubId: club.id },
      select: { id: true },
    });

    if (!existing) {
      if (dto.defaultSport === undefined || dto.leaderBoardMode === undefined) {
        throw new BadRequestException(
          'defaultSport and leaderBoardMode are required when creating club settings',
        );
      }

      return this.prisma.clubSettings.create({
        data: {
          ...dto,
          clubId: club.id,
          defaultSport: dto.defaultSport,
          leaderBoardMode: dto.leaderBoardMode,
        },
      });
    }

    return this.prisma.clubSettings.update({
      where: { clubId: club.id },
      data: dto,
    });
  }
}
