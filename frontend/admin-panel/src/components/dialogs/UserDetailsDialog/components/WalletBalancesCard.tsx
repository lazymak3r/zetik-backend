import {
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import React from 'react';
import { UserDetails } from '../../../../store/users/config/users.types';
import { formatNumber } from '../../../../utils';

interface WalletBalancesCardProps {
  wallets: UserDetails['wallets'];
}

const WalletBalancesCard: React.FC<WalletBalancesCardProps> = ({ wallets }) => {
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Wallet Balances
        </Typography>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Asset</TableCell>
                <TableCell>Balance</TableCell>
                <TableCell>Address</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(wallets || []).map((wallet) => (
                <TableRow key={wallet.asset}>
                  <TableCell>{wallet.asset}</TableCell>
                  <TableCell>{formatNumber(wallet.balance)}</TableCell>
                  <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                    {wallet.address}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  );
};

export default WalletBalancesCard;
