import { ProviderCategoryEntity, ProviderDeveloperEntity } from '@zetik/shared-entities';

export interface IGameEntity {
  code: string;
  name: string;
  enabled: boolean;
  developerName: string;
  categoryName: string;
  bonusTypes?: string[];
  themes?: string[];
  features?: string[];
  rtp?: string | null;
  houseEdge: string;
  volatility?: string | null;
  maxPayoutCoeff?: string;
  hitRatio?: string;
  funMode: boolean;
  releaseDate: Date | null;
  deprecationDate?: Date | null;
  restrictedTerritories?: string[];
  prohibitedTerritories?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface IGameEntityExtended extends IGameEntity {
  developer: ProviderDeveloperEntity;
  category: ProviderCategoryEntity;
}
