import { Module } from '@nestjs/common';
import { SportMembersController } from './sport-members.controller.js';
import { SportMembersService } from './sport-members.service.js';
import { RolesGuard } from './guards/roles.guard.js';
import { JwtStrategy } from '../auth/strategies/jwt.strategy.js';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({}),
  ],
  controllers: [SportMembersController],
  providers: [SportMembersService, JwtStrategy, RolesGuard],
})
export class SportMembersModule {}
