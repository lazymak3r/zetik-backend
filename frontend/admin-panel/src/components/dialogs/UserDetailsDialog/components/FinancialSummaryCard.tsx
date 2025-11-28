import { AccountBalance } from '@mui/icons-material';
import { Card, CardContent, Grid, MenuItem, Select, Typography } from '@mui/material';
import React, { useState } from 'react';
import { useCurrencyConversion } from '../../../../hooks/useCurrencyConversion';
import { UserBalanceStatistics } from '../../../../store/payments/config/payments.types';
import { UserDetails } from '../../../../store/users/config/users.types';

interface FinancialSummaryCardProps {
  user: UserDetails;
  userBalanceStatistics: UserBalanceStatistics | null;
}

const FinancialSummaryCard: React.FC<FinancialSummaryCardProps> = ({
  user,
  userBalanceStatistics,
}) => {
  const { formatConvertedValue, availableCurrencies } = useCurrencyConversion();
  const [selectedAsset, setSelectedAsset] = useState<string>('USD');

  const netProfitUsd =
    parseFloat(userBalanceStatistics?.wins || '0') - parseFloat(userBalanceStatistics?.bets || '0');
  const netProfit = formatConvertedValue(netProfitUsd.toString(), selectedAsset);

  const deps = formatConvertedValue(userBalanceStatistics?.deps, selectedAsset);
  const withs = formatConvertedValue(userBalanceStatistics?.withs, selectedAsset);
  const bets = formatConvertedValue(userBalanceStatistics?.bets, selectedAsset);
  const wins = formatConvertedValue(userBalanceStatistics?.wins, selectedAsset);
  const currentBalance = formatConvertedValue(user.financials?.currentBalance, selectedAsset);

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          <AccountBalance sx={{ verticalAlign: 'middle', mr: 1 }} />
          Financial Summary
          <Select
            value={selectedAsset}
            onChange={(e) => setSelectedAsset(e.target.value)}
            label="Asset"
            sx={{ ml: 2, minWidth: 100 }}
            size="small"
          >
            <MenuItem value="USD">USD</MenuItem>
            {availableCurrencies.map((symbol) => (
              <MenuItem key={symbol} value={symbol}>
                {symbol}
              </MenuItem>
            ))}
          </Select>
        </Typography>
        <Grid container spacing={2} sx={{ mt: 1 }}>
          <Grid size={6}>
            <Typography variant="body2" color="textSecondary">
              Total Deposits
            </Typography>
            <Typography variant="h6" color="success.main">
              {deps.value} {deps.asset}
            </Typography>
          </Grid>
          <Grid size={6}>
            <Typography variant="body2" color="textSecondary">
              Total Withdrawals
            </Typography>
            <Typography variant="h6" color="error.main">
              {withs.value} {withs.asset}
            </Typography>
          </Grid>
          <Grid size={6}>
            <Typography variant="body2" color="textSecondary">
              Total Wagered
            </Typography>
            <Typography variant="h6">
              {bets.value} {bets.asset}
            </Typography>
          </Grid>
          <Grid size={6}>
            <Typography variant="body2" color="textSecondary">
              Total Won
            </Typography>
            <Typography variant="h6">
              {wins.value} {wins.asset}
            </Typography>
          </Grid>
          <Grid size={6}>
            <Typography variant="body2" color="textSecondary">
              Current Balance
            </Typography>
            <Typography variant="h6" color="primary">
              {currentBalance.value} {currentBalance.asset}
            </Typography>
          </Grid>
          <Grid size={6}>
            <Typography variant="body2" color="textSecondary">
              Net Profit
            </Typography>
            <Typography variant="h6" color={netProfitUsd >= 0 ? 'success.main' : 'error.main'}>
              {netProfit.value} {netProfit.asset}
            </Typography>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
};

export default FinancialSummaryCard;
