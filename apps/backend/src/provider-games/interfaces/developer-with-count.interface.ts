import { IDeveloper } from './developer.interface';

export interface IDeveloperWithCount extends IDeveloper {
  gamesCount: number;
}
