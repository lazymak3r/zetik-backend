import { ProviderGameEntity } from '@zetik/shared-entities';

export interface ICategoryEntity {
  name: string;
  type: string;
  games: ProviderGameEntity[];
  createdAt: Date;
  updatedAt: Date;
}
