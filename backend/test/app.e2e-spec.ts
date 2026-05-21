import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Meatena Butchery Operations API');
  });

  it('/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          status: expect.any(String),
          service: 'meatena-butchery-operations-api',
          timestamp: expect.any(String),
          uptimeSeconds: expect.any(Number),
          dependencies: {
            database: {
              status: 'ok',
            },
            knet: {
              status: expect.any(String),
              missing: expect.any(Array),
            },
          },
        });
      });
  });

  afterEach(async () => {
    await app?.close();
  });
});
