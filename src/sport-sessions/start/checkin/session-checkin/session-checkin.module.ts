import { Module } from '@nestjs/common';
import { SessionCheckinService } from './session-checkin.service.js';
import { SessionCheckinController } from './session-checkin.controller.js';

@Module({
  controllers: [SessionCheckinController],
  providers: [SessionCheckinService],
})
export class SessionCheckinModule {}
