import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserEntity } from '@zetik/shared-entities';
import { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PromocodeResponseDto } from '../dto/promocode-response.dto';
import { RedeemPromocodeDto } from '../dto/redeem-promocode.dto';
import { PromocodesService } from '../services/promocodes.service';

@ApiTags('promocodes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('promocodes')
export class PromocodesController {
  constructor(private readonly promocodesService: PromocodesService) {}

  @Post('redeem')
  @ApiOperation({ summary: 'Redeem a promocode' })
  @ApiResponse({
    status: 200,
    description: 'Promocode redeemed successfully',
    type: PromocodeResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid promocode or user not eligible',
  })
  @ApiResponse({
    status: 404,
    description: 'Promocode not found',
  })
  @ApiResponse({
    status: 429,
    description: 'Too many requests',
  })
  async redeemPromocode(
    @CurrentUser() user: UserEntity,
    @Body() dto: RedeemPromocodeDto,
    @Req() request: Request,
  ): Promise<PromocodeResponseDto> {
    const ipAddress = this.getClientIp(request);
    const userAgent = request.get('user-agent') || '';

    return this.promocodesService.redeemPromocode(user.id, dto.code, ipAddress, userAgent);
  }

  private getClientIp(request: Request): string {
    const forwarded = request.headers['x-forwarded-for'] as string;
    const realIp = request.headers['x-real-ip'] as string;
    const cfConnectingIp = request.headers['cf-connecting-ip'] as string;

    if (forwarded) {
      return forwarded.split(',')[0].trim();
    }

    if (realIp) {
      return realIp;
    }

    if (cfConnectingIp) {
      return cfConnectingIp;
    }

    return request.connection.remoteAddress || request.socket.remoteAddress || 'unknown';
  }
}
