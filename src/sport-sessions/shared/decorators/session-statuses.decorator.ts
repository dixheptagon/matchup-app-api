import { SetMetadata } from '@nestjs/common';
import { SessionStatus } from '../../../../prisma/generated/prisma/enums.js';

export const SESSION_STATUSES_KEY = 'sessionStatuses';

export const SessionStatuses = (...statuses: SessionStatus[]) =>
  SetMetadata(SESSION_STATUSES_KEY, statuses);
