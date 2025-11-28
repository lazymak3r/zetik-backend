import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { api } from '../../config/api';

interface DashboardStatistics {
  totalUsers: number;
  activeUsers24h: number;
  newUsers24h: number;
  totalDeposits24h: string;
  totalWithdrawals24h: string;
  totalBets24h: string;
  totalWins24h: string;
  houseEdge24h: string;
  pendingWithdrawals: number;
  totalSystemBalance: string;
  gamesPlayed24h: number;
  topGame24h: string;
}

interface RevenueStatistics {
  date: string;
  deposits: string;
  withdrawals: string;
  bets: string;
  wins: string;
  netRevenue: string;
  activeUsers: number;
}

interface GameStatistics {
  gameType: string;
  gamesPlayed: number;
  totalBets: string;
  totalWins: string;
  houseEdgePercent: number;
  averageBetSize: string;
}

interface DashboardState {
  statistics: DashboardStatistics | null;
  revenue: RevenueStatistics[];
  games: GameStatistics[];
  loading: boolean;
  error: string | null;
}

const initialState: DashboardState = {
  statistics: null,
  revenue: [],
  games: [],
  loading: false,
  error: null,
};

export const fetchDashboardStatistics = createAsyncThunk('dashboard/fetchStatistics', async () => {
  const response = await api.get('/dashboard/statistics');
  return response.data;
});

export const fetchRevenueStatistics = createAsyncThunk(
  'dashboard/fetchRevenue',
  async (days: number = 30) => {
    const response = await api.get(`/dashboard/revenue?days=${days}`);
    return response.data;
  },
);

export const fetchGameStatistics = createAsyncThunk(
  'dashboard/fetchGames',
  async (days: number = 7) => {
    const response = await api.get(`/dashboard/games?days=${days}`);
    return response.data;
  },
);

const dashboardSlice = createSlice({
  name: 'dashboard',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchDashboardStatistics.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchDashboardStatistics.fulfilled, (state, action) => {
        state.loading = false;
        state.statistics = action.payload;
      })
      .addCase(fetchDashboardStatistics.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch statistics';
      })
      .addCase(fetchRevenueStatistics.fulfilled, (state, action) => {
        state.revenue = action.payload;
      })
      .addCase(fetchGameStatistics.fulfilled, (state, action) => {
        state.games = action.payload;
      });
  },
});

export default dashboardSlice.reducer;
