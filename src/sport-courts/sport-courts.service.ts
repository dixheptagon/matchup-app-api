import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../config/prisma/prisma.service.js';
import { CreateCourtDto } from './dto/create-court.dto.js';
import { UpdateCourtDto } from './dto/update-court.dto.js';
import { ReorderCourtsDto } from './dto/reorder-courts.dto.js';
import type { SportClub } from '../../prisma/generated/prisma/client.js';

const COURT_SELECT = {
  id: true,
  clubId: true,
  name: true,
  displayOrder: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
};

@Injectable()
export class SportCourtsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(club: SportClub, dto: CreateCourtDto) {
    const duplicate = await this.prisma.court.findUnique({
      where: { clubId_name: { clubId: club.id, name: dto.name } },
    });

    if (duplicate) {
      throw new ConflictException('Court with this name already exists in this club');
    }

    let displayOrder = dto.displayOrder;
    if (displayOrder === undefined) {
      const lastCourt = await this.prisma.court.findFirst({
        where: { clubId: club.id },
        orderBy: { displayOrder: 'desc' },
        select: { displayOrder: true },
      });
      displayOrder = (lastCourt?.displayOrder ?? -1) + 1;
    } else {
      const orderConflict = await this.prisma.court.findFirst({
        where: { clubId: club.id, displayOrder },
      });
      if (orderConflict) {
        throw new ConflictException('Display order already exists in this club');
      }
    }

    return this.prisma.court.create({
      data: {
        clubId: club.id,
        name: dto.name,
        displayOrder,
        isActive: dto.isActive ?? true,
      },
      select: COURT_SELECT,
    });
  }

  async findAll(club: SportClub, order: 'asc' | 'desc' = 'asc') {
    return this.prisma.court.findMany({
      where: { clubId: club.id },
      select: COURT_SELECT,
      orderBy: [{ displayOrder: order }, { id: 'asc' }],
    });
  }

  async update(club: SportClub, courtId: number, dto: UpdateCourtDto) {
    const court = await this.prisma.court.findFirst({
      where: { id: courtId, clubId: club.id },
    });

    if (!court) {
      throw new NotFoundException('Court not found');
    }

    if (dto.name !== undefined && dto.name !== court.name) {
      const duplicate = await this.prisma.court.findUnique({
        where: { clubId_name: { clubId: club.id, name: dto.name } },
      });

      if (duplicate) {
        throw new ConflictException('Court with this name already exists in this club');
      }
    }

    if (dto.displayOrder !== undefined && dto.displayOrder !== court.displayOrder) {
      const orderConflict = await this.prisma.court.findFirst({
        where: { clubId: club.id, displayOrder: dto.displayOrder, id: { not: courtId } },
      });

      if (orderConflict) {
        throw new ConflictException('Display order already exists in this club');
      }
    }

    const data: { name?: string; displayOrder?: number; isActive?: boolean } = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.displayOrder !== undefined) data.displayOrder = dto.displayOrder;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    return this.prisma.court.update({
      where: { id: courtId },
      data,
      select: COURT_SELECT,
    });
  }

  async remove(club: SportClub, courtId: number) {
    const court = await this.prisma.court.findFirst({
      where: { id: courtId, clubId: club.id },
    });

    if (!court) {
      throw new NotFoundException('Court not found');
    }

    const sessionCourts = await this.prisma.sessionCourt.count({
      where: { courtId },
    });

    if (sessionCourts > 0) {
      throw new BadRequestException('Cannot delete court that is used in sessions');
    }

    await this.prisma.court.delete({ where: { id: courtId } });

    return { message: 'Court deleted successfully' };
  }

  async reorder(club: SportClub, dto: ReorderCourtsDto) {
    const courtIds = dto.items.map((item) => item.id);

    const courts = await this.prisma.court.findMany({
      where: { id: { in: courtIds }, clubId: club.id },
      select: { id: true },
    });

    if (courts.length !== courtIds.length) {
      throw new BadRequestException('One or more courts not found in this club');
    }

    const newOrders = dto.items.map((item) => item.displayOrder);
    const uniqueNewOrders = new Set(newOrders);
    if (uniqueNewOrders.size !== newOrders.length) {
      throw new BadRequestException('Display orders must be unique in reorder request');
    }

    const otherCourts = await this.prisma.court.findMany({
      where: { clubId: club.id, id: { notIn: courtIds } },
      select: { displayOrder: true },
    });

    const existingOrders = new Set(otherCourts.map((c) => c.displayOrder).filter((o) => o !== null));
    for (const order of newOrders) {
      if (existingOrders.has(order)) {
        throw new ConflictException(`Display order ${order} already exists in this club`);
      }
    }

    await this.prisma.$transaction(
      dto.items.map((item) =>
        this.prisma.court.update({
          where: { id: item.id },
          data: { displayOrder: item.displayOrder },
        }),
      ),
    );

    return this.prisma.court.findMany({
      where: { clubId: club.id },
      select: COURT_SELECT,
      orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
    });
  }
}