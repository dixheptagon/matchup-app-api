import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../config/prisma/prisma.service.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { User } from '../../prisma/generated/prisma/client.js';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

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

    if (dto.username !== undefined) {
      if (dto.username === user.username) {
        throw new BadRequestException(
          'New username must be different from current username',
        );
      }

      const existing = await this.prisma.user.findFirst({
        where: { username: dto.username },
      });

      if (existing) {
        throw new ConflictException('Username already taken');
      }
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.username !== undefined && { username: dto.username }),
        ...(dto.gender !== undefined && { gender: dto.gender }),
      },
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

    return updated;
  }
}
