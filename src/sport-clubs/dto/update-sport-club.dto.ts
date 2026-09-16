import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateSportClubDto {
  @IsOptional()
  @IsString({ message: 'Name must be a string' })
  @MaxLength(100, { message: 'Club name must not exceed 100 characters' })
  name?: string;
}
