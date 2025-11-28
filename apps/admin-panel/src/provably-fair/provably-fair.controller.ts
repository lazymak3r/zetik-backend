import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AdminActionTypeEnum, AdminRole } from '@zetik/shared-entities';
import { AuditLog } from '../audit/decorators/audit-log.decorator';
import { AuditLogInterceptor } from '../audit/interceptors/audit-log.interceptor';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { RotateSeedPairDto } from './dto/rotate-seed-pair.dto';
import { SeedPairResponseDto } from './dto/seed-pair-response.dto';
import { SeedPairsListResponseDto } from './dto/seed-pairs-list-response.dto';
import { UpdateSeedPairDto } from './dto/update-seed-pair.dto';
import { ProvablyFairService } from './provably-fair.service';

/**
 * Provably Fair Admin Controller
 *
 * SECURITY: All endpoints in this controller are restricted to SUPER_ADMIN role only.
 * These endpoints allow direct manipulation of the provably fair system which is
 * critical to the integrity of the platform.
 *
 * Regular admins (ADMIN role) will receive 403 Forbidden when attempting to access.
 */
@ApiTags('provably-fair')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(AdminRole.SUPER_ADMIN)
@UseInterceptors(AuditLogInterceptor)
@Controller('provably-fair')
export class ProvablyFairController {
  constructor(private readonly provablyFairService: ProvablyFairService) {}

  @Get('users/:userId/seed-pairs')
  @ApiOperation({ summary: 'Get all seed pairs for a user with pagination' })
  @ApiParam({ name: 'userId', description: 'User ID (UUID)' })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page (default: 10)',
  })
  @ApiResponse({ status: 200, type: SeedPairsListResponseDto })
  @ApiResponse({ status: 404, description: 'User not found' })
  @AuditLog({
    action: AdminActionTypeEnum.VIEW,
    resource: 'seed-pairs',
    getResourceId: (args) => args[0] as string,
    getDetails: (args) => ({
      userId: args[0],
      page: args[1],
      limit: args[2],
    }),
  })
  async getSeedPairs(
    @Param('userId') userId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ): Promise<SeedPairsListResponseDto> {
    return this.provablyFairService.getSeedPairs(userId, page, limit);
  }

  @Get('users/:userId/seed-pairs/active')
  @ApiOperation({ summary: 'Get current active seed pair for user' })
  @ApiParam({ name: 'userId', description: 'User ID (UUID)' })
  @ApiResponse({ status: 200, type: SeedPairResponseDto })
  @ApiResponse({ status: 404, description: 'User not found' })
  @AuditLog({
    action: AdminActionTypeEnum.VIEW,
    resource: 'seed-pairs',
    getResourceId: (args) => args[0] as string,
    getDetails: (args) => ({
      userId: args[0],
      type: 'active-seed-pair',
    }),
  })
  async getActiveSeedPair(@Param('userId') userId: string): Promise<SeedPairResponseDto | null> {
    return this.provablyFairService.getActiveSeedPair(userId);
  }

  @Get('users/:userId/seed-pairs/:seedPairId')
  @ApiOperation({ summary: 'Get specific seed pair by ID' })
  @ApiParam({ name: 'userId', description: 'User ID (UUID)' })
  @ApiParam({ name: 'seedPairId', description: 'Seed Pair ID' })
  @ApiResponse({ status: 200, type: SeedPairResponseDto })
  @ApiResponse({ status: 404, description: 'User or seed pair not found' })
  @AuditLog({
    action: AdminActionTypeEnum.VIEW,
    resource: 'seed-pairs',
    getResourceId: (args) => `${args[0]}-${args[1]}`,
    getDetails: (args) => ({
      userId: args[0],
      seedPairId: args[1],
    }),
  })
  async getSeedPairById(
    @Param('userId') userId: string,
    @Param('seedPairId', ParseIntPipe) seedPairId: number,
  ): Promise<SeedPairResponseDto> {
    return this.provablyFairService.getSeedPairById(userId, seedPairId);
  }

  @Patch('users/:userId/seed-pairs/:seedPairId')
  @ApiOperation({
    summary: 'Update seed pair fields',
    description:
      'Update seed pair fields. If serverSeed is changed, serverSeedHash is automatically updated. ' +
      'If nextServerSeed is changed, nextServerSeedHash is automatically updated.',
  })
  @ApiParam({ name: 'userId', description: 'User ID (UUID)' })
  @ApiParam({ name: 'seedPairId', description: 'Seed Pair ID' })
  @ApiResponse({ status: 200, type: SeedPairResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 404, description: 'User or seed pair not found' })
  @AuditLog({
    action: AdminActionTypeEnum.UPDATE,
    resource: 'seed-pairs',
    getResourceId: (args) => `${args[0]}-${args[1]}`,
    getDetails: (args) => ({
      userId: args[0],
      seedPairId: args[1],
      updates: args[2],
    }),
  })
  async updateSeedPair(
    @Param('userId') userId: string,
    @Param('seedPairId', ParseIntPipe) seedPairId: number,
    @Body() updateDto: UpdateSeedPairDto,
  ): Promise<SeedPairResponseDto> {
    return this.provablyFairService.updateSeedPair(userId, seedPairId, updateDto);
  }

  @Post('users/:userId/seed-pairs/rotate')
  @ApiOperation({
    summary: 'Force rotate to new seed pair',
    description:
      'Creates a new active seed pair and deactivates the current one. ' +
      'The old seed pair is revealed if it has a nextServerSeed.',
  })
  @ApiParam({ name: 'userId', description: 'User ID (UUID)' })
  @ApiResponse({
    status: 201,
    description: 'Returns both old (deactivated) and new (active) seed pairs',
    schema: {
      properties: {
        old: { $ref: '#/components/schemas/SeedPairResponseDto' },
        new: { $ref: '#/components/schemas/SeedPairResponseDto' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'User or active seed pair not found' })
  @AuditLog({
    action: AdminActionTypeEnum.UPDATE,
    resource: 'seed-pairs',
    getResourceId: (args) => args[0] as string,
    getDetails: (args) => ({
      userId: args[0],
      action: 'rotate',
      clientSeed: (args[1] as RotateSeedPairDto)?.clientSeed,
    }),
  })
  async rotateSeedPair(
    @Param('userId') userId: string,
    @Body() rotateDto: RotateSeedPairDto,
  ): Promise<{ old: SeedPairResponseDto; new: SeedPairResponseDto }> {
    return this.provablyFairService.rotateSeedPair(userId, rotateDto);
  }
}
