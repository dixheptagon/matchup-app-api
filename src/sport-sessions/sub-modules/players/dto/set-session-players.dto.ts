import { ArrayNotEmpty, IsArray, IsUUID } from 'class-validator';

export class SetSessionPlayersDto {
  @IsArray({ message: 'clubMemberIds must be an array' })
  @ArrayNotEmpty({ message: 'clubMemberIds must not be empty' })
  @IsUUID('4', { each: true, message: 'Each clubMemberId must be a UUID' })
  clubMemberIds: string[];
}
