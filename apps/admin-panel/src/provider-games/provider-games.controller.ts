import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AdminActionTypeEnum } from '@zetik/shared-entities';
import { AuditLog } from '../audit/decorators/audit-log.decorator';
import { AuditLogInterceptor } from '../audit/interceptors/audit-log.interceptor';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProviderDevelopersResponseDto } from './dto/provider-developer.dto';
import { ProviderGameDto } from './dto/provider-game.dto';
import { UpdateProviderDeveloperDto } from './dto/update-provider-developer.dto';
import { UpdateProviderGameDto } from './dto/update-provider-game.dto';
import { ProviderGamesService } from './provider-games.service';

@ApiTags('provider-games')
@Controller('provider-games')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@UseInterceptors(AuditLogInterceptor)
export class ProviderGamesController {
  constructor(private readonly providerGamesService: ProviderGamesService) {}

  @Get('developers')
  @ApiOperation({ summary: 'List all provider developers' })
  @ApiResponse({
    status: 200,
    description: 'Provider developers',
    type: ProviderDevelopersResponseDto,
  })
  @AuditLog({ action: AdminActionTypeEnum.VIEW, resource: 'provider-games' })
  async getDevelopers(): Promise<ProviderDevelopersResponseDto> {
    const developers = await this.providerGamesService.getDevelopers();
    return { developers };
  }

  @Patch('developers/:name')
  @ApiOperation({ summary: 'Update provider developer' })
  @ApiResponse({
    status: 200,
    description: 'Provider developer updated',
  })
  @AuditLog({
    action: AdminActionTypeEnum.UPDATE,
    resource: 'provider-games',
    getResourceId: (args) => String(args[0]),
  })
  async updateDeveloper(@Param('name') name: string, @Body() dto: UpdateProviderDeveloperDto) {
    return this.providerGamesService.updateDeveloper(name, dto);
  }

  @Get('games')
  @ApiOperation({ summary: 'Get games by developer' })
  @ApiResponse({
    status: 200,
    description: 'List of games for the developer',
    type: [ProviderGameDto],
  })
  @AuditLog({ action: AdminActionTypeEnum.VIEW, resource: 'provider-games' })
  async getGamesByDeveloper(
    @Query('developerName') developerName: string,
  ): Promise<ProviderGameDto[]> {
    return this.providerGamesService.getGamesByDeveloper(developerName);
  }

  @Get('games/:code')
  @ApiOperation({ summary: 'Get game by code' })
  @ApiResponse({
    status: 200,
    description: 'Game details',
    type: ProviderGameDto,
  })
  @AuditLog({ action: AdminActionTypeEnum.VIEW, resource: 'provider-games' })
  async getGameByCode(@Param('code') code: string): Promise<ProviderGameDto> {
    return this.providerGamesService.getGameByCode(code);
  }

  @Patch('games/:code')
  @ApiOperation({ summary: 'Update game description' })
  @ApiResponse({
    status: 200,
    description: 'Game updated',
    type: ProviderGameDto,
  })
  @AuditLog({
    action: AdminActionTypeEnum.UPDATE,
    resource: 'provider-games',
    getResourceId: (args) => String(args[0]),
  })
  async updateGameDescription(
    @Param('code') code: string,
    @Body() dto: UpdateProviderGameDto,
  ): Promise<ProviderGameDto> {
    return this.providerGamesService.updateGameDescription(code, dto);
  }
}
