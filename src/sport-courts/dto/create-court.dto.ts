import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { ContainsLetter } from '../../common/validators/contains-letter.validator.js';

export class CreateCourtDto {
  @Transform(({ value }) => value?.trim())
  @IsString({ message: 'Name must be a string' })
  @IsNotEmpty({ message: 'Court name is required' })
  @MaxLength(100, { message: 'Court name must not exceed 100 characters' })
  @ContainsLetter(3, { label: 'Court name' })
  name: string;

  @IsOptional()
  @IsInt({ message: 'Display order must be an integer' })
  @Min(0, { message: 'Display order must be non-negative' })
  displayOrder?: number;

  @IsOptional()
  @IsBoolean({ message: 'isActive must be a boolean' })
  isActive?: boolean;
}
