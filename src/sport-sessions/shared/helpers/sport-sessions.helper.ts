import type { ClubSettings } from '../../../../prisma/generated/prisma/client.js';
import { SessionsType } from '../../../../prisma/generated/prisma/enums.js';
import { ACTIVE_EDITABLE_SETTINGS } from '../constants/sport-sessions.constant.js';

export type SessionSettingsFields = Omit<
  ClubSettings,
  'id' | 'clubId' | 'createdAt' | 'updatedAt'
>;

export function buildSessionSettings(
  source: ClubSettings | SessionSettingsFields,
): SessionSettingsFields {
  const {
    id: _id,
    clubId: _clubId,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    ...settings
  } = source as ClubSettings;

  return settings;
}

export function buildFallbackTitle(type?: SessionsType): string {
  const label = type === SessionsType.TOURNAMENT ? 'Tournament' : 'Open Play';

  const dateStr = new Date().toLocaleDateString('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  return `${label} - ${dateStr}`;
}

export function getLockedActiveSettings(dto: object): string[] {
  return Object.entries(dto)
    .filter(([, value]) => value !== undefined)
    .map(([key]) => key)
    .filter((key) => !ACTIVE_EDITABLE_SETTINGS.includes(key));
}
