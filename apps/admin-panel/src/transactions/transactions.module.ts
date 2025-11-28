import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  AssetEntity,
  CurrencyRateHistoryEntity,
  TransactionEntity,
  UserEntity,
  WithdrawRequestEntity,
} from '@zetik/shared-entities';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AssetEntity,
      TransactionEntity,
      WithdrawRequestEntity,
      UserEntity,
      CurrencyRateHistoryEntity,
    ]),
  ],
  controllers: [TransactionsController],
  providers: [TransactionsService],
})
export class TransactionsModule {}
