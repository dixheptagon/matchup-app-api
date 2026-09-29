import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { SessionCheckinService } from './session-checkin.service.js';
import { SessionCheckinController } from './session-checkin.controller.js';
import { SessionGuard } from '../../draft/guards/session.guard.js';
import { RolesGuard } from '../../../sport-members/guards/roles.guard.js';
import { JwtStrategy } from '../../../auth/strategies/jwt.strategy.js';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({}),
  ],
  controllers: [SessionCheckinController],
  providers: [SessionCheckinService, SessionGuard, RolesGuard, JwtStrategy],
})
export class SessionCheckinModule {}
