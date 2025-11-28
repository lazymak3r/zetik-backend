import { createSlice } from '@reduxjs/toolkit';
import { UsersState } from '../config';
import {
  fetchUserDetails,
  fetchUsers,
  fetchUserTransactions,
  muteUser,
  unmuteUser,
  updateUser,
} from './users.thunks';

const initialState: UsersState = {
  users: [],
  selectedUser: null,
  total: 0,
  page: 1,
  pages: 1,
  loading: false,
  error: null,
  userTransactions: [],
  userTransactionsTotal: 0,
  userTransactionsPage: 0,
  userTransactionsLoading: false,
  userTransactionsError: null,
};

const usersSlice = createSlice({
  name: 'users',
  initialState,
  reducers: {
    clearSelectedUser: (state) => {
      state.selectedUser = null;
    },
    clearUserTransactions: (state) => {
      state.userTransactions = [];
      state.userTransactionsTotal = 0;
      state.userTransactionsPage = 0;
      state.userTransactionsError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchUsers.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchUsers.fulfilled, (state, action) => {
        state.loading = false;
        state.users = action.payload.items;
        state.total = action.payload.total;
        state.page = action.payload.page;
        state.pages = action.payload.pages;
      })
      .addCase(fetchUsers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch users';
      })
      .addCase(fetchUserDetails.fulfilled, (state, action) => {
        state.selectedUser = action.payload;
        const userIndex = state.users.findIndex((u) => u.id === action.payload.id);
        if (userIndex !== -1) {
          state.users[userIndex] = {
            ...state.users[userIndex],
            ...action.payload,
          };
        }
      })
      .addCase(updateUser.fulfilled, (state, action) => {
        state.selectedUser = action.payload;
        const userIndex = state.users.findIndex((u) => u.id === action.payload.id);
        if (userIndex !== -1) {
          state.users[userIndex] = {
            ...state.users[userIndex],
            ...action.payload,
          };
        }
      })
      .addCase(muteUser.fulfilled, (state, action) => {
        const { userId, durationMinutes, reason } = action.payload;
        const mutedUntil = new Date();
        mutedUntil.setMinutes(mutedUntil.getMinutes() + durationMinutes);
        const isUserMuted = mutedUntil > new Date();

        const userIndex = state.users.findIndex((u) => u.id === userId);
        if (userIndex !== -1) {
          state.users[userIndex].mutedUntil = mutedUntil;
          state.users[userIndex].muteReason = reason || null;
          state.users[userIndex].isUserMuted = isUserMuted;
        }

        if (state.selectedUser && state.selectedUser.id === userId) {
          state.selectedUser.mutedUntil = mutedUntil;
          state.selectedUser.muteReason = reason || null;
          state.selectedUser.isUserMuted = isUserMuted;
        }
      })
      .addCase(unmuteUser.fulfilled, (state, action) => {
        const { userId } = action.payload;

        const userIndex = state.users.findIndex((u) => u.id === userId);
        if (userIndex !== -1) {
          state.users[userIndex].mutedUntil = null;
          state.users[userIndex].muteReason = null;
          state.users[userIndex].isUserMuted = false;
        }

        if (state.selectedUser && state.selectedUser.id === userId) {
          state.selectedUser.mutedUntil = null;
          state.selectedUser.muteReason = null;
          state.selectedUser.isUserMuted = false;
        }
      })
      .addCase(fetchUserTransactions.pending, (state) => {
        state.userTransactionsLoading = true;
        state.userTransactionsError = null;
      })
      .addCase(fetchUserTransactions.fulfilled, (state, action) => {
        state.userTransactionsLoading = false;
        state.userTransactions = action.payload.items;
        state.userTransactionsTotal = action.payload.total;
      })
      .addCase(fetchUserTransactions.rejected, (state, action) => {
        state.userTransactionsLoading = false;
        state.userTransactionsError = action.error.message || 'Failed to fetch user transactions';
        state.userTransactions = [];
        state.userTransactionsTotal = 0;
      });
  },
});

export const { clearSelectedUser, clearUserTransactions } = usersSlice.actions;
export default usersSlice.reducer;
