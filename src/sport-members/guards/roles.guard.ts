import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../config/prisma/prisma.service.js';
import { RoleType } from '../../../prisma/generated/prisma/enums.js';
import { ROLES_KEY } from '../decorators/roles.decorator.js';
import { SportClub } from '../../../prisma/generated/prisma/client.js';

interface ClubScopedRequest {
  user: { id: string };
  params: { clubSlug?: string };
  club?: SportClub;
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<ClubScopedRequest>();

    if (request.params.clubSlug) {
      const club = await this.prisma.sportClub.findUnique({
        where: { slug: request.params.clubSlug },
      });

      if (!club) {
        throw new NotFoundException('Club not found');
      }

      request.club = club;
    }

    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles?.length) {
      return true;
    }

    const role = await this.resolveClubRole(request.club, request.user.id);

    if (!role || !requiredRoles.includes(role)) {
      throw new ForbiddenException('Insufficient permissions for this action');
    }

    return true;
  }

  private async resolveClubRole(
    club: SportClub | undefined,
    userId: string,
  ): Promise<string | null> {
    if (!club) {
      throw new NotFoundException('Club not found');
    }

    if (club.ownerId === userId) {
      return RoleType.OWNER;
    }

    const membership = await this.prisma.clubMember.findFirst({
      where: { clubId: club.id, userId },
      select: { role: true },
    });

    return membership?.role ?? null;
  }
}
