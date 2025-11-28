import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AssetTypeEnum } from '../balance/enums/asset-type.enum';
import { UserEntity } from '../users/users.entity';
import { RaceStatusEnum } from './enums/race-status.enum';
import { RaceTypeEnum } from './enums/race-type.enum';

@Entity({ schema: 'bonus', name: 'races' })
export class RaceEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  slug!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'timestamp' })
  startsAt!: Date;

  @Column({ type: 'timestamp' })
  endsAt!: Date;

  @Column({
    type: 'varchar',
    length: 20,
    default: RaceStatusEnum.PENDING,
  })
  status!: RaceStatusEnum;

  @Column({
    type: 'varchar',
    length: 20,
    nullable: false,
    default: RaceTypeEnum.SPONSORED,
  })
  raceType!: RaceTypeEnum;

  @Column({ type: 'decimal', precision: 20, scale: 8 })
  prizePool!: number;

  @Column({ type: 'decimal', array: true })
  prizes!: number[];

  /**
   * Cryptocurrency asset for prizes (BTC, ETH, USDC, etc.)
   * REQUIRED: Must always be set at race creation time.
   * If race has `fiat` field, prizes must be converted to crypto first and this asset field set.
   * Prize amounts in `prizes` array are always in this asset's units.
   */
  @Column({ type: 'varchar', length: 10, nullable: true })
  asset!: AssetTypeEnum | null;

  /**
   * Fiat currency denomination (USD, EUR, etc.)
   * Informational only - indicates prizes were originally in this fiat currency.
   * Conversion to crypto must happen before race creation; `asset` field is always required.
   */
  @Column({ type: 'varchar', length: 3, nullable: true })
  fiat!: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  referralCode!: string | null;

  @Column({ type: 'uuid', nullable: true })
  sponsorId!: string | null;

  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({ name: 'sponsorId' })
  sponsor?: UserEntity;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
