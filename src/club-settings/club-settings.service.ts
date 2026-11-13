import {
  Injectable,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../config/prisma/prisma.service.js';
import { UpdateClubSettingsDto } from './dto/update-club-settings.dto.js';
import { DEFAULT_CLUB_SETTINGS } from './club-settings.constant.js';
import { expandMatchmakingPreset } from './matchmaking-presets.constant.js';
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
    const data = expandMatchmakingPreset(dto);

    const existing = await this.prisma.clubSettings.findUnique({
      where: { clubId: club.id },
      select: { id: true },
    });

    if (!existing) {
      if (data.defaultSport === undefined || data.leaderBoardMode === undefined) {
        throw new BadRequestException(
          'defaultSport and leaderBoardMode are required when creating club settings',
        );
      }

      return this.prisma.clubSettings.create({
        data: {
          ...data,
          clubId: club.id,
          defaultSport: data.defaultSport,
          leaderBoardMode: data.leaderBoardMode,
        },
      });
    }

    return this.prisma.clubSettings.update({
      where: { clubId: club.id },
      data,
    });
  }
}
