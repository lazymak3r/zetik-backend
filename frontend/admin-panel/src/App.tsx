import { createTheme, CssBaseline, ThemeProvider } from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import React, { useEffect } from 'react';
import { Provider, useDispatch, useSelector } from 'react-redux';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/layout/Layout';
import AffiliateCampaigns from './pages/AffiliateCampaigns';
import Blog from './pages/Blog';
import Bonus from './pages/Bonus';
import Dashboard from './pages/Dashboard';
import DefaultAvatars from './pages/DefaultAvatars';
import Games from './pages/Games';
import Login from './pages/Login';
import PartnerBonuses from './pages/PartnerBonuses';
import Payments from './pages/Payments';
import Profile from './pages/Profile';
import Promocodes from './pages/Promocodes';
import SelfExclusionTesting from './pages/SelfExclusionTesting';
import Settings from './pages/Settings';
import SlotsManagement from './pages/SlotsManagement';
import Transactions from './pages/Transactions';
import Users from './pages/Users';
import UserSeedPairs from './pages/UserSeedPairs';
import VipTransfers from './pages/VipTransfers';
import { AppDispatch, RootState, store } from './store';
import { getMe } from './store/slices/authSlice';

const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
});

interface PrivateRouteProps {
  children: React.ReactNode;
}

const PrivateRoute: React.FC<PrivateRouteProps> = ({ children }) => {
  const { isAuthenticated, token } = useSelector((state: RootState) => state.auth);

  if (!isAuthenticated && !token) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

function AppContent() {
  const { token, admin } = useSelector((state: RootState) => state.auth);
  const dispatch = useDispatch<AppDispatch>();

  useEffect(() => {
    if (token && !admin) {
      void dispatch(getMe());
    }
  }, [token, admin, dispatch]);

  return (
    <BrowserRouter basename="/v1/admin">
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <PrivateRoute>
              <Layout />
            </PrivateRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="users" element={<Users />} />
          <Route path="users/seed-pairs" element={<UserSeedPairs />} />
          <Route path="avatars" element={<DefaultAvatars />} />
          <Route path="transactions" element={<Transactions />} />
          <Route path="payments" element={<Payments />} />
          <Route path="games" element={<Games />} />
          <Route path="slots-management">
            <Route index element={<SlotsManagement />} />
            <Route path=":folder" element={<SlotsManagement />} />
          </Route>
          <Route path="bonus" element={<Bonus />} />
          <Route path="vip-transfers" element={<VipTransfers />} />
          <Route path="blog" element={<Blog />} />
          <Route path="affiliate" element={<AffiliateCampaigns />} />
          <Route path="testing/self-exclusion" element={<SelfExclusionTesting />} />
          <Route path="promocodes" element={<Promocodes />} />
          <Route path="st8-bonuses" element={<PartnerBonuses />} />
          <Route path="settings" element={<Settings />} />
          <Route path="profile" element={<Profile />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

function App() {
  return (
    <Provider store={store}>
      <ThemeProvider theme={theme}>
        <LocalizationProvider dateAdapter={AdapterDayjs}>
          <CssBaseline />
          <AppContent />
        </LocalizationProvider>
      </ThemeProvider>
    </Provider>
  );
}

export default App;
