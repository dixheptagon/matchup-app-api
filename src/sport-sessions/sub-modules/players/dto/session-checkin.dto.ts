import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
} from 'class-validator';
import { PlayerStatus } from '../../../../../prisma/generated/prisma/enums.js';

export class GetCheckInStatusDto {
  @IsOptional()
  @IsEnum(PlayerStatus)
  status?: PlayerStatus = PlayerStatus.NOT_ARRIVED;
}

export class CheckInMultiplePlayersDto {
  @IsArray({ message: 'sessionPlayerIds must be an array' })
  @ArrayNotEmpty({ message: 'sessionPlayerIds must not be empty' })
  @IsInt({ each: true, message: 'Each sessionPlayerId must be an integer' })
  sessionPlayerIds: number[];
}
