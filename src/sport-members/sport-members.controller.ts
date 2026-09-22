import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { SportMembersService } from './sport-members.service.js';
import { CreateSportMemberDto } from './dto/create-sport-member.dto.js';
import { UpdateSportMemberDto } from './dto/update-sport-member.dto.js';
import { SportMemberQueryDto } from './dto/sport-member-query.dto.js';
import { RolesGuard } from './guards/roles.guard.js';
import { Roles } from './decorators/roles.decorator.js';
import { CurrentClub } from './decorators/current-club.decorator.js';
import type { SportClub } from '../../prisma/generated/prisma/client.js';

interface AuthenticatedRequest extends Request {
  user: { id: string };
}

@Controller('sport-clubs/:clubSlug/members')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SportMembersController {
  constructor(private readonly sportMembersService: SportMembersService) {}

  @Post()
  @Roles('owner', 'admin')
  async create(
    @CurrentClub() club: SportClub,
    @Body() dto: CreateSportMemberDto,
  ) {
    return this.sportMembersService.create(club, dto);
  }

  @Get()
  @Roles('owner', 'admin')
  async findAll(
    @CurrentClub() club: SportClub,
    @Query() query: SportMemberQueryDto,
  ) {
    return this.sportMembersService.findAllByClub(
      club,
      query.page ?? 1,
      query.limit ?? 20,
      query,
    );
  }

  @Get(':memberId')
  @Roles('owner', 'admin', 'member')
  async findOne(
    @CurrentClub() club: SportClub,
    @Param('memberId', ParseUUIDPipe) memberId: string,
  ) {
    return this.sportMembersService.findOne(club, memberId);
  }

  @Patch(':memberId')
  @Roles('owner', 'admin')
  async update(
    @Req() req: AuthenticatedRequest,
    @CurrentClub() club: SportClub,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body() dto: UpdateSportMemberDto,
  ) {
    return this.sportMembersService.update(req.user.id, club, memberId, dto);
  }

  @Delete(':memberId')
  @Roles('owner', 'admin')
  async remove(
    @Req() req: AuthenticatedRequest,
    @CurrentClub() club: SportClub,
    @Param('memberId', ParseUUIDPipe) memberId: string,
  ) {
    return this.sportMembersService.remove(req.user.id, club, memberId);
  }
}
