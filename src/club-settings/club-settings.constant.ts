import {
  SportType,
  LateJoinerPolicy,
  ScoringType,
  MatchMakingType,
  PriorityLevel,
  GenderPreferenceType,
} from '../../prisma/generated/prisma/enums.js';

export const DEFAULT_CLUB_SETTINGS = {
  // GENERAL
  defaultSport: SportType.BADMINTON,
  trackMatchScore: true,
  allowEndWithoutScore: false,
  attendanceCheckIn: true,
  lateJoinerPolicy: LateJoinerPolicy.EQUAL_PLAY_CATCHUP,
  leaderBoardMode: ScoringType.OFF,
  queueDepth: 10,

  // MATCHMAKING
  autoMatchMaking: true,
  matchMakingMode: MatchMakingType.BALANCED,
  equalPlayPriority: PriorityLevel.MEDIUM,
  balancedTeams: PriorityLevel.HIGH,
  partnerVariety: PriorityLevel.MEDIUM,
  opponentVariety: PriorityLevel.MEDIUM,
  prioritizeWaitingPlayers: PriorityLevel.HIGH,
  minimumRestTime: 5,

  carryBalance: PriorityLevel.LOW,
  carryEvaluation: PriorityLevel.LOW,
  genderPreference: GenderPreferenceType.OFF,
  fairnessThreshold: 10,
} as const;

export type DefaultClubSettings = typeof DEFAULT_CLUB_SETTINGS;