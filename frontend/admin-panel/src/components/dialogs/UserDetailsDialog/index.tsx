import { Close, Shield } from '@mui/icons-material';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  Typography,
} from '@mui/material';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { UserDetails } from '../../../store/users/config/users.types';
import AccountActivityCard from './components/AccountActivityCard';
import AccountInformationCard from './components/AccountInformationCard';
import FinancialSummaryCard from './components/FinancialSummaryCard';
import GamingStatisticsCard from './components/GamingStatisticsCard';
import TransactionsTable from './components/TransactionsTable';
import WalletBalancesCard from './components/WalletBalancesCard';
import { useUserDetails } from './hooks/useUserDetails';

interface UserDetailsDialogProps {
  open: boolean;
  onClose: () => void;
  user: UserDetails | null;
  onRefresh: () => void;
}

const UserDetailsDialog: React.FC<UserDetailsDialogProps> = ({
  open,
  onClose,
  user,
  onRefresh,
}) => {
  const navigate = useNavigate();
  const {
    userBalanceStatistics,
    userTransactions,
    userTransactionsTotal,
    userTransactionsLoading,
    transactionsPage,
    setTransactionsPage,
    transactionsPageSize,
    setTransactionsPageSize,
    refreshTransactionsAndStatistics,
  } = useUserDetails({ open, userId: user?.id });

  const handleViewSeedPairs = () => {
    if (!user) return;
    void navigate(`/users/seed-pairs?userId=${user.id}`);
    onClose();
  };

  if (!user) {
    return null;
  }

  const handleRefresh = () => {
    onRefresh();
    refreshTransactionsAndStatistics();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">User Details</Typography>
          <IconButton onClick={onClose} size="small">
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 6 }}>
            <AccountInformationCard user={user} />
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <FinancialSummaryCard user={user} userBalanceStatistics={userBalanceStatistics} />
          </Grid>

          <Grid size={12}>
            <WalletBalancesCard wallets={user.wallets || []} />
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <GamingStatisticsCard gameStats={user.gameStats} />
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <AccountActivityCard user={user} />
          </Grid>

          <Grid size={12}>
            <TransactionsTable
              transactions={userTransactions}
              total={userTransactionsTotal}
              loading={userTransactionsLoading}
              page={transactionsPage}
              pageSize={transactionsPageSize}
              onPageChange={setTransactionsPage}
              onPageSizeChange={setTransactionsPageSize}
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleViewSeedPairs} startIcon={<Shield />} color="primary">
          View Seed Pairs
        </Button>
        <Box sx={{ flexGrow: 1 }} />
        <Button onClick={handleRefresh} color="primary">
          Refresh
        </Button>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default UserDetailsDialog;
