import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { DATABASE_SCHEMAS } from '../database-schemas';

export enum AssetStatusEnum {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  MAINTENANCE = 'MAINTENANCE',
}

@Entity('assets', { schema: DATABASE_SCHEMAS.PAYMENTS })
export class AssetEntity {
  @PrimaryColumn()
  symbol!: string;

  @Column({
    type: 'enum',
    enum: AssetStatusEnum,
    default: AssetStatusEnum.ACTIVE,
  })
  status!: AssetStatusEnum;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
