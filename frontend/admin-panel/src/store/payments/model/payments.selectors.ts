import { createSelector } from '@reduxjs/toolkit';
import { RootState } from '../../index';

const paymentsState = (state: RootState) => state.payments;

export const selectAssets = createSelector(paymentsState, (state) => state.assets);

export const selectActiveAssets = createSelector(selectAssets, (assets) =>
  assets.filter((asset) => asset.status === 'ACTIVE'),
);

export const selectWithdrawRequests = createSelector(
  paymentsState,
  (state) => state.withdrawRequests,
);

export const selectCurrencyRates = createSelector(paymentsState, (state) => state.currencyRates);

export const selectUserStatistics = createSelector(paymentsState, (state) => state.userStatistics);

export const selectUserBalanceStatistics = createSelector(
  paymentsState,
  (state) => state.userBalanceStatistics,
);

export const selectPaymentsTotal = createSelector(paymentsState, (state) => state.total);

export const selectPaymentsLoading = createSelector(paymentsState, (state) => state.loading);

export const selectPaymentsError = createSelector(paymentsState, (state) => state.error);
