import { Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsInt } from 'class-validator';

export class SetSessionCourtsDto {
  @IsArray({ message: 'courtIds must be an array' })
  @ArrayNotEmpty({ message: 'courtIds must not be empty' })
  @IsInt({ each: true, message: 'Each courtId must be an integer' })
  @Type(() => Number)
  courtIds: number[];
}
