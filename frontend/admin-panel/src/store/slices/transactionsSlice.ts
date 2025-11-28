import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { api } from '../../config/api';

interface Transaction {
  id: string;
  type: string;
  userId: string;
  userEmail: string;
  amount: string;
  asset: string;
  amountUSD: string;
  status: string;
  txHash?: string;
  fromAddress?: string;
  toAddress?: string;
  createdAt: Date;
  completedAt?: Date;
}

interface WithdrawRequest {
  id: string;
  userId: string;
  userEmail: string;
  asset: string;
  amount: string;
  amountUSD: string;
  toAddress: string;
  status: string;
  createdAt: Date;
  processedAt?: Date;
  processedBy?: string;
  txHash?: string;
  rejectReason?: string;
  userDetails: {
    totalDeposits: string;
    totalWithdrawals: string;
    currentBalance: string;
    accountAge: number;
    isVerified: boolean;
  };
}

interface TransactionsState {
  transactions: Transaction[];
  pendingWithdrawals: WithdrawRequest[];
  total: number;
  page: number;
  pages: number;
  summary: {
    totalDeposits: string;
    totalWithdrawals: string;
    pendingCount: number;
    pendingValue: string;
  };
  loading: boolean;
  error: string | null;
}

const initialState: TransactionsState = {
  transactions: [],
  pendingWithdrawals: [],
  total: 0,
  page: 1,
  pages: 1,
  summary: {
    totalDeposits: '0',
    totalWithdrawals: '0',
    pendingCount: 0,
    pendingValue: '0',
  },
  loading: false,
  error: null,
};

export const fetchTransactions = createAsyncThunk(
  'transactions/fetchTransactions',
  async (params: Record<string, any>) => {
    const response = await api.get('/transactions', { params });
    return response.data;
  },
);

export const fetchPendingWithdrawals = createAsyncThunk(
  'transactions/fetchPendingWithdrawals',
  async () => {
    const response = await api.get('/transactions/withdrawals/pending');
    return Array.isArray(response.data.items) ? response.data.items : [];
  },
);

export const processWithdrawal = createAsyncThunk(
  'transactions/processWithdrawal',
  async ({
    withdrawalId,
    action,
    reason,
  }: {
    withdrawalId: string;
    action: 'APPROVE' | 'REJECT';
    reason?: string;
  }) => {
    const response = await api.post(`/transactions/withdrawals/${withdrawalId}/process`, {
      action,
      reason,
    });
    return response.data;
  },
);

const transactionsSlice = createSlice({
  name: 'transactions',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchTransactions.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchTransactions.fulfilled, (state, action) => {
        state.loading = false;
        state.transactions = action.payload.items;
        state.total = action.payload.total;
        state.page = action.payload.page;
        state.pages = action.payload.pages;
        state.summary = action.payload.summary;
      })
      .addCase(fetchTransactions.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch transactions';
      })
      .addCase(fetchPendingWithdrawals.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchPendingWithdrawals.fulfilled, (state, action) => {
        state.loading = false;
        state.pendingWithdrawals = action.payload;
      })
      .addCase(fetchPendingWithdrawals.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch pending withdrawals';
      })
      .addCase(processWithdrawal.fulfilled, (state, action) => {
        // Remove processed withdrawal from pending list
        state.pendingWithdrawals = state.pendingWithdrawals.filter(
          (w) => w.id !== action.meta.arg.withdrawalId,
        );
      });
  },
});

export default transactionsSlice.reducer;
