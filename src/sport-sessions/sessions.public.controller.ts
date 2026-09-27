import { Controller, Get, Param } from '@nestjs/common';
import { SportSessionsService } from './sport-sessions.service.js';

@Controller('sessions')
export class SessionsPublicController {
  constructor(private readonly sportSessionsService: SportSessionsService) {}

  @Get(':slug')
  async findPublic(@Param('slug') slug: string) {
    return this.sportSessionsService.findPublicBySlug(slug);
  }
}
