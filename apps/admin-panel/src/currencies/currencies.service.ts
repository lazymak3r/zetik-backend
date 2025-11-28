import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

export enum AssetStatusEnum {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  MAINTENANCE = 'MAINTENANCE',
}

export interface IAssetEntity {
  symbol: string;
  status: AssetStatusEnum;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUpdateAssetInput {
  status: AssetStatusEnum;
}

export interface IAssetResponse {
  symbol: string;
  status: AssetStatusEnum;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class CurrenciesService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async getAllAssets(): Promise<IAssetResponse[]> {
    const assets = await this.dataSource.query(
      'SELECT symbol, status, "createdAt", "updatedAt" FROM payments.assets ORDER BY symbol ASC',
    );

    return assets;
  }

  async updateAsset(symbol: string, input: IUpdateAssetInput): Promise<IAssetResponse> {
    const result = await this.dataSource.query(
      'SELECT symbol, status, "createdAt", "updatedAt" FROM payments.assets WHERE symbol = $1',
      [symbol],
    );

    if (!result || result.length === 0) {
      throw new NotFoundException(`Asset with symbol '${symbol}' not found`);
    }

    await this.dataSource.query(
      'UPDATE payments.assets SET status = $1, "updatedAt" = NOW() WHERE symbol = $2',
      [input.status, symbol],
    );

    const updatedResult = await this.dataSource.query(
      'SELECT symbol, status, "createdAt", "updatedAt" FROM payments.assets WHERE symbol = $1',
      [symbol],
    );

    return updatedResult[0];
  }
}
