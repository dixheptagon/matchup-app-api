import {
  Injectable,
  HttpException,
  HttpStatus,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../config/prisma/prisma.service.js';
import { EnvConfigService } from '../config/env/env.service.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { User } from '../../prisma/generated/prisma/client.js';
import { GenderType } from '../../prisma/generated/prisma/enums.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly env: EnvConfigService,
  ) {}

  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<
    Pick<
      User,
      | 'id'
      | 'name'
      | 'username'
      | 'email'
      | 'gender'
      | 'isVerified'
      | 'createdAt'
    >
  > {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user || user.deletedAt) {
      throw new NotFoundException('User not found');
    }

    const data: {
      name?: string;
      username?: string;
      gender?: GenderType;
      usernameChangedAt?: Date;
    } = {};

    if (dto.name !== undefined) {
      data.name = dto.name;
    }

    if (dto.gender !== undefined) {
      data.gender = dto.gender;
    }

    if (dto.username !== undefined) {
      const username = dto.username.trim().toLowerCase();

      if (username === user.username) {
        throw new BadRequestException(
          'New username must be different from current username',
        );
      }

      const existing = await this.prisma.user.findUnique({
        where: { username },
      });

      if (existing && existing.id !== userId) {
        throw new ConflictException('Username already taken');
      }

      const cooldownDays = this.env.get('USERNAME_CHANGE_COOLDOWN_DAYS');
      if (cooldownDays > 0 && user.usernameChangedAt) {
        const nextAllowedAt = new Date(
          user.usernameChangedAt.getTime() + cooldownDays * MS_PER_DAY,
        );

        if (Date.now() < nextAllowedAt.getTime()) {
          throw new HttpException(
            `Username can only be changed once every ${cooldownDays} days. Next change allowed on ${nextAllowedAt.toISOString()}`,
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }
      }

      data.username = username;
      data.usernameChangedAt = new Date();
    }

    return this.prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        gender: true,
        isVerified: true,
        createdAt: true,
      },
    });
  }
}
