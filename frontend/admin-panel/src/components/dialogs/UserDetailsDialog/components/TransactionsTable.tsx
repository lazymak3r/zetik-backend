import {
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  Typography,
} from '@mui/material';
import React from 'react';
import { UserTransaction } from '../../../../store/users/config/users.types';
import { formatNumber } from '../../../../utils';

interface TransactionsTableProps {
  transactions: UserTransaction[];
  total: number;
  loading: boolean;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

const TransactionsTable: React.FC<TransactionsTableProps> = ({
  transactions,
  total,
  loading,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
}) => {
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Recent Transactions
        </Typography>
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Amount</TableCell>
                <TableCell>Asset</TableCell>
                <TableCell>Metadata</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                    <CircularProgress size={24} />
                  </TableCell>
                </TableRow>
              ) : transactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                    <Typography variant="body2" color="textSecondary">
                      No transactions found
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                transactions.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell>{new Date(tx.createdAt).toLocaleString()}</TableCell>
                    <TableCell>
                      <Chip label={tx.type} size="small" />
                    </TableCell>
                    <TableCell>{formatNumber(tx.amount)}</TableCell>
                    <TableCell>{tx.asset}</TableCell>
                    <TableCell>{tx.metadata}</TableCell>
                    <TableCell>
                      <Chip
                        label={tx.status}
                        size="small"
                        color={tx.status === 'COMPLETED' ? 'success' : 'default'}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={total}
          page={page}
          onPageChange={(_, newPage) => {
            onPageChange(newPage);
          }}
          rowsPerPage={pageSize}
          onRowsPerPageChange={(e) => {
            onPageSizeChange(parseInt(e.target.value, 10));
            onPageChange(0);
          }}
          rowsPerPageOptions={[5, 10, 20, 50]}
        />
      </CardContent>
    </Card>
  );
};

export default TransactionsTable;
