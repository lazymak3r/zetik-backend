import { ProviderGameEntity } from '@zetik/shared-entities';

export interface IDeveloper {
  name: string;
  code: string;
  restrictedTerritories?: string[];
  prohibitedTerritories?: string[];
  games: ProviderGameEntity[];
}

export interface IDeveloperEntity extends IDeveloper {
  createdAt: Date;
  updatedAt: Date;
}
