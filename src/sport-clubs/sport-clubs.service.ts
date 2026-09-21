import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../config/prisma/prisma.service.js';
import { CreateSportClubDto } from './dto/create-sport-club.dto.js';
import { UpdateSportClubDto } from './dto/update-sport-club.dto.js';

const MAX_CLUBS_PER_OWNER = 3;

@Injectable()
export class SportClubsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: number, dto: CreateSportClubDto) {
    const owner = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!owner || owner.deletedAt) {
      throw new NotFoundException('Owner not found');
    }

    const clubCount = await this.prisma.sportClub.count({
      where: { ownerId: userId },
    });
    if (clubCount >= MAX_CLUBS_PER_OWNER) {
      throw new ConflictException('Maximum 3 clubs per owner allowed');
    }

    const existing = await this.prisma.sportClub.findFirst({
      where: { name: { equals: dto.name, mode: 'insensitive' } },
    });
    if (existing) {
      throw new ConflictException('Club name already exists');
    }

    return this.prisma.sportClub.create({
      data: {
        name: dto.name,
        ownerId: userId,
      },
      select: {
        id: true,
        name: true,
        ownerId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async findAllByOwner(userId: number, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.sportClub.findMany({
        where: { ownerId: userId },
        select: {
          id: true,
          name: true,
          ownerId: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              members: true,
              sessions: true,
              courts: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.sportClub.count({ where: { ownerId: userId } }),
    ]);

    return {
      data,
      meta: { page, limit, total },
    };
  }

  async findOne(clubId: number) {
    const club = await this.prisma.sportClub.findUnique({
      where: { id: clubId },
      select: {
        id: true,
        name: true,
        ownerId: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            members: true,
            sessions: true,
            courts: true,
          },
        },
      },
    });

    if (!club) {
      throw new NotFoundException('Club not found');
    }

    return club;
  }

  async update(clubId: number, userId: number, dto: UpdateSportClubDto) {
    const club = await this.prisma.sportClub.findUnique({
      where: { id: clubId },
    });

    if (!club) {
      throw new NotFoundException('Club not found');
    }

    if (club.ownerId !== userId) {
      throw new ForbiddenException('Only the owner can modify this club');
    }

    if (dto.name !== undefined) {
      const trimmedName = dto.name.trim();

      if (trimmedName === club.name) {
        throw new BadRequestException(
          'New name must be different from current name',
        );
      }

      const existing = await this.prisma.sportClub.findFirst({
        where: {
          name: { equals: trimmedName, mode: 'insensitive' },
          id: { not: clubId },
        },
      });

      if (existing) {
        throw new ConflictException('Club name already exists');
      }

      dto.name = trimmedName;
    }

    return this.prisma.sportClub.update({
      where: { id: clubId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
      },
      select: {
        id: true,
        name: true,
        ownerId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async remove(clubId: number, userId: number) {
    const club = await this.prisma.sportClub.findUnique({
      where: { id: clubId },
    });

    if (!club) {
      throw new NotFoundException('Club not found');
    }

    if (club.ownerId !== userId) {
      throw new ForbiddenException('Only the owner can delete this club');
    }

    await this.prisma.sportClub.delete({ where: { id: clubId } });

    return { message: 'Club deleted successfully' };
  }
}
