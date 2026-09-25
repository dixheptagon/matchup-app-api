import { Module } from '@nestjs/common';
import { ClubSettingsController } from './club-settings.controller.js';
import { ClubSettingsService } from './club-settings.service.js';
import { RolesGuard } from '../sport-members/guards/roles.guard.js';
import { JwtStrategy } from '../auth/strategies/jwt.strategy.js';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({}),
  ],
  controllers: [ClubSettingsController],
  providers: [ClubSettingsService, JwtStrategy, RolesGuard],
})
export class ClubSettingsModule {}
