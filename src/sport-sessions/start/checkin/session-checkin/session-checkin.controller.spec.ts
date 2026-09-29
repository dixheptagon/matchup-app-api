import { Test, TestingModule } from '@nestjs/testing';
import { SessionCheckinController } from './session-checkin.controller.js';
import { SessionCheckinService } from './session-checkin.service.js';

describe('SessionCheckinController', () => {
  let controller: SessionCheckinController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SessionCheckinController],
      providers: [SessionCheckinService],
    }).compile();

    controller = module.get<SessionCheckinController>(SessionCheckinController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
