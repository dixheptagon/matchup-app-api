import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateSportClubDto {
  @IsString({ message: 'Name must be a string' })
  @IsNotEmpty({ message: 'Club name is required' })
  @MaxLength(100, { message: 'Club name must not exceed 100 characters' })
  name: string;
}
