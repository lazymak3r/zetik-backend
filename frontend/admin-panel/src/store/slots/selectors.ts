import { createSelector } from '@reduxjs/toolkit';
import { Developer, ProviderGame } from '../../pages/SlotsManagement/types';
import { RootState } from '../index';

export const selectProviders = (state: RootState) => state.slots.providers;
export const selectProvidersLoading = (state: RootState) => state.slots.providersLoading;
export const selectProvidersError = (state: RootState) => state.slots.providersError;

export const selectGamesByDeveloper = (state: RootState, developerName: string) =>
  state.slots.games[developerName] || [];
export const selectGamesLoading = (state: RootState, developerName: string) =>
  state.slots.gamesLoading[developerName] || false;
export const selectGamesError = (state: RootState, developerName: string) =>
  state.slots.gamesError[developerName] || null;

export const selectImagesByDirectory = (state: RootState, directory: string) => {
  const images = state.slots.images[directory];
  return Array.isArray(images) ? images : [];
};
export const selectImagesLoading = (state: RootState, directory: string) =>
  state.slots.imagesLoading[directory] || false;
export const selectImagesError = (state: RootState, directory: string) =>
  state.slots.imagesError[directory] || null;

export const selectActionLoading = (state: RootState) => state.slots.actionLoading;
export const selectActionError = (state: RootState) => state.slots.actionError;

export const selectProviderByCode = createSelector([selectProviders], (providers) => {
  const map: Record<string, Developer> = {};
  for (const provider of providers) map[provider.code] = provider;
  return map;
});

export const makeSelectGamesByCode = () =>
  createSelector(
    [(state: RootState, developerName: string) => selectGamesByDeveloper(state, developerName)],
    (games: ProviderGame[]) => {
      const map: Record<string, ProviderGame> = {};
      for (const game of games) map[game.code] = game;
      return map;
    },
  );
