import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
} from 'class-validator';

export class CreateMatchDto {
  @IsArray({ message: 'teamA must be an array' })
  @ArrayMinSize(2, { message: 'teamA must contain 2 players' })
  @ArrayMaxSize(2, { message: 'teamA must contain 2 players' })
  @IsInt({ each: true, message: 'Each teamA id must be an integer' })
  teamA: number[];

  @IsArray({ message: 'teamB must be an array' })
  @ArrayMinSize(2, { message: 'teamB must contain 2 players' })
  @ArrayMaxSize(2, { message: 'teamB must contain 2 players' })
  @IsInt({ each: true, message: 'Each teamB id must be an integer' })
  teamB: number[];
}