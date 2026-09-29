import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { SportSessionsService } from './sport-sessions.service.js';
import { RolesGuard } from '../../sport-members/guards/roles.guard.js';
import { CurrentClub } from '../../sport-members/decorators/current-club.decorator.js';
import type { SportClub } from '../../../prisma/generated/prisma/client.js';

@Controller('sport-clubs/:clubSlug/public/sessions')
@UseGuards(RolesGuard)
export class SessionsPublicController {
  constructor(private readonly sportSessionsService: SportSessionsService) {}

  @Get(':slug')
  async findPublic(
    @CurrentClub() club: SportClub,
    @Param('slug') slug: string,
  ) {
    return this.sportSessionsService.findPublicBySlug(club, slug);
  }
}
