import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: DataSource,
          useValue: {
            query: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
          },
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should identify the API', () => {
      expect(appController.getHello()).toBe('Meatena Butchery Operations API');
    });
  });

  describe('health', () => {
    it('should return database and KNET readiness', async () => {
      await expect(appController.getHealth()).resolves.toMatchObject({
        service: 'meatena-butchery-operations-api',
        status: 'ok',
        dependencies: {
          database: { status: 'ok' },
        },
      });
    });
  });
});
