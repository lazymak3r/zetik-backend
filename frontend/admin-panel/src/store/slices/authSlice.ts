import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { api } from '../../config/api';

interface Admin {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface AuthState {
  isAuthenticated: boolean;
  admin: Admin | null;
  token: string | null;
  loading: boolean;
  error: string | null;
}

const getInitialAdmin = (): Admin | null => {
  const adminStr = localStorage.getItem('adminUser');
  if (adminStr) {
    try {
      return JSON.parse(adminStr);
    } catch {
      return null;
    }
  }
  return null;
};

const initialState: AuthState = {
  isAuthenticated: false,
  admin: getInitialAdmin(),
  token: localStorage.getItem('adminToken'),
  loading: false,
  error: null,
};

export const login = createAsyncThunk(
  'auth/login',
  async ({ email, password }: { email: string; password: string }, { rejectWithValue }) => {
    try {
      const response = await api.post('/auth/login', { email, password });
      return response.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Login failed');
    }
  },
);

export const logoutServer = createAsyncThunk(
  'auth/logoutServer',
  async (_, { rejectWithValue }) => {
    try {
      await api.post('/auth/logout');
      return true;
    } catch (err: any) {
      // Even if server logout fails, we still want to clear local state
      return rejectWithValue(err.response?.data?.message || 'Logout failed');
    }
  },
);

export const getMe = createAsyncThunk('auth/getMe', async () => {
  const response = await api.get('/auth/me');
  return response.data;
});

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout: (state) => {
      state.isAuthenticated = false;
      state.admin = null;
      state.token = null;
      localStorage.removeItem('adminToken');
      localStorage.removeItem('adminUser');
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.loading = false;
        state.isAuthenticated = true;
        state.admin = action.payload.admin;
        state.token = action.payload.accessToken;
        localStorage.setItem('adminToken', action.payload.accessToken);
        localStorage.setItem('adminUser', JSON.stringify(action.payload.admin));
      })
      .addCase(login.rejected, (state, action) => {
        state.loading = false;
        state.error = (action.payload as string) || 'Login failed';
      })
      .addCase(logoutServer.fulfilled, (state) => {
        state.isAuthenticated = false;
        state.admin = null;
        state.token = null;
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminUser');
      })
      .addCase(logoutServer.rejected, (state) => {
        // Clear local state even if server logout failed
        state.isAuthenticated = false;
        state.admin = null;
        state.token = null;
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminUser');
      })
      .addCase(getMe.fulfilled, (state, action) => {
        state.isAuthenticated = true;
        state.admin = action.payload;
        localStorage.setItem('adminUser', JSON.stringify(action.payload));
      });
  },
});

export const { logout } = authSlice.actions;
export default authSlice.reducer;
