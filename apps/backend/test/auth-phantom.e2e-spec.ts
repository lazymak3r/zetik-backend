import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import request from 'supertest';
import * as nacl from 'tweetnacl';

import { AppModule } from '../src/app.module';

describe('Auth Phantom (e2e)', () => {
  let app: INestApplication;
  let keypair: Keypair;
  let publicKey: string;

  beforeAll(async () => {
    keypair = Keypair.generate();
    publicKey = keypair.publicKey.toBase58();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('v1');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /v1/auth/login-or-register/phantom', () => {
    it('should register with valid phantom signature', async () => {
      const message = 'Login to ZetikBackend';
      const messageBytes = new TextEncoder().encode(message);
      const signature = nacl.sign.detached(messageBytes, keypair.secretKey);
      const signatureBase58 = bs58.encode(signature);

      const res = await request(app.getHttpServer())
        .post('/v1/auth/login-or-register/phantom')
        .send({
          address: publicKey,
          signature: signatureBase58,
        })
        .expect(200);

      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
      expect(res.body.user.username).toBeDefined();
      expect(typeof res.body.user.username).toBe('string');
    });

    it('should reject invalid signature', async () => {
      await request(app.getHttpServer())
        .post('/v1/auth/login-or-register/phantom')
        .send({
          address: publicKey,
          signature: 'invalid-signature',
        })
        .expect(401);
    });
  });

  describe('POST /v1/auth/login-or-register/phantom (login)', () => {
    it('should login with valid phantom signature', async () => {
      const message = 'Login to ZetikBackend';
      const messageBytes = new TextEncoder().encode(message);
      const signature = nacl.sign.detached(messageBytes, keypair.secretKey);
      const signatureBase58 = bs58.encode(signature);

      const res = await request(app.getHttpServer())
        .post('/v1/auth/login-or-register/phantom')
        .send({
          address: publicKey,
          signature: signatureBase58,
        })
        .expect(200);

      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
    });

    it('should reject invalid login signature', async () => {
      await request(app.getHttpServer())
        .post('/v1/auth/login-or-register/phantom')
        .send({
          address: publicKey,
          signature: 'invalid-signature',
        })
        .expect(401);
    });
  });
});
