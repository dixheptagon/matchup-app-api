import { IsIn, IsOptional } from 'class-validator';

export class CourtOrderQueryDto {
  @IsOptional()
  @IsIn(['asc', 'desc'], { message: 'Order must be either asc or desc' })
  order?: 'asc' | 'desc' = 'asc';
}
