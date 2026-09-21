import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ContainsLetter } from '../../common/validators/contains-letter.validator.js';

export class UpdateSportClubDto {
  @Transform(({ value }) => value?.trim())
  @IsOptional()
  @IsString({ message: 'Name must be a string' })
  @MaxLength(100, { message: 'Club name must not exceed 100 characters' })
  @ContainsLetter()
  name?: string;
}
