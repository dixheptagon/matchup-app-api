import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { ClubSettingsService } from './club-settings.service.js';
import { UpdateClubSettingsDto } from './dto/update-club-settings.dto.js';
import { RolesGuard } from '../sport-members/guards/roles.guard.js';
import { Roles } from '../sport-members/decorators/roles.decorator.js';
import { CurrentClub } from '../sport-members/decorators/current-club.decorator.js';
import type { SportClub } from '../../prisma/generated/prisma/client.js';

@Controller('sport-clubs/:clubSlug/settings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ClubSettingsController {
  constructor(private readonly clubSettingsService: ClubSettingsService) {}

  @Get()
  @Roles('owner', 'admin', 'member')
  async find(@CurrentClub() club: SportClub) {
    return this.clubSettingsService.find(club);
  }

  @Patch()
  @Roles('owner', 'admin')
  async upsert(
    @CurrentClub() club: SportClub,
    @Body() dto: UpdateClubSettingsDto,
  ) {
    return this.clubSettingsService.upsert(club, dto);
  }
}
