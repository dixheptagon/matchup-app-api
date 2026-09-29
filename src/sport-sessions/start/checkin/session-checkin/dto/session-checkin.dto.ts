import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
} from 'class-validator';
import { PlayerStatus } from '../../../../../../prisma/generated/prisma/enums.js';

export class AdminCheckInDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  sessionPlayerIds: number[];

  @IsOptional()
  @IsEnum(PlayerStatus)
  status?: PlayerStatus = PlayerStatus.WAITING; // Default to WATING
}

// admin-update-status.dto.ts
export class AdminUpdateStatusDto {
  @IsEnum(PlayerStatus)
  status: PlayerStatus;
}
