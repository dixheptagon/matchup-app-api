import { PriorityLevel } from '../../prisma/generated/prisma/enums.js';

/**
 * Matchmaking presets are write-time templates: selecting one expands into the
 * underlying priority settings. They are never persisted or returned.
 */
export enum MatchmakingPreset {
  BALANCED = 'BALANCED',
  RANDOM = 'RANDOM',
  SKILL_BASED = 'SKILL_BASED',
}

export interface MatchmakingPresetValues {
  equalPlayPriority: PriorityLevel;
  prioritizeWaitingPlayers: PriorityLevel;
  balancedTeams: PriorityLevel;
  skillBandPriority: PriorityLevel;
  partnerVariety: PriorityLevel;
  opponentVariety: PriorityLevel;
}

export const MATCHMAKING_PRESETS: Record<
  MatchmakingPreset,
  MatchmakingPresetValues
> = {
  [MatchmakingPreset.BALANCED]: {
    equalPlayPriority: PriorityLevel.MEDIUM,
    prioritizeWaitingPlayers: PriorityLevel.HIGH,
    balancedTeams: PriorityLevel.HIGH,
    skillBandPriority: PriorityLevel.LOW,
    partnerVariety: PriorityLevel.MEDIUM,
    opponentVariety: PriorityLevel.MEDIUM,
  },
  [MatchmakingPreset.RANDOM]: {
    equalPlayPriority: PriorityLevel.MAX,
    prioritizeWaitingPlayers: PriorityLevel.MAX,
    balancedTeams: PriorityLevel.LOW,
    skillBandPriority: PriorityLevel.LOW,
    partnerVariety: PriorityLevel.LOW,
    opponentVariety: PriorityLevel.LOW,
  },
  [MatchmakingPreset.SKILL_BASED]: {
    equalPlayPriority: PriorityLevel.MEDIUM,
    prioritizeWaitingPlayers: PriorityLevel.MEDIUM,
    balancedTeams: PriorityLevel.HIGH,
    skillBandPriority: PriorityLevel.MAX,
    partnerVariety: PriorityLevel.LOW,
    opponentVariety: PriorityLevel.LOW,
  },
};

/**
 * Merge a preset into a settings payload: preset values fill in any field the
 * caller did not set explicitly, and the preset key itself is stripped so the
 * result can be written straight to Prisma.
 */
export function expandMatchmakingPreset<
  T extends { preset?: MatchmakingPreset },
>(
  dto: T,
): Omit<T, 'preset'> & Partial<MatchmakingPresetValues> {
  const { preset, ...rest } = dto;

  if (!preset) return rest as Omit<T, 'preset'> & Partial<MatchmakingPresetValues>;

  const explicit = Object.fromEntries(
    Object.entries(rest).filter(([, value]) => value !== undefined),
  );

  return {
    ...MATCHMAKING_PRESETS[preset],
    ...explicit,
  } as Omit<T, 'preset'> & Partial<MatchmakingPresetValues>;
}
