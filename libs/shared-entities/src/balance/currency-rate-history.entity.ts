import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { AssetTypeEnum } from './enums/asset-type.enum';

export enum RateProviderEnum {
  COINGECKO = 'CoinGecko',
  BINANCE = 'Binance',
  COINBASE = 'Coinbase',
  KRAKEN = 'Kraken',
}

@Entity('currency_rate_history', { schema: 'balance' })
export class CurrencyRateHistoryEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', enum: AssetTypeEnum })
  asset!: AssetTypeEnum;

  @Column({ type: 'decimal' })
  rate!: string;

  @Column({
    type: 'varchar',
    enum: RateProviderEnum,
    default: RateProviderEnum.COINGECKO,
  })
  provider!: RateProviderEnum;

  @CreateDateColumn()
  createdAt!: Date;
}
