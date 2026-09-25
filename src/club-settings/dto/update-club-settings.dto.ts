import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import {
  GenderPreferenceType,
  LateJoinerPolicy,
  MatchMakingType,
  PriorityLevel,
  ScoringType,
  SportType,
} from '../../../prisma/generated/prisma/enums.js';

const isDefined = (_: unknown, value: unknown) => value !== undefined;

export class UpdateClubSettingsDto {
  // ─── GENERAL ───────────────────────────────────────────
  @ValidateIf(isDefined)
  @IsEnum(SportType, { message: 'defaultSport is invalid' })
  defaultSport?: SportType;

  @ValidateIf(isDefined)
  @IsBoolean({ message: 'trackMatchScore must be a boolean' })
  trackMatchScore?: boolean;

  @ValidateIf(isDefined)
  @IsBoolean({ message: 'allowEndWithoutScore must be a boolean' })
  allowEndWithoutScore?: boolean;

  @ValidateIf(isDefined)
  @IsBoolean({ message: 'attendanceCheckIn must be a boolean' })
  attendanceCheckIn?: boolean;

  @IsOptional()
  @IsEnum(LateJoinerPolicy, { message: 'lateJoinerPolicy is invalid' })
  lateJoinerPolicy?: LateJoinerPolicy | null;

  @ValidateIf(isDefined)
  @IsEnum(ScoringType, { message: 'leaderBoardMode is invalid' })
  leaderBoardMode?: ScoringType;

  @IsOptional()
  @IsInt({ message: 'queueDepth must be an integer' })
  @Min(1, { message: 'queueDepth must be at least 1' })
  @Max(100, { message: 'queueDepth must not exceed 100' })
  queueDepth?: number | null;

  // ─── MATCHMAKING ───────────────────────────────────────
  @ValidateIf(isDefined)
  @IsBoolean({ message: 'autoMatchMaking must be a boolean' })
  autoMatchMaking?: boolean;

  @ValidateIf(isDefined)
  @IsEnum(MatchMakingType, { message: 'matchMakingMode is invalid' })
  matchMakingMode?: MatchMakingType;

  @ValidateIf(isDefined)
  @IsEnum(PriorityLevel, { message: 'equalPlayPriority is invalid' })
  equalPlayPriority?: PriorityLevel;

  @ValidateIf(isDefined)
  @IsEnum(PriorityLevel, { message: 'balancedTeams is invalid' })
  balancedTeams?: PriorityLevel;

  @ValidateIf(isDefined)
  @IsEnum(PriorityLevel, { message: 'partnerVariety is invalid' })
  partnerVariety?: PriorityLevel;

  @ValidateIf(isDefined)
  @IsEnum(PriorityLevel, { message: 'opponentVariety is invalid' })
  opponentVariety?: PriorityLevel;

  @ValidateIf(isDefined)
  @IsEnum(PriorityLevel, { message: 'prioritizeWaitingPlayers is invalid' })
  prioritizeWaitingPlayers?: PriorityLevel;

  @IsOptional()
  @IsInt({ message: 'minimumRestTime must be an integer' })
  @Min(0, { message: 'minimumRestTime must be at least 0' })
  @Max(120, { message: 'minimumRestTime must not exceed 120' })
  minimumRestTime?: number | null;

  @ValidateIf(isDefined)
  @IsEnum(PriorityLevel, { message: 'carryBalance is invalid' })
  carryBalance?: PriorityLevel;

  @ValidateIf(isDefined)
  @IsEnum(PriorityLevel, { message: 'carryEvaluation is invalid' })
  carryEvaluation?: PriorityLevel;

  @IsOptional()
  @IsEnum(GenderPreferenceType, { message: 'genderPreference is invalid' })
  genderPreference?: GenderPreferenceType | null;

  @IsOptional()
  @IsInt({ message: 'fairnessThreshold must be an integer' })
  @Min(0, { message: 'fairnessThreshold must be at least 0' })
  @Max(100, { message: 'fairnessThreshold must not exceed 100' })
  fairnessThreshold?: number | null;
}
