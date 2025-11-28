import { CallHandler, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PlatformTypeEnum, SelfExclusionTypeEnum, UserEntity } from '@zetik/shared-entities';
import { Request } from 'express';
import { of } from 'rxjs';
import { SelfExclusionService } from '../../users/self-exclusion.service';
import { SelfExclusionInterceptor } from './self-exclusion.interceptor';

describe('SelfExclusionInterceptor', () => {
  let interceptor: SelfExclusionInterceptor;
  let selfExclusionService: jest.Mocked<SelfExclusionService>;
  let executionContext: jest.Mocked<ExecutionContext>;
  let callHandler: jest.Mocked<CallHandler>;
  let httpContext: any;
  let request: Partial<Request>;

  beforeEach(async () => {
    // Create mocks
    const mockSelfExclusionService = {
      getActiveSelfExclusions: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SelfExclusionInterceptor,
        {
          provide: SelfExclusionService,
          useValue: mockSelfExclusionService,
        },
      ],
    }).compile();

    interceptor = module.get<SelfExclusionInterceptor>(SelfExclusionInterceptor);
    selfExclusionService = module.get(SelfExclusionService);

    // Setup request mock
    request = {
      method: 'POST',
      url: '/v1/games/blackjack/start',
    };

    // Setup HTTP context mock
    httpContext = {
      getRequest: jest.fn().mockReturnValue(request),
    };

    // Setup execution context mock
    executionContext = {
      switchToHttp: jest.fn().mockReturnValue(httpContext),
    } as any;

    // Setup call handler mock
    callHandler = {
      handle: jest.fn().mockReturnValue(of('test response')),
    } as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('intercept', () => {
    it('should allow requests without authenticated user', async () => {
      // Arrange
      (request as any).user = undefined;

      // Act
      const result = await interceptor.intercept(executionContext, callHandler);

      // Assert
      expect(callHandler.handle).toHaveBeenCalled();
      expect(selfExclusionService.getActiveSelfExclusions).not.toHaveBeenCalled();
      const resultValue = await result.toPromise();
      expect(resultValue).toBe('test response');
    });

    it('should allow non-betting endpoints', async () => {
      // Arrange
      const user: Partial<UserEntity> = { id: 'user-id-1' };
      (request as any).user = user;
      request.url = '/v1/users/profile';
      request.method = 'GET';

      // Act
      const result = await interceptor.intercept(executionContext, callHandler);

      // Assert
      expect(callHandler.handle).toHaveBeenCalled();
      expect(selfExclusionService.getActiveSelfExclusions).not.toHaveBeenCalled();
      const resultValue = await result.toPromise();
      expect(resultValue).toBe('test response');
    });

    it('should allow betting endpoints when user has no active exclusions', async () => {
      // Arrange
      const user: Partial<UserEntity> = { id: 'user-id-1' };
      (request as any).user = user;
      selfExclusionService.getActiveSelfExclusions.mockResolvedValue([]);

      // Act
      const result = await interceptor.intercept(executionContext, callHandler);

      // Assert
      expect(selfExclusionService.getActiveSelfExclusions).toHaveBeenCalledWith(
        'user-id-1',
        PlatformTypeEnum.CASINO,
      );
      expect(callHandler.handle).toHaveBeenCalled();
      const resultValue = await result.toPromise();
      expect(resultValue).toBe('test response');
    });

    it('should block betting when user has active casino exclusion', async () => {
      // Arrange
      const user: Partial<UserEntity> = { id: 'user-id-1' };
      (request as any).user = user;
      const endDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now
      selfExclusionService.getActiveSelfExclusions.mockResolvedValue([
        {
          id: 'exclusion-1',
          type: SelfExclusionTypeEnum.TEMPORARY,
          platformType: PlatformTypeEnum.CASINO,
          endDate,
          isActive: true,
          userId: 'user-id-1',
          startDate: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any,
      ]);

      // Act & Assert
      await expect(interceptor.intercept(executionContext, callHandler)).rejects.toThrow(
        ForbiddenException,
      );
      expect(selfExclusionService.getActiveSelfExclusions).toHaveBeenCalledWith(
        'user-id-1',
        PlatformTypeEnum.CASINO,
      );
      expect(callHandler.handle).not.toHaveBeenCalled();
    });

    it('should block betting when user has active platform-wide exclusion', async () => {
      // Arrange
      const user: Partial<UserEntity> = { id: 'user-id-1' };
      (request as any).user = user;
      const endDate = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours from now
      selfExclusionService.getActiveSelfExclusions.mockResolvedValue([
        {
          id: 'exclusion-1',
          type: SelfExclusionTypeEnum.TEMPORARY,
          platformType: PlatformTypeEnum.PLATFORM,
          endDate,
          isActive: true,
          userId: 'user-id-1',
          startDate: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any,
      ]);

      // Act & Assert
      await expect(interceptor.intercept(executionContext, callHandler)).rejects.toThrow(
        ForbiddenException,
      );
      expect(selfExclusionService.getActiveSelfExclusions).toHaveBeenCalledWith(
        'user-id-1',
        PlatformTypeEnum.CASINO,
      );
      expect(callHandler.handle).not.toHaveBeenCalled();
    });

    it('should prefer platform-wide exclusion over casino exclusion', async () => {
      // Arrange
      const user: Partial<UserEntity> = { id: 'user-id-1' };
      (request as any).user = user;
      const endDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
      selfExclusionService.getActiveSelfExclusions.mockResolvedValue([
        {
          id: 'casino-exclusion',
          type: SelfExclusionTypeEnum.TEMPORARY,
          platformType: PlatformTypeEnum.CASINO,
          endDate,
          isActive: true,
          userId: 'user-id-1',
          startDate: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any,
        {
          id: 'platform-exclusion',
          type: SelfExclusionTypeEnum.TEMPORARY,
          platformType: PlatformTypeEnum.PLATFORM,
          endDate,
          isActive: true,
          userId: 'user-id-1',
          startDate: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any,
      ]);

      // Act & Assert
      await expect(interceptor.intercept(executionContext, callHandler)).rejects.toThrow(
        ForbiddenException,
      );
      expect(callHandler.handle).not.toHaveBeenCalled();
    });

    describe('betting endpoint detection', () => {
      const testCases = [
        { url: '/v1/games/blackjack/start', method: 'POST', shouldBlock: true },
        { url: '/v1/games/dice/bet', method: 'POST', shouldBlock: true },
        { url: '/v1/games/roulette/place-bet', method: 'POST', shouldBlock: true },
        { url: '/v1/games/crash/play', method: 'POST', shouldBlock: true },
        { url: '/v1/games/mines/start', method: 'POST', shouldBlock: true },
        { url: '/v1/provider-games/pragmatic/start', method: 'POST', shouldBlock: true },
        { url: '/v1/games/blackjack/history', method: 'GET', shouldBlock: false },
        { url: '/v1/games/dice/config', method: 'GET', shouldBlock: false },
        { url: '/v1/users/profile', method: 'PATCH', shouldBlock: false },
        { url: '/v1/balance/wallets', method: 'GET', shouldBlock: false },
      ];

      testCases.forEach(({ url, method, shouldBlock }) => {
        it(`should ${shouldBlock ? 'block' : 'allow'} ${method} ${url}`, async () => {
          // Arrange
          const user: Partial<UserEntity> = { id: 'user-id-1' };
          (request as any).user = user;
          request.url = url;
          request.method = method;

          if (shouldBlock) {
            const endDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
            selfExclusionService.getActiveSelfExclusions.mockResolvedValue([
              {
                id: 'exclusion-1',
                type: SelfExclusionTypeEnum.TEMPORARY,
                platformType: PlatformTypeEnum.CASINO,
                endDate,
                isActive: true,
                userId: 'user-id-1',
                startDate: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
              } as any,
            ]);

            // Act & Assert
            await expect(interceptor.intercept(executionContext, callHandler)).rejects.toThrow(
              ForbiddenException,
            );
            expect(selfExclusionService.getActiveSelfExclusions).toHaveBeenCalled();
            expect(callHandler.handle).not.toHaveBeenCalled();
          } else {
            // Act
            const result = await interceptor.intercept(executionContext, callHandler);

            // Assert
            expect(callHandler.handle).toHaveBeenCalled();
            if (shouldBlock) {
              expect(selfExclusionService.getActiveSelfExclusions).toHaveBeenCalled();
            } else {
              expect(selfExclusionService.getActiveSelfExclusions).not.toHaveBeenCalled();
            }
            const resultValue = await result.toPromise();
            expect(resultValue).toBe('test response');
          }
        });
      });
    });

    describe('time formatting', () => {
      it('should format remaining time correctly for hours and minutes', async () => {
        // Arrange
        const user: Partial<UserEntity> = { id: 'user-id-1' };
        (request as any).user = user;
        const endDate = new Date(Date.now() + 2 * 60 * 60 * 1000 + 30 * 60 * 1000); // 2 hours 30 minutes
        selfExclusionService.getActiveSelfExclusions.mockResolvedValue([
          {
            id: 'exclusion-1',
            type: SelfExclusionTypeEnum.TEMPORARY,
            platformType: PlatformTypeEnum.CASINO,
            endDate,
            isActive: true,
            userId: 'user-id-1',
            startDate: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
          } as any,
        ]);

        // Act & Assert
        try {
          await interceptor.intercept(executionContext, callHandler);
        } catch (error) {
          expect(error).toBeInstanceOf(ForbiddenException);
          expect((error as ForbiddenException).message).toContain('2 hours');
          expect((error as ForbiddenException).message).toContain('30 minutes');
        }
      });

      it('should format remaining time correctly for days and hours', async () => {
        // Arrange
        const user: Partial<UserEntity> = { id: 'user-id-1' };
        (request as any).user = user;
        const endDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000); // 2 days 3 hours
        selfExclusionService.getActiveSelfExclusions.mockResolvedValue([
          {
            id: 'exclusion-1',
            type: SelfExclusionTypeEnum.TEMPORARY,
            platformType: PlatformTypeEnum.CASINO,
            endDate,
            isActive: true,
            userId: 'user-id-1',
            startDate: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
          } as any,
        ]);

        // Act & Assert
        try {
          await interceptor.intercept(executionContext, callHandler);
        } catch (error) {
          expect(error).toBeInstanceOf(ForbiddenException);
          expect((error as ForbiddenException).message).toContain('2 days');
          expect((error as ForbiddenException).message).toContain('3 hours');
        }
      });

      it('should handle exclusions without end date', async () => {
        // Arrange
        const user: Partial<UserEntity> = { id: 'user-id-1' };
        (request as any).user = user;
        selfExclusionService.getActiveSelfExclusions.mockResolvedValue([
          {
            id: 'exclusion-1',
            type: SelfExclusionTypeEnum.PERMANENT,
            platformType: PlatformTypeEnum.CASINO,
            endDate: null,
            isActive: true,
            userId: 'user-id-1',
            startDate: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
          } as any,
        ]);

        // Act & Assert
        try {
          await interceptor.intercept(executionContext, callHandler);
        } catch (error) {
          expect(error).toBeInstanceOf(ForbiddenException);
          expect((error as ForbiddenException).message).toContain('permanently');
        }
      });
    });
  });
});
