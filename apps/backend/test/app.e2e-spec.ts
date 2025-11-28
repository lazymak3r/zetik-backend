import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { GlobalExceptionFilter } from '../src/common/filters/http-exception.filter';

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Apply the same configuration as in main.ts
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: false,
        transform: true,
        forbidNonWhitelisted: false,
      }),
    );
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.setGlobalPrefix('v1');
    app.enableCors();

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Health Check', () => {
    it('/v1/health (GET) should return OK', () => {
      return request(app.getHttpServer()).get('/v1/health').expect(200).expect({ status: 'ok' });
    });
  });

  describe('API Version', () => {
    it('/v1 (GET) should return API version info', () => {
      return request(app.getHttpServer())
        .get('/v1')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('name');
          expect(res.body).toHaveProperty('version');
          expect(res.body.name).toBe('Zetik Casino API');
        });
    });
  });

  describe('Invalid Routes', () => {
    it('should return 404 for invalid routes', () => {
      return request(app.getHttpServer())
        .get('/v1/invalid-route')
        .expect(404)
        .expect((res) => {
          expect(res.body).toHaveProperty('statusCode', 404);
          expect(res.body).toHaveProperty('message');
          expect(res.body.message).toHaveProperty('error', 'Not Found');
        });
    });
  });

  describe('CORS', () => {
    it('should have CORS enabled', () => {
      return request(app.getHttpServer())
        .get('/v1/health')
        .expect(200)
        .expect((res) => {
          expect(res.headers).toHaveProperty('access-control-allow-origin');
        });
    });
  });
});
