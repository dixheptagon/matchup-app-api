import {
  Controller,
  Patch,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import type { Request } from 'express';

interface AuthenticatedRequest extends Request {
  user: { id: number };
}

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Patch('me')
  async updateProfile(
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(req.user.id, dto);
  }
}
