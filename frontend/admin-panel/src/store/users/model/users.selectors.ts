import { createSelector } from '@reduxjs/toolkit';
import { RootState } from '../../index';

const usersState = (state: RootState) => state.users;

export const selectUsers = createSelector(usersState, (state) => state.users);

export const selectSelectedUser = createSelector(usersState, (state) => state.selectedUser);

export const selectUsersTotal = createSelector(usersState, (state) => state.total);

export const selectUsersPage = createSelector(usersState, (state) => state.page);

export const selectUsersPages = createSelector(usersState, (state) => state.pages);

export const selectUsersLoading = createSelector(usersState, (state) => state.loading);

export const selectUsersError = createSelector(usersState, (state) => state.error);

export const selectUserTransactions = createSelector(usersState, (state) => state.userTransactions);

export const selectUserTransactionsTotal = createSelector(
  usersState,
  (state) => state.userTransactionsTotal,
);

export const selectUserTransactionsPage = createSelector(
  usersState,
  (state) => state.userTransactionsPage,
);

export const selectUserTransactionsLoading = createSelector(
  usersState,
  (state) => state.userTransactionsLoading,
);

export const selectUserTransactionsError = createSelector(
  usersState,
  (state) => state.userTransactionsError,
);

export const selectUserTransactionsData = createSelector(
  selectUserTransactions,
  selectUserTransactionsTotal,
  selectUserTransactionsLoading,
  (transactions, total, loading) => ({
    transactions,
    total,
    loading,
  }),
);
