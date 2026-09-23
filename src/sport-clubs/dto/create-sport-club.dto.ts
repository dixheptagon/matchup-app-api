import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ContainsLetter } from '../../common/validators/contains-letter.validator.js';

export class CreateSportClubDto {
  @Transform(({ value }) => value?.trim())
  @IsString({ message: 'Name must be a string' })
  @IsNotEmpty({ message: 'Club name is required' })
  @MaxLength(100, { message: 'Club name must not exceed 100 characters' })
  @ContainsLetter(3, { label: 'Club name' })
  name: string;
}
