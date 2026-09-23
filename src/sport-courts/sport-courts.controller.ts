import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { SportCourtsService } from './sport-courts.service.js';
import { CreateCourtDto } from './dto/create-court.dto.js';
import { UpdateCourtDto } from './dto/update-court.dto.js';
import { CourtOrderQueryDto } from './dto/court-order-query.dto.js';
import { ReorderCourtsDto } from './dto/reorder-courts.dto.js';
import { RolesGuard } from '../sport-members/guards/roles.guard.js';
import { Roles } from '../sport-members/decorators/roles.decorator.js';
import { CurrentClub } from '../sport-members/decorators/current-club.decorator.js';
import type { SportClub } from '../../prisma/generated/prisma/client.js';

@Controller('sport-clubs/:clubSlug/courts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SportCourtsController {
  constructor(private readonly sportCourtsService: SportCourtsService) {}

  @Post()
  @Roles('owner', 'admin')
  async create(@CurrentClub() club: SportClub, @Body() dto: CreateCourtDto) {
    return this.sportCourtsService.create(club, dto);
  }

  @Get()
  @Roles('owner', 'admin')
  async findAll(
    @CurrentClub() club: SportClub,
    @Query() query: CourtOrderQueryDto,
  ) {
    return this.sportCourtsService.findAll(club, query.order ?? 'asc');
  }

  @Patch('reorder')
  @Roles('owner', 'admin')
  async reorder(@CurrentClub() club: SportClub, @Body() dto: ReorderCourtsDto) {
    return this.sportCourtsService.reorder(club, dto);
  }

  @Patch(':courtId')
  @Roles('owner', 'admin')
  async update(
    @CurrentClub() club: SportClub,
    @Param('courtId', ParseIntPipe) courtId: number,
    @Body() dto: UpdateCourtDto,
  ) {
    return this.sportCourtsService.update(club, courtId, dto);
  }

  @Delete(':courtId')
  @Roles('owner', 'admin')
  async remove(
    @CurrentClub() club: SportClub,
    @Param('courtId', ParseIntPipe) courtId: number,
  ) {
    return this.sportCourtsService.remove(club, courtId);
  }
}
