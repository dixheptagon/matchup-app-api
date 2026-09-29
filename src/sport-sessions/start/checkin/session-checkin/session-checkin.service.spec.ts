import { Test, TestingModule } from '@nestjs/testing';
import { SessionCheckinService } from './session-checkin.service.js';

describe('SessionCheckinService', () => {
  let service: SessionCheckinService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SessionCheckinService],
    }).compile();

    service = module.get<SessionCheckinService>(SessionCheckinService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
