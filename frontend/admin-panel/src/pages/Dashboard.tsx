import {
  AccountBalanceWallet,
  AttachMoney,
  People,
  SportsEsports,
  TrendingUp,
  Warning,
} from '@mui/icons-material';
import { Alert, Box, Card, CardContent, CircularProgress, Grid, Typography } from '@mui/material';
import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import GameStatsChart from '../components/charts/GameStatsChart';
import RevenueChart from '../components/charts/RevenueChart';
import { AppDispatch, RootState } from '../store';
import {
  fetchDashboardStatistics,
  fetchGameStatistics,
  fetchRevenueStatistics,
} from '../store/slices/dashboardSlice';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  subtitle?: string;
  clickable?: boolean;
  onClick?: () => void;
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon,
  color,
  subtitle,
  clickable,
  onClick,
}) => (
  <Card
    sx={{
      cursor: clickable ? 'pointer' : 'default',
      '&:hover': clickable
        ? {
            boxShadow: 3,
            transform: 'translateY(-2px)',
            transition: 'all 0.2s ease-in-out',
          }
        : {},
    }}
    onClick={clickable ? onClick : undefined}
  >
    <CardContent>
      <Box display="flex" alignItems="center" justifyContent="space-between">
        <Box>
          <Typography color="textSecondary" variant="body2" gutterBottom>
            {title}
          </Typography>
          <Typography variant="h4" component="div">
            {value}
          </Typography>
          {subtitle && (
            <Typography variant="caption" color="textSecondary">
              {subtitle}
            </Typography>
          )}
        </Box>
        <Box
          sx={{
            backgroundColor: color,
            borderRadius: '50%',
            p: 1.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {icon}
        </Box>
      </Box>
    </CardContent>
  </Card>
);

const Dashboard: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { statistics, revenue, games, loading, error } = useSelector(
    (state: RootState) => state.dashboard,
  );

  useEffect(() => {
    dispatch(fetchDashboardStatistics());
    dispatch(fetchRevenueStatistics(30));
    dispatch(fetchGameStatistics(7));
  }, [dispatch]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        {error}
      </Alert>
    );
  }

  if (!statistics) {
    return null;
  }

  const formatCurrency = (value: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(parseFloat(value));
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Dashboard
      </Typography>

      <Grid container spacing={3} mb={3}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Total Users"
            value={
              typeof statistics.totalUsers === 'number'
                ? statistics.totalUsers.toLocaleString()
                : '0'
            }
            icon={<People sx={{ color: 'white' }} />}
            color="#1976d2"
            subtitle={`+${statistics.newUsers24h} today`}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Active Users (24h)"
            value={
              typeof statistics.activeUsers24h === 'number'
                ? statistics.activeUsers24h.toLocaleString()
                : '0'
            }
            icon={<TrendingUp sx={{ color: 'white' }} />}
            color="#388e3c"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="System Balance"
            value={formatCurrency(statistics.totalSystemBalance)}
            icon={<AccountBalanceWallet sx={{ color: 'white' }} />}
            color="#f57c00"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Pending Withdrawals"
            value={
              typeof statistics.pendingWithdrawals === 'number'
                ? statistics.pendingWithdrawals.toLocaleString()
                : '0'
            }
            icon={<Warning sx={{ color: 'white' }} />}
            color={statistics.pendingWithdrawals > 0 ? '#d32f2f' : '#757575'}
            clickable={true}
            onClick={() => navigate('/transactions')}
          />
        </Grid>
      </Grid>

      <Grid container spacing={3} mb={3}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Deposits (24h)"
            value={formatCurrency(statistics.totalDeposits24h)}
            icon={<AttachMoney sx={{ color: 'white' }} />}
            color="#2e7d32"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Withdrawals (24h)"
            value={formatCurrency(statistics.totalWithdrawals24h)}
            icon={<AttachMoney sx={{ color: 'white' }} />}
            color="#c62828"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="House Edge (24h)"
            value={formatCurrency(statistics.houseEdge24h)}
            icon={<TrendingUp sx={{ color: 'white' }} />}
            color="#6a1b9a"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Games Played (24h)"
            value={
              typeof statistics.gamesPlayed24h === 'number'
                ? statistics.gamesPlayed24h.toLocaleString()
                : '0'
            }
            icon={<SportsEsports sx={{ color: 'white' }} />}
            color="#00695c"
            subtitle={`Top: ${statistics.topGame24h}`}
          />
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Revenue Trend (30 Days)
              </Typography>
              <RevenueChart data={revenue} />
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, lg: 4 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Game Performance (7 Days)
              </Typography>
              <GameStatsChart data={games} />
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;
