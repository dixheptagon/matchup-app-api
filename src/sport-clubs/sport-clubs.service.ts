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
import { generateUniqueSlug } from '../common/utils/generate-slug.js';

const MAX_CLUBS_PER_OWNER = 3;

@Injectable()
export class SportClubsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateSportClubDto) {
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

    const slug = await generateUniqueSlug(dto.name, this.prisma, 'sportClub');

    return this.prisma.sportClub.create({
      data: {
        name: dto.name,
        slug,
        ownerId: userId,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        ownerId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async findAllByOwner(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.sportClub.findMany({
        where: { ownerId: userId },
        select: {
          id: true,
          name: true,
          slug: true,
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

  async findOne(clubId: string) {
    const club = await this.prisma.sportClub.findUnique({
      where: { id: clubId },
      select: {
        id: true,
        name: true,
        slug: true,
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

  async update(clubId: string, userId: string, dto: UpdateSportClubDto) {
    const club = await this.prisma.sportClub.findUnique({
      where: { id: clubId },
    });

    if (!club) {
      throw new NotFoundException('Club not found');
    }

    if (club.ownerId !== userId) {
      throw new ForbiddenException('Only the owner can modify this club');
    }

    let updateData: Partial<{ name: string; slug: string }> = {};

    if (dto.name !== undefined) {
      if (dto.name === club.name) {
        throw new BadRequestException(
          'New name must be different from current name',
        );
      }

      const existing = await this.prisma.sportClub.findFirst({
        where: {
          name: { equals: dto.name, mode: 'insensitive' },
          id: { not: clubId },
        },
      });

      if (existing) {
        throw new ConflictException('Club name already exists');
      }

      const slug = await generateUniqueSlug(dto.name, this.prisma, 'sportClub');

      updateData = { name: dto.name, slug };
    }

    return this.prisma.sportClub.update({
      where: { id: clubId },
      data: updateData,
      select: {
        id: true,
        name: true,
        slug: true,
        ownerId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async remove(clubId: string, userId: string) {
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
