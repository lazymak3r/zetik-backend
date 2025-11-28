import { AttachMoney, Check, Close, Refresh, TrendingUp, Warning } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs, { Dayjs } from 'dayjs';
import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../store';
import {
  approveWithdrawRequest,
  clearError,
  clearUserStatistics,
  fetchCurrencyRates,
  fetchUserBalanceStatistics,
  fetchUserStatistics,
  fetchWithdrawRequests,
  rejectWithdrawRequest,
} from '../store/payments';
import { fetchTransactions } from '../store/slices/transactionsSlice';

const Transactions: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { transactions, total, loading, summary } = useSelector(
    (state: RootState) => state.transactions,
  );
  const {
    withdrawRequests,
    currencyRates,
    userStatistics,
    userBalanceStatistics,
    loading: paymentsLoading,
    error,
  } = useSelector((state: RootState) => state.payments);

  const [activeTab, setActiveTab] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [filters, setFilters] = useState({
    type: '',
    status: '',
    userId: '',
    asset: '',
    startDate: null as Dayjs | null,
    endDate: null as Dayjs | null,
  });

  // New states for full withdrawal functionality
  const [approveDialog, setApproveDialog] = useState(false);
  const [rejectDialog, setRejectDialog] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [approvalComment, setApprovalComment] = useState('');
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    if (activeTab === 0) {
      loadTransactions();
    } else {
      void dispatch(fetchWithdrawRequests({ page: 1, limit: 20 }));
      void dispatch(fetchCurrencyRates());
    }
  }, [activeTab, page, pageSize, filters, dispatch]);

  const loadTransactions = () => {
    const params: any = {
      page: page + 1,
      limit: pageSize,
    };

    if (filters.type) params.type = filters.type;
    if (filters.status) params.status = filters.status;
    if (filters.userId) params.userId = filters.userId;
    if (filters.asset) params.asset = filters.asset;
    if (filters.startDate) params.startDate = filters.startDate.toISOString();
    if (filters.endDate) params.endDate = filters.endDate.toISOString();

    void dispatch(fetchTransactions(params));
  };

  // New handlers for full withdrawal functionality
  const handleApproveRequest = (request: any) => {
    setSelectedRequest(request);
    setApprovalComment('');
    setApproveDialog(true);
    void dispatch(fetchUserStatistics(request.userId));
    void dispatch(fetchUserBalanceStatistics(request.userId));
  };

  const handleRejectRequest = (request: any) => {
    setSelectedRequest(request);
    setRejectReason('');
    setRejectDialog(true);
  };

  const handleConfirmApprove = async () => {
    if (selectedRequest) {
      try {
        await dispatch(
          approveWithdrawRequest({ id: selectedRequest.id, comment: approvalComment }),
        ).unwrap();
        setApproveDialog(false);
        setSelectedRequest(null);
        setApprovalComment('');
        void dispatch(clearUserStatistics());
        void dispatch(fetchWithdrawRequests({ page: 1, limit: 20 }));
      } catch (error) {
        console.error('Failed to approve request:', error);
      }
    }
  };

  const handleConfirmReject = async () => {
    if (selectedRequest && rejectReason) {
      try {
        await dispatch(
          rejectWithdrawRequest({ id: selectedRequest.id, reason: rejectReason }),
        ).unwrap();
        setRejectDialog(false);
        setSelectedRequest(null);
        setRejectReason('');
        void dispatch(fetchWithdrawRequests({ page: 1, limit: 20 }));
      } catch (error) {
        console.error('Failed to reject request:', error);
      }
    }
  };

  // Calculate USD value for crypto amount
  const calculateUsdValue = (amount: string, asset: string): number | null => {
    if (!currencyRates?.rates || !amount || !asset) return null;
    const rate = currencyRates.rates[asset];
    if (!rate) return null;
    return parseFloat(amount) * rate;
  };

  // Balance statistics helper function
  const formatUsdAmount = (amount: string) => {
    const num = parseFloat(amount);
    return num.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const transactionColumns: GridColDef[] = [
    {
      field: 'createdAt',
      headerName: 'Date',
      width: 180,
      valueFormatter: (value) => new Date(value).toLocaleString(),
    },
    {
      field: 'type',
      headerName: 'Type',
      width: 120,
      renderCell: (params: GridRenderCellParams) => <Chip label={params.value} size="small" />,
    },
    {
      field: 'userEmail',
      headerName: 'User',
      width: 200,
    },
    {
      field: 'amount',
      headerName: 'Amount',
      width: 150,
      renderCell: (params) => `${params.value} ${params.row.asset}`,
    },
    {
      field: 'amountUSD',
      headerName: 'Value (USD)',
      width: 120,
      renderCell: (params) => `$${parseFloat(params.value).toFixed(2)}`,
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 120,
      renderCell: (params: GridRenderCellParams) => (
        <Chip
          label={params.value}
          size="small"
          color={
            params.value === 'COMPLETED'
              ? 'success'
              : params.value === 'FAILED'
                ? 'error'
                : 'warning'
          }
        />
      ),
    },
    {
      field: 'txHash',
      headerName: 'Transaction Hash',
      width: 200,
      renderCell: (params) =>
        params.value ? (
          <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
            {params.value.substring(0, 20)}...
          </Typography>
        ) : (
          '-'
        ),
    },
  ];

  // Withdrawal requests columns
  const withdrawColumns: GridColDef[] = [
    {
      field: 'userId',
      headerName: 'User ID',
      width: 120,
      headerAlign: 'center',
      align: 'center',
      renderCell: (params) => (
        <Box display="flex" alignItems="center" justifyContent="center" height="100%">
          <Typography variant="body2" fontFamily="monospace" title={params.value}>
            {params.value.substring(0, 8)}...
          </Typography>
        </Box>
      ),
    },
    {
      field: 'asset',
      headerName: 'Asset',
      width: 80,
      headerAlign: 'center',
      align: 'center',
      renderCell: (params) => (
        <Box display="flex" alignItems="center" justifyContent="center" height="100%">
          <Typography variant="body2">{params.value}</Typography>
        </Box>
      ),
    },
    {
      field: 'amount',
      headerName: 'Amount',
      width: 120,
      headerAlign: 'center',
      align: 'center',
      renderCell: (params) => (
        <Box display="flex" alignItems="center" justifyContent="center" height="100%">
          <Typography variant="body2" title={`${params.value} ${params.row.asset}`}>
            {parseFloat(params.value).toFixed(4)} {params.row.asset}
          </Typography>
        </Box>
      ),
    },
    {
      field: 'usdValue',
      headerName: 'USD Value',
      width: 120,
      headerAlign: 'center',
      align: 'center',
      sortable: false,
      renderCell: (params) => {
        const usdValue = calculateUsdValue(params.row.amount, params.row.asset);
        return (
          <Box display="flex" alignItems="center" justifyContent="center" height="100%">
            <Typography variant="body2" color="text.secondary">
              {usdValue
                ? `$${usdValue.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}`
                : 'N/A'}
            </Typography>
          </Box>
        );
      },
    },
    {
      field: 'toAddress',
      headerName: 'To Address',
      width: 140,
      headerAlign: 'center',
      align: 'center',
      renderCell: (params) => (
        <Box display="flex" alignItems="center" justifyContent="center" height="100%">
          <Typography variant="body2" fontFamily="monospace" title={params.value}>
            {params.value.substring(0, 12)}...
          </Typography>
        </Box>
      ),
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 120,
      headerAlign: 'center',
      align: 'center',
      renderCell: (params: GridRenderCellParams) => (
        <Box display="flex" alignItems="center" justifyContent="center" height="100%">
          <Chip
            label={params.value}
            color={
              params.value === 'PENDING'
                ? 'warning'
                : params.value === 'APPROVED'
                  ? 'info'
                  : params.value === 'SENT'
                    ? 'success'
                    : params.value === 'REJECTED'
                      ? 'error'
                      : 'default'
            }
            size="small"
          />
        </Box>
      ),
    },
    {
      field: 'createdAt',
      headerName: 'Created',
      width: 150,
      headerAlign: 'center',
      align: 'center',
      renderCell: (params) => (
        <Box display="flex" alignItems="center" justifyContent="center" height="100%">
          <Typography variant="body2">{new Date(params.value).toLocaleDateString()}</Typography>
        </Box>
      ),
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 250,
      headerAlign: 'center',
      align: 'center',
      sortable: false,
      renderCell: (params: GridRenderCellParams) => (
        <Box display="flex" gap={1} justifyContent="center" alignItems="center" height="100%">
          {params.row.status === 'PENDING' && (
            <>
              <Button
                size="small"
                variant="contained"
                color="success"
                startIcon={<Check />}
                onClick={() => handleApproveRequest(params.row)}
              >
                Approve
              </Button>
              <Button
                size="small"
                variant="contained"
                color="error"
                startIcon={<Close />}
                onClick={() => handleRejectRequest(params.row)}
              >
                Reject
              </Button>
            </>
          )}
          {params.row.status !== 'PENDING' && (
            <Chip
              label={`${params.row.status.toLowerCase()}`}
              color={
                params.row.status === 'APPROVED'
                  ? 'info'
                  : params.row.status === 'SENT'
                    ? 'success'
                    : params.row.status === 'REJECTED'
                      ? 'error'
                      : 'default'
              }
              size="small"
              variant="outlined"
            />
          )}
        </Box>
      ),
    },
  ];

  const formatCurrency = (value: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(parseFloat(value));
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Transaction Management
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => dispatch(clearError())}>
          {error}
        </Alert>
      )}

      {/* Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" variant="body2">
                    Total Deposits
                  </Typography>
                  <Typography variant="h6">
                    {formatCurrency(summary?.totalDeposits ?? '0')}
                  </Typography>
                </Box>
                <TrendingUp color="success" />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" variant="body2">
                    Total Withdrawals
                  </Typography>
                  <Typography variant="h6">
                    {formatCurrency(summary?.totalWithdrawals ?? '0')}
                  </Typography>
                </Box>
                <AttachMoney color="error" />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" variant="body2">
                    Pending Count
                  </Typography>
                  <Typography variant="h6">{summary?.pendingCount ?? 0}</Typography>
                </Box>
                <Warning color="warning" />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" variant="body2">
                    Pending Value
                  </Typography>
                  <Typography variant="h6">
                    {formatCurrency(summary?.pendingValue ?? '0')}
                  </Typography>
                </Box>
                <AttachMoney color="warning" />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Tabs value={activeTab} onChange={(_, value) => setActiveTab(value)} sx={{ mb: 3 }}>
        <Tab label="All Transactions" />
        <Tab
          label={`Pending Withdrawal Requests (${withdrawRequests.length})`}
          icon={withdrawRequests.length > 0 ? <Warning color="warning" /> : undefined}
          iconPosition="end"
        />
      </Tabs>

      {activeTab === 0 ? (
        <>
          {/* Filters */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Grid container spacing={2} alignItems="center">
                <Grid size={{ xs: 12, md: 2 }}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Type</InputLabel>
                    <Select
                      value={filters.type}
                      onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                      label="Type"
                    >
                      <MenuItem value="">All</MenuItem>
                      <MenuItem value="DEPOSIT">Deposit</MenuItem>
                      <MenuItem value="WITHDRAW">Withdraw</MenuItem>
                      <MenuItem value="BET">Bet</MenuItem>
                      <MenuItem value="WIN">Win</MenuItem>
                      <MenuItem value="BONUS">Bonus</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 12, md: 2 }}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Status</InputLabel>
                    <Select
                      value={filters.status}
                      onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                      label="Status"
                    >
                      <MenuItem value="">All</MenuItem>
                      <MenuItem value="PENDING">Pending</MenuItem>
                      <MenuItem value="PROCESSING">Processing</MenuItem>
                      <MenuItem value="COMPLETED">Completed</MenuItem>
                      <MenuItem value="FAILED">Failed</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 12, md: 2 }}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Asset</InputLabel>
                    <Select
                      value={filters.asset}
                      onChange={(e) => setFilters({ ...filters, asset: e.target.value })}
                      label="Asset"
                    >
                      <MenuItem value="">All</MenuItem>
                      <MenuItem value="BTC">BTC</MenuItem>
                      <MenuItem value="ETH">ETH</MenuItem>
                      <MenuItem value="USDT">USDT</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 12, md: 2 }}>
                  <DatePicker
                    label="Start Date"
                    value={filters.startDate}
                    onChange={(value) =>
                      setFilters({ ...filters, startDate: value ? dayjs(value) : null })
                    }
                    slotProps={{ textField: { size: 'small', fullWidth: true } }}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 2 }}>
                  <DatePicker
                    label="End Date"
                    value={filters.endDate}
                    onChange={(value) =>
                      setFilters({ ...filters, endDate: value ? dayjs(value) : null })
                    }
                    slotProps={{ textField: { size: 'small', fullWidth: true } }}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 2 }}>
                  <Button
                    fullWidth
                    variant="outlined"
                    onClick={() =>
                      setFilters({
                        type: '',
                        status: '',
                        userId: '',
                        asset: '',
                        startDate: null,
                        endDate: null,
                      })
                    }
                  >
                    Clear Filters
                  </Button>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* Transactions Grid */}
          <Card>
            <Box sx={{ height: 600, width: '100%' }}>
              <DataGrid
                rows={transactions}
                columns={transactionColumns}
                rowCount={total}
                loading={loading}
                pageSizeOptions={[10, 20, 50, 100]}
                paginationModel={{ page, pageSize }}
                paginationMode="server"
                onPaginationModelChange={(model) => {
                  setPage(model.page);
                  setPageSize(model.pageSize);
                }}
                disableRowSelectionOnClick
              />
            </Box>
          </Card>
        </>
      ) : (
        /* Pending Withdrawal Requests */
        <Card>
          <CardContent>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6">Pending Withdrawal Requests</Typography>
              <Box display="flex" gap={2} alignItems="center">
                <FormControl size="small" sx={{ minWidth: 120 }}>
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value);
                      void dispatch(
                        fetchWithdrawRequests({
                          page: 1,
                          limit: 20,
                          status: e.target.value || undefined,
                        }),
                      );
                    }}
                    label="Status"
                  >
                    <MenuItem value="">All</MenuItem>
                    <MenuItem value="PENDING">Pending</MenuItem>
                    <MenuItem value="APPROVED">Approved</MenuItem>
                    <MenuItem value="SENT">Sent</MenuItem>
                    <MenuItem value="REJECTED">Rejected</MenuItem>
                  </Select>
                </FormControl>
                <Button
                  variant="outlined"
                  startIcon={<Refresh />}
                  onClick={() => {
                    void dispatch(
                      fetchWithdrawRequests({
                        page: 1,
                        limit: 20,
                        status: statusFilter || undefined,
                      }),
                    );
                  }}
                >
                  Refresh
                </Button>
              </Box>
            </Box>

            <DataGrid
              rows={withdrawRequests}
              columns={withdrawColumns}
              loading={paymentsLoading}
              pageSizeOptions={[20, 50, 100]}
              disableRowSelectionOnClick
              autoHeight
            />
          </CardContent>
        </Card>
      )}

      {/* Approve Dialog */}
      <Dialog open={approveDialog} onClose={() => setApproveDialog(false)} maxWidth="lg" fullWidth>
        <DialogTitle sx={{ color: 'success.main' }}>✅ Approve Withdrawal Request</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', gap: 3, flexDirection: { xs: 'column', md: 'row' } }}>
            {/* Left Column - Request Details */}
            <Box sx={{ flex: 1 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Request Details
              </Typography>
              <Box sx={{ mb: 2 }}>
                <Typography>
                  <strong>Request ID:</strong> {selectedRequest?.id}
                </Typography>
                <Typography>
                  <strong>User ID:</strong> {selectedRequest?.userId}
                </Typography>
                <Typography>
                  <strong>Asset:</strong> {selectedRequest?.asset}
                </Typography>
                <Typography>
                  <strong>Amount:</strong> {selectedRequest?.amount} {selectedRequest?.asset}
                </Typography>
                {selectedRequest &&
                  calculateUsdValue(selectedRequest.amount, selectedRequest.asset) && (
                    <Typography>
                      <strong>USD Value:</strong> $
                      {calculateUsdValue(
                        selectedRequest.amount,
                        selectedRequest.asset,
                      )?.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </Typography>
                  )}
                <Typography>
                  <strong>To Address:</strong> {selectedRequest?.toAddress}
                </Typography>
                <Typography>
                  <strong>Created:</strong>{' '}
                  {selectedRequest?.createdAt
                    ? new Date(selectedRequest.createdAt).toLocaleString()
                    : 'N/A'}
                </Typography>
              </Box>

              <TextField
                fullWidth
                label="Admin Comment (Optional)"
                multiline
                rows={3}
                value={approvalComment}
                onChange={(e) => setApprovalComment(e.target.value)}
                placeholder="Add any notes about this approval..."
              />
            </Box>

            {/* Right Column - User Statistics */}
            <Box sx={{ flex: 1 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                User Information
              </Typography>

              {paymentsLoading && <CircularProgress size={24} />}

              {userStatistics && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
                    Account Information
                  </Typography>
                  <Typography variant="body2">
                    Registration: {new Date(userStatistics.registrationDate).toLocaleDateString()}
                  </Typography>
                  <Typography variant="body2">
                    Last Activity: {new Date(userStatistics.lastActivity).toLocaleDateString()}
                  </Typography>
                  <Typography variant="body2">
                    Account Age:{' '}
                    {Math.floor(
                      (Date.now() - new Date(userStatistics.registrationDate).getTime()) /
                        (1000 * 60 * 60 * 24),
                    )}{' '}
                    days
                  </Typography>
                </Box>
              )}

              {userBalanceStatistics && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
                    Balance Statistics (USD)
                  </Typography>
                  <Typography variant="body2">
                    Total Deposits: {formatUsdAmount(userBalanceStatistics.deps)}
                  </Typography>
                  <Typography variant="body2">
                    Total Withdrawals: {formatUsdAmount(userBalanceStatistics.withs)}
                  </Typography>
                  <Typography variant="body2">
                    Total Bets: {formatUsdAmount(userBalanceStatistics.bets)}
                  </Typography>
                  <Typography variant="body2">
                    Total Wins: {formatUsdAmount(userBalanceStatistics.wins)}
                  </Typography>
                  <Typography variant="body2">
                    Total Refunds: {formatUsdAmount(userBalanceStatistics.refunds)}
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 'bold', mt: 1 }}>
                    Net Gaming:{' '}
                    {formatUsdAmount(
                      (
                        parseFloat(userBalanceStatistics.wins) -
                        parseFloat(userBalanceStatistics.bets)
                      ).toString(),
                    )}
                  </Typography>
                </Box>
              )}

              {userStatistics && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
                    Transaction History
                  </Typography>
                  <Typography variant="body2">
                    Total Deposits: {userStatistics.totalDeposits}
                  </Typography>
                  <Typography variant="body2">
                    Total Withdrawals: {userStatistics.totalWithdrawals}
                  </Typography>
                  <Typography variant="body2">
                    Pending Withdrawals: {userStatistics.pendingWithdrawals}
                  </Typography>
                </Box>
              )}

              {/* Risk Assessment */}
              {userStatistics && (
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
                    Risk Assessment
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {userStatistics.pendingWithdrawals > 2 && (
                      <Chip label="High Pending Requests" color="error" size="small" />
                    )}
                    {userStatistics.totalWithdrawals === 0 && (
                      <Chip label="First Withdrawal" color="warning" size="small" />
                    )}
                    {Math.floor(
                      (Date.now() - new Date(userStatistics.registrationDate).getTime()) /
                        (1000 * 60 * 60 * 24),
                    ) < 7 && <Chip label="New Account" color="warning" size="small" />}
                    {userStatistics.totalDeposits === 0 && (
                      <Chip label="No Deposits" color="error" size="small" />
                    )}
                  </Box>
                </Box>
              )}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setApproveDialog(false);
              setSelectedRequest(null);
              setApprovalComment('');
              dispatch(clearUserStatistics());
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="success"
            onClick={() => {
              void handleConfirmApprove();
            }}
            disabled={paymentsLoading}
          >
            {paymentsLoading ? <CircularProgress size={20} /> : 'Approve Withdrawal'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectDialog} onClose={() => setRejectDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ color: 'error.main' }}>❌ Reject Withdrawal Request</DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
            <Typography variant="subtitle2" gutterBottom>
              Request Details:
            </Typography>
            <Typography variant="body2" gutterBottom>
              <strong>Request ID:</strong> {selectedRequest?.id}
            </Typography>
            <Typography variant="body2" gutterBottom>
              <strong>User ID:</strong> {selectedRequest?.userId}
            </Typography>
            <Typography variant="body2" gutterBottom>
              <strong>Amount:</strong> {selectedRequest?.amount} {selectedRequest?.asset}
            </Typography>
            <Typography variant="body2" gutterBottom>
              <strong>To Address:</strong>
              <Typography component="span" fontFamily="monospace" sx={{ ml: 1 }}>
                {selectedRequest?.toAddress}
              </Typography>
            </Typography>
            <Typography variant="body2" gutterBottom>
              <strong>Created:</strong>{' '}
              {selectedRequest?.createdAt
                ? new Date(selectedRequest.createdAt).toLocaleString()
                : 'N/A'}
            </Typography>
          </Box>
          <TextField
            fullWidth
            label="Rejection Reason *"
            multiline
            rows={4}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Please provide a clear reason for rejecting this withdrawal request..."
            required
            error={rejectReason.length > 0 && rejectReason.trim().length < 10}
            helperText={
              rejectReason.length > 0 && rejectReason.trim().length < 10
                ? 'Please provide a more detailed reason (at least 10 characters)'
                : 'This reason will be shown to the user'
            }
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => {
              void handleConfirmReject();
            }}
            disabled={!rejectReason.trim() || rejectReason.trim().length < 10}
          >
            Reject Withdrawal
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Transactions;
