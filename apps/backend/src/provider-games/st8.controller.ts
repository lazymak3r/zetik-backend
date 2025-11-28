import {
  ArgumentsHost,
  Body,
  Catch,
  Controller,
  ExceptionFilter,
  HttpCode,
  Logger,
  Post,
  UseFilters,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiHeader, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { providerGamesConfig } from '../config/provider-games.config';
import { St8BalanceDto } from './dto/st8-balance.dto';
import { St8BuyinDto } from './dto/st8-buyin.dto';
import { St8CancelBaseDto, St8CancelExtendedDto } from './dto/st8-cancel.dto';
import { St8PayoutDto } from './dto/st8-payout.dto';
import { St8PlayerProfileDto } from './dto/st8-player-profile.dto';
import { St8TransactionDto } from './dto/st8-transaction.dto';
import { St8ResponseStatusEnum } from './enums/st8.enum';
import { St8SignatureInterceptor } from './interceptors/st8-signature.interceptor';
import {
  ISt8ErrorResponse,
  ISt8PlayerProfileResponse,
  ISt8SuccessBalanceResponse,
} from './interfaces/st8-response.interface';
import { St8Service } from './st8.service';

@Catch()
export class St8ExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(St8ExceptionFilter.name);

  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    this.logger.error('St8Controller error:', exception);

    const errorResponse: ISt8ErrorResponse = {
      status: St8ResponseStatusEnum.UNKNOWN,
    };

    response.status(200).json(errorResponse);
  }
}

@ApiTags('provider-games/st8')
@ApiHeader({
  name: providerGamesConfig().signatureHeader,
  description: 'Base64 encoded signature of request payload',
  required: true,
})
@Controller('provider-games/st8')
@UseInterceptors(St8SignatureInterceptor)
@UseFilters(St8ExceptionFilter)
@UsePipes(new ValidationPipe({ whitelist: false, transform: true, forbidNonWhitelisted: false }))
export class St8Controller {
  constructor(private readonly st8Service: St8Service) {}

  @Post('player_profile')
  @HttpCode(200)
  async playerProfile(
    @Body() body: St8PlayerProfileDto,
  ): Promise<ISt8PlayerProfileResponse | ISt8ErrorResponse> {
    return this.st8Service.getUserProfile(body);
  }

  @Post('balance')
  @HttpCode(200)
  async balance(
    @Body() body: St8BalanceDto,
  ): Promise<ISt8SuccessBalanceResponse | ISt8ErrorResponse> {
    return this.st8Service.getBalance(body);
  }

  @Post('debit')
  @HttpCode(200)
  async debit(
    @Body() body: St8TransactionDto,
  ): Promise<ISt8SuccessBalanceResponse | ISt8ErrorResponse> {
    return this.st8Service.debit(body);
  }

  @Post('credit')
  @HttpCode(200)
  async credit(
    @Body() body: St8TransactionDto,
  ): Promise<ISt8SuccessBalanceResponse | ISt8ErrorResponse> {
    return this.st8Service.credit(body);
  }

  @Post('cancel')
  @HttpCode(200)
  async cancel(
    @Body() body: St8CancelBaseDto | St8CancelExtendedDto,
  ): Promise<ISt8SuccessBalanceResponse | ISt8ErrorResponse> {
    /*
     * If Operator receives transaction_id which hasn't been processed before,
     * the transaction_id must be saved to prevent it from being processed later.
     */
    return this.st8Service.cancel(body);
  }

  @Post('buyin')
  @HttpCode(200)
  async buyin(@Body() body: St8BuyinDto): Promise<ISt8SuccessBalanceResponse | ISt8ErrorResponse> {
    return this.st8Service.buyin(body);
  }

  @Post('payout')
  @HttpCode(200)
  async payout(
    @Body() body: St8PayoutDto,
  ): Promise<ISt8SuccessBalanceResponse | ISt8ErrorResponse> {
    return this.st8Service.payout(body);
  }
}
