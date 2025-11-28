import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AssetTypeEnum } from '../balance/enums/asset-type.enum';
import { DATABASE_SCHEMAS } from '../database-schemas';
import { UserEntity } from '../users/users.entity';

export enum RouletteColor {
  RED = 'red',
  BLACK = 'black',
  GREEN = 'green',
}

export enum BetType {
  STRAIGHT = 'straight',
  SPLIT = 'split',
  STREET = 'street',
  CORNER = 'corner',
  LINE = 'line',
  BASKET = 'basket',
  TRIO = 'trio',
  COLUMN = 'column',
  DOZEN = 'dozen',
  RED = 'red',
  BLACK = 'black',
  EVEN = 'even',
  ODD = 'odd',
  LOW = 'low',
  HIGH = 'high',
}

export interface RouletteBet {
  type: BetType;
  numbers: number[];
  amount: string;
  payout?: number;
}

@Entity({ name: 'roulette_games', schema: DATABASE_SCHEMAS.GAMES })
@Index(['userId', 'createdAt'])
@Index(['isCompleted'])
export class RouletteGame {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  @Index()
  userId!: string;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'userId' })
  user!: UserEntity;

  @Column({
    type: 'enum',
    enum: AssetTypeEnum,
    default: AssetTypeEnum.USDC,
  })
  asset!: AssetTypeEnum;

  @Column('int')
  seedPairId!: number;

  @Column('json')
  bets!: RouletteBet[];

  @Column({ type: 'decimal', precision: 18, scale: 8 })
  totalBetAmount!: string;

  @Column({ type: 'int', nullable: true })
  winningNumber!: number | null;

  @Column({ type: 'enum', enum: RouletteColor, nullable: true })
  winningColor!: RouletteColor | null;

  @Column({ type: 'decimal', precision: 18, scale: 8, nullable: true })
  totalPayout!: string | null;

  @Column({ type: 'decimal', precision: 18, scale: 8, nullable: true })
  profit!: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 4, nullable: true, default: '0.0000' })
  totalMultiplier!: string | null;

  @Column({ type: 'boolean', default: false })
  isCompleted!: boolean;

  @Column({ type: 'int' })
  nonce!: number;

  @Column({ type: 'text', nullable: true })
  clientSeed!: string | null;

  // Fiat preservation fields for maintaining display precision
  @Column('decimal', { precision: 12, scale: 2, nullable: true })
  originalFiatAmount?: string;

  @Column({ length: 3, nullable: true })
  originalFiatCurrency?: string;

  @Column('decimal', { precision: 12, scale: 8, nullable: true })
  fiatToUsdRate?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
