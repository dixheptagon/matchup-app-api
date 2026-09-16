import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { SportClubsService } from './sport-clubs.service.js';
import { SportClubsController } from './sport-clubs.controller.js';
import { JwtStrategy } from '../auth/strategies/jwt.strategy.js';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({}),
  ],
  controllers: [SportClubsController],
  providers: [SportClubsService, JwtStrategy],
})
export class SportClubsModule {}
