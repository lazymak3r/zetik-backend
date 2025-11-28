import { Body, Controller, Get, Param, Put, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AdminActionTypeEnum } from '@zetik/shared-entities';
import { AuditLog } from '../audit/decorators/audit-log.decorator';
import { AuditLogInterceptor } from '../audit/interceptors/audit-log.interceptor';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrenciesService, IAssetResponse, IUpdateAssetInput } from './currencies.service';

@ApiTags('currencies')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('currencies')
export class CurrenciesController {
  constructor(private readonly currenciesService: CurrenciesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all assets' })
  @ApiResponse({ type: [Object] })
  @AuditLog({
    action: AdminActionTypeEnum.VIEW,
    resource: 'currencies',
    getDetails: () => ({ action: 'list-assets' }),
  })
  async getAllAssets(): Promise<IAssetResponse[]> {
    return this.currenciesService.getAllAssets();
  }

  @Put(':symbol')
  @ApiOperation({ summary: 'Update asset status' })
  @ApiParam({ name: 'symbol', description: 'Asset symbol (e.g., BTC)' })
  @ApiResponse({ type: Object })
  @AuditLog({
    action: AdminActionTypeEnum.UPDATE,
    resource: 'currencies',
    getResourceId: (args) => args[0] as string,
    getDetails: (args) => ({ updates: args[1] as IUpdateAssetInput }),
  })
  async updateAsset(
    @Param('symbol') symbol: string,
    @Body() updateInput: IUpdateAssetInput,
  ): Promise<IAssetResponse> {
    return this.currenciesService.updateAsset(symbol, updateInput);
  }
}
