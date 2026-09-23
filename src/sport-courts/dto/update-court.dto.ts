import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { ContainsLetter } from '../../common/validators/contains-letter.validator.js';

export class UpdateCourtDto {
  @Transform(({ value }) => value?.trim())
  @IsOptional()
  @IsString({ message: 'Name must be a string' })
  @MaxLength(100, { message: 'Court name must not exceed 100 characters' })
  @ContainsLetter(3, { label: 'Court name' })
  name?: string;

  @IsOptional()
  @IsInt({ message: 'Display order must be an integer' })
  @Min(0, { message: 'Display order must be non-negative' })
  displayOrder?: number;

  @IsOptional()
  @IsBoolean({ message: 'isActive must be a boolean' })
  isActive?: boolean;
}
