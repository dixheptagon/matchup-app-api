import { SetMetadata } from '@nestjs/common';
import { RoleType } from '../../../prisma/generated/prisma/enums.js';

export const ROLES_KEY = 'roles';

export const Roles = (...roles: (RoleType | string)[]) =>
  SetMetadata(
    ROLES_KEY,
    roles.map((role) => String(role).toUpperCase()),
  );
