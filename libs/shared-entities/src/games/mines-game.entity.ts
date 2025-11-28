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

export enum MinesGameStatus {
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED', // Manually cashed out
  BUSTED = 'BUSTED', // Hit a mine
  CANCELLED = 'CANCELLED',
}

@Entity({ name: 'mines_games', schema: DATABASE_SCHEMAS.GAMES })
@Index(['userId', 'status'])
@Index(['gameSessionId'])
export class MinesGameEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  userId!: string;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'userId' })
  user!: UserEntity;

  @Column('uuid')
  gameSessionId!: string;

  @Column('decimal', { precision: 20, scale: 8 })
  betAmount!: string;

  @Column({
    type: 'enum',
    enum: AssetTypeEnum,
    default: AssetTypeEnum.USDC,
  })
  asset!: AssetTypeEnum;

  @Column('int')
  minesCount!: number; // Number of mines (1-24)

  @Column('json')
  minePositions!: number[]; // Array of mine positions (0-24)

  @Column('json', { default: '[]' })
  revealedTiles!: number[]; // Array of revealed tile positions

  @Column('decimal', { precision: 18, scale: 8, default: '1.00000000' })
  currentMultiplier!: string; // Current win multiplier

  @Column('decimal', { precision: 20, scale: 8, default: '0' })
  potentialPayout!: string; // Current potential payout

  @Column({
    type: 'enum',
    enum: MinesGameStatus,
    default: MinesGameStatus.ACTIVE,
  })
  status!: MinesGameStatus;

  @Column('decimal', { precision: 20, scale: 8, nullable: true })
  finalPayout!: string; // Final payout amount (null if busted)

  @Column('text', { nullable: true })
  clientSeed!: string; // User-provided randomness

  @Column('text', { nullable: true })
  serverSeed!: string; // Server-provided randomness (revealed after game)

  @Column('text', { nullable: true })
  serverSeedHash!: string; // Hash of server seed (revealed before game)

  @Column('int', { nullable: true })
  nonce!: number; // Nonce for provably fair

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
