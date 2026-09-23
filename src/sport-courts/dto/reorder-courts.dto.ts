import { IsArray, ValidateNested, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ReorderCourtItemDto {
  @IsInt({ message: 'Court ID must be an integer' })
  id: number;

  @IsInt({ message: 'Display order must be an integer' })
  @Min(0, { message: 'Display order must be non-negative' })
  displayOrder: number;
}

export class ReorderCourtsDto {
  @IsArray({ message: 'Items must be an array' })
  @ValidateNested({ each: true })
  @Type(() => ReorderCourtItemDto)
  items: ReorderCourtItemDto[];
}