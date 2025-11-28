import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { Keypair } from '@solana/web3.js';
import { AuthStrategyEnum } from '@zetik/shared-entities';
import bs58 from 'bs58';
import { Response } from 'express';
import * as nacl from 'tweetnacl';
import { createTestProviders } from '../../test-utils/common-providers';
import { SelfExclusionService } from '../../users/self-exclusion.service';
import { UsersService } from '../../users/users.service';
import { AuthService } from '../auth.service';
import { PhantomLoginOrRegisterDto } from '../dto/phantom-login-or-register.dto';
import { RefreshTokenService } from '../services/refresh-token.service';
import { TokenBlacklistService } from '../services/token-blacklist.service';

describe('AuthService - Phantom Wallet', () => {
  let service: AuthService;
  let usersService: UsersService;
  let jwtService: JwtService;

  const mockResponse = {
    cookie: jest.fn(),
    clearCookie: jest.fn(),
    req: {
      headers: {
        'user-agent': 'test-agent',
      },
    },
  } as unknown as Response;

  const mockUser = {
    id: 'test-user-id',
    username: 'testuser',
    registrationStrategy: AuthStrategyEnum.PHANTOM,
    registrationData: {
      address: '4KYpRyZW8AYoaKahb11jutXKnfLuYgfdWzSh6LL3pFms',
    },
    isBanned: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    // Set required environment variables
    process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        ...createTestProviders(),
        // Override specific mocks after createTestProviders
        {
          provide: UsersService,
          useValue: {
            findByEmail: jest.fn(),
            createWithEmail: jest.fn(),
            findByPhantomAddress: jest.fn(),
            createWithPhantom: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn(),
            verify: jest.fn(),
          },
        },
        {
          provide: RefreshTokenService,
          useValue: {
            createRefreshToken: jest.fn(),
            findTokenByValue: jest.fn(),
            revokeToken: jest.fn(),
            revokeAllUserTokens: jest.fn(),
          },
        },
        {
          provide: TokenBlacklistService,
          useValue: {
            blacklistToken: jest.fn().mockResolvedValue(true),
            isBlacklisted: jest.fn().mockResolvedValue(false),
          },
        },
        // Mock SelfExclusionService required by AuthService constructor
        {
          provide: SelfExclusionService,
          useValue: {
            getActiveSelfExclusions: jest.fn(),
            hasActiveSelfExclusion: jest.fn(),
            formatRemainingTime: jest.fn(),
          },
        },
        {
          provide: 'AUTH_CONFIG',
          useValue: {
            accessSecret: 'test-access-secret-key',
            accessExpiration: '15m',
            refreshSecret: 'test-refresh-secret-key',
            refreshExpiration: '30d',
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get<UsersService>(UsersService);
    jwtService = module.get<JwtService>(JwtService);

    jest.clearAllMocks();
  });

  describe('loginOrRegisterWithPhantom', () => {
    let keypair: Keypair;
    let publicKey: string;
    let loginOrRegisterDto: PhantomLoginOrRegisterDto;

    beforeEach(() => {
      keypair = Keypair.generate();
      publicKey = keypair.publicKey.toBase58();

      const message = 'Login to ZetikBackend';
      const messageBytes = new TextEncoder().encode(message);
      const signature = nacl.sign.detached(messageBytes, keypair.secretKey);
      const signatureBase58 = bs58.encode(signature);

      loginOrRegisterDto = {
        address: publicKey,
        signature: signatureBase58,
      };
    });

    it('should login user successfully with valid signature', async () => {
      const mockPhantomUser = {
        ...mockUser,
        registrationStrategy: AuthStrategyEnum.PHANTOM,
        registrationData: { address: publicKey },
      };
      const mockTokens = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      };

      jest.spyOn(usersService, 'findByPhantomAddress').mockResolvedValue(mockPhantomUser as any);
      jest
        .spyOn(jwtService, 'sign')
        .mockReturnValueOnce(mockTokens.accessToken)
        .mockReturnValueOnce(mockTokens.refreshToken);

      const result = await service.loginOrRegisterWithPhantom(loginOrRegisterDto, mockResponse);

      expect(usersService.findByPhantomAddress).toHaveBeenCalledWith(loginOrRegisterDto.address);
      expect(result).toHaveProperty('accessToken', mockTokens.accessToken);
      expect(result).toHaveProperty('refreshToken', mockTokens.refreshToken);
      expect(mockResponse.cookie).toHaveBeenCalledTimes(2);
    });

    it('should throw UnauthorizedException with invalid signature', async () => {
      const invalidLoginOrRegisterDto = {
        ...loginOrRegisterDto,
        signature: 'invalid-signature-string',
      };

      await expect(
        service.loginOrRegisterWithPhantom(invalidLoginOrRegisterDto, mockResponse),
      ).rejects.toThrow(UnauthorizedException);

      expect(usersService.findByPhantomAddress).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException with wrong message signature', async () => {
      // Sign different message
      const wrongMessage = 'Different login message';
      const messageBytes = new TextEncoder().encode(wrongMessage);
      const signature = nacl.sign.detached(messageBytes, keypair.secretKey);

      const wrongLoginOrRegisterDto = {
        ...loginOrRegisterDto,
        signature: bs58.encode(signature),
      };

      await expect(
        service.loginOrRegisterWithPhantom(wrongLoginOrRegisterDto, mockResponse),
      ).rejects.toThrow(UnauthorizedException);

      expect(usersService.findByPhantomAddress).not.toHaveBeenCalled();
    });

    it('should throw register new user if user not found', async () => {
      const mockPhantomUser = {
        ...mockUser,
        registrationStrategy: AuthStrategyEnum.PHANTOM,
        registrationData: { address: publicKey },
      };
      const mockTokens = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      };

      jest.spyOn(usersService, 'createWithPhantom').mockResolvedValue(mockPhantomUser as any);
      jest
        .spyOn(jwtService, 'sign')
        .mockReturnValueOnce(mockTokens.accessToken)
        .mockReturnValueOnce(mockTokens.refreshToken);

      const result = await service.loginOrRegisterWithPhantom(loginOrRegisterDto, mockResponse);

      expect(usersService.createWithPhantom).toHaveBeenCalledWith(
        loginOrRegisterDto.address,
        undefined,
      );
      expect(result).toHaveProperty('accessToken', mockTokens.accessToken);
      expect(result).toHaveProperty('refreshToken', mockTokens.refreshToken);
      expect(result).toHaveProperty('user');
      expect(mockResponse.cookie).toHaveBeenCalledTimes(2);
    });

    it('should throw UnauthorizedException if user is banned', async () => {
      const bannedPhantomUser = {
        ...mockUser,
        isBanned: true,
        registrationStrategy: AuthStrategyEnum.PHANTOM,
        registrationData: { address: publicKey },
      };

      jest.spyOn(usersService, 'findByPhantomAddress').mockResolvedValue(bannedPhantomUser as any);

      await expect(
        service.loginOrRegisterWithPhantom(loginOrRegisterDto, mockResponse),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should handle signature from different keypair', async () => {
      // Use different keypair to sign
      const anotherKeypair = Keypair.generate();
      const message = 'Login to ZetikBackend';
      const messageBytes = new TextEncoder().encode(message);
      const signature = nacl.sign.detached(messageBytes, anotherKeypair.secretKey);
      const signatureUint8 = new Uint8Array(signature);

      const wrongKeypairLoginOrRegisterDto = {
        address: publicKey, // original address
        signature: bs58.encode(signatureUint8), // signature from different keypair
      };

      await expect(
        service.loginOrRegisterWithPhantom(wrongKeypairLoginOrRegisterDto, mockResponse),
      ).rejects.toThrow(UnauthorizedException);

      expect(usersService.findByPhantomAddress).not.toHaveBeenCalled();
    });

    it('should handle ArrayBuffer signature format for backward compatibility', async () => {
      const mockPhantomUser = {
        ...mockUser,
        registrationStrategy: AuthStrategyEnum.PHANTOM,
        registrationData: { address: publicKey },
      };
      const mockTokens = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      };

      // Create signature as ArrayBuffer (old format)
      const message = 'Login to ZetikBackend';
      const messageBytes = new TextEncoder().encode(message);
      const signature = nacl.sign.detached(messageBytes, keypair.secretKey);
      const signatureArrayBuffer = signature.buffer;

      const arrayBufferLoginDto: PhantomLoginOrRegisterDto = {
        address: publicKey,
        signature: signatureArrayBuffer, // ArrayBuffer instead of string
      };

      jest.spyOn(usersService, 'findByPhantomAddress').mockResolvedValue(mockPhantomUser as any);
      jest
        .spyOn(jwtService, 'sign')
        .mockReturnValueOnce(mockTokens.accessToken)
        .mockReturnValueOnce(mockTokens.refreshToken);

      const result = await service.loginOrRegisterWithPhantom(arrayBufferLoginDto, mockResponse);

      expect(usersService.findByPhantomAddress).toHaveBeenCalledWith(arrayBufferLoginDto.address);
      expect(result).toHaveProperty('accessToken', mockTokens.accessToken);
      expect(result).toHaveProperty('refreshToken', mockTokens.refreshToken);
      expect(mockResponse.cookie).toHaveBeenCalledTimes(2);
    });
  });
});
