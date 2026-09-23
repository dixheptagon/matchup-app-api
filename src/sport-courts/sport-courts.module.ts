import { Module } from '@nestjs/common';
import { SportCourtsController } from './sport-courts.controller.js';
import { SportCourtsService } from './sport-courts.service.js';
import { JwtStrategy } from '../auth/strategies/jwt.strategy.js';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({}),
  ],
  controllers: [SportCourtsController],
  providers: [SportCourtsService, JwtStrategy],
})
export class SportCourtsModule {}