import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../config/prisma/prisma.service.js';
import { CreateSportMemberDto } from './dto/create-sport-member.dto.js';
import { UpdateSportMemberDto } from './dto/update-sport-member.dto.js';
import { SportMemberQueryDto } from './dto/sport-member-query.dto.js';
import {
  GenderType,
  RoleType,
  SkillLevel,
} from '../../prisma/generated/prisma/enums.js';
import { SportClub } from '../../prisma/generated/prisma/client.js';

const MEMBER_SELECT = {
  id: true,
  clubId: true,
  userId: true,
  displayName: true,
  role: true,
  gender: true,
  skillLevel: true,
  isGuest: true,
  joinedAt: true,
  user: {
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
    },
  },
};

@Injectable()
export class SportMembersService {
  constructor(private readonly prisma: PrismaService) {}

  private async getMemberInClub(clubId: string, memberId: string) {
    const member = await this.prisma.clubMember.findFirst({
      where: { id: memberId, clubId },
      select: MEMBER_SELECT,
    });

    if (!member) {
      throw new NotFoundException('Member not found');
    }

    return member;
  }

  async create(club: SportClub, dto: CreateSportMemberDto) {
    const duplicate = await this.prisma.clubMember.findFirst({
      where: {
        clubId: club.id,
        displayName: { equals: dto.displayName, mode: 'insensitive' },
      },
    });

    if (duplicate) {
      throw new ConflictException('Member with this name already exists');
    }

    return this.prisma.clubMember.create({
      data: {
        clubId: club.id,
        displayName: dto.displayName,
        isGuest: dto.isGuest ?? false,
        role: RoleType.MEMBER,
        ...(dto.gender !== undefined ? { gender: dto.gender } : {}),
        ...(dto.skillLevel !== undefined ? { skillLevel: dto.skillLevel } : {}),
      },
      select: MEMBER_SELECT,
    });
  }

  async findAllByClub(
    club: SportClub,
    page = 1,
    limit = 20,
    query: SportMemberQueryDto = {},
  ) {
    const where: {
      clubId: string;
      role?: RoleType;
      skillLevel?: SkillLevel;
      isGuest?: boolean;
      displayName?: { contains: string; mode: 'insensitive' };
    } = { clubId: club.id };

    if (query.role !== undefined) {
      where.role = query.role;
    }
    if (query.skillLevel !== undefined) {
      where.skillLevel = query.skillLevel;
    }
    if (query.isGuest !== undefined) {
      where.isGuest = query.isGuest;
    }
    if (query.search) {
      where.displayName = { contains: query.search, mode: 'insensitive' };
    }

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.clubMember.findMany({
        where,
        select: MEMBER_SELECT,
        orderBy: { joinedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.clubMember.count({ where }),
    ]);

    return {
      data,
      meta: { page, limit, total },
    };
  }

  async findOne(club: SportClub, memberId: string) {
    return this.getMemberInClub(club.id, memberId);
  }

  async update(
    userId: string,
    club: SportClub,
    memberId: string,
    dto: UpdateSportMemberDto,
  ) {
    const target = await this.prisma.clubMember.findFirst({
      where: { id: memberId, clubId: club.id },
    });

    if (!target) {
      throw new NotFoundException('Member not found');
    }

    if (dto.role !== undefined) {
      if (club.ownerId !== userId) {
        throw new ForbiddenException('Only the owner can change member roles');
      }
      if (dto.role === RoleType.OWNER) {
        throw new BadRequestException(
          'Ownership transfer is required to assign the OWNER role',
        );
      }
      if (target.role === RoleType.OWNER) {
        throw new ForbiddenException(
          'The club owner role cannot be changed here',
        );
      }
    }

    if (dto.displayName !== undefined) {
      const duplicate = await this.prisma.clubMember.findFirst({
        where: {
          clubId: club.id,
          displayName: { equals: dto.displayName, mode: 'insensitive' },
          id: { not: target.id },
        },
      });

      if (duplicate) {
        throw new ConflictException('Member with this name already exists');
      }
    }

    const data: {
      role?: RoleType;
      displayName?: string;
      gender?: GenderType;
      skillLevel?: SkillLevel;
    } = {};

    if (dto.role !== undefined) data.role = dto.role;
    if (dto.displayName !== undefined) data.displayName = dto.displayName;
    if (dto.gender !== undefined) data.gender = dto.gender;
    if (dto.skillLevel !== undefined) data.skillLevel = dto.skillLevel;

    return this.prisma.clubMember.update({
      where: { id: target.id },
      data,
      select: MEMBER_SELECT,
    });
  }

  async remove(userId: string, club: SportClub, memberId: string) {
    const target = await this.prisma.clubMember.findFirst({
      where: { id: memberId, clubId: club.id },
    });

    if (!target) {
      throw new NotFoundException('Member not found');
    }

    if (target.role === RoleType.OWNER) {
      throw new ForbiddenException('The club owner cannot be removed');
    }

    if (club.ownerId !== userId && target.role === RoleType.ADMIN) {
      throw new ForbiddenException('An admin cannot remove another admin');
    }

    await this.prisma.clubMember.delete({ where: { id: target.id } });

    return { message: 'Member removed successfully' };
  }
}
