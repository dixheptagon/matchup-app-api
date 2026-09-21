import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { SportClubsService } from './sport-clubs.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CreateSportClubDto } from './dto/create-sport-club.dto.js';
import { UpdateSportClubDto } from './dto/update-sport-club.dto.js';
import type { Request } from 'express';

interface AuthenticatedRequest extends Request {
  user: { id: string };
}

@Controller('sport-clubs')
@UseGuards(JwtAuthGuard)
export class SportClubsController {
  constructor(private readonly sportClubsService: SportClubsService) {}

  @Post()
  async create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateSportClubDto,
  ) {
    return this.sportClubsService.create(req.user.id, dto);
  }

  @Get()
  async findAll(
    @Req() req: AuthenticatedRequest,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    return this.sportClubsService.findAllByOwner(
      req.user.id,
      pageNum,
      limitNum,
    );
  }

  @Get(':slug')
  async findOne(@Param('slug') slug: string) {
    return this.sportClubsService.findOne(slug);
  }

  @Patch(':slug')
  async update(
    @Param('slug') slug: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateSportClubDto,
  ) {
    return this.sportClubsService.update(slug, req.user.id, dto);
  }

  @Delete(':slug')
  @HttpCode(HttpStatus.OK)
  async remove(
    @Param('slug') slug: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.sportClubsService.remove(slug, req.user.id);
  }
}
