import { Refresh } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../store';
import { clearError, createAsset, fetchAssets, updateAssetStatus } from '../store/payments';

const AVAILABLE_ASSETS = ['BTC', 'ETH', 'USDC', 'USDT', 'LTC', 'DOGE', 'TRX', 'XRP', 'SOL'];

const Payments: React.FC = () => {
  const [createAssetDialog, setCreateAssetDialog] = useState(false);
  const [newAssetSymbol, setNewAssetSymbol] = useState('');
  const [newAssetStatus, setNewAssetStatus] = useState('ACTIVE');
  const [deactivateDialog, setDeactivateDialog] = useState(false);
  const [assetToDeactivate, setAssetToDeactivate] = useState<string>('');
  const [deactivateConfirmText, setDeactivateConfirmText] = useState('');

  const dispatch = useDispatch<AppDispatch>();
  const { assets, loading, error } = useSelector((state: RootState) => state.payments);

  useEffect(() => {
    void dispatch(fetchAssets());
  }, [dispatch]);

  const handleUpdateAssetStatus = async (symbol: string, status: string) => {
    try {
      await dispatch(updateAssetStatus({ symbol, status })).unwrap();
      void dispatch(fetchAssets());
    } catch (error) {
      console.error('Failed to update asset status:', error);
    }
  };

  const handleCreateAsset = async () => {
    if (newAssetSymbol) {
      try {
        await dispatch(createAsset({ symbol: newAssetSymbol, status: newAssetStatus })).unwrap();
        setCreateAssetDialog(false);
        setNewAssetSymbol('');
        setNewAssetStatus('ACTIVE');
        void dispatch(fetchAssets());
      } catch (error) {
        console.error('Failed to create asset:', error);
      }
    }
  };

  const getAvailableAssetSymbols = () => {
    const existingSymbols = assets.map((asset) => asset.symbol);
    return AVAILABLE_ASSETS.filter((symbol) => !existingSymbols.includes(symbol));
  };

  const handleDeactivateAsset = (symbol: string) => {
    setAssetToDeactivate(symbol);
    setDeactivateConfirmText('');
    setDeactivateDialog(true);
  };

  const handleConfirmDeactivate = async () => {
    const expectedText = `deactivate_${assetToDeactivate}`;
    if (deactivateConfirmText === expectedText) {
      try {
        await dispatch(
          updateAssetStatus({ symbol: assetToDeactivate, status: 'INACTIVE' }),
        ).unwrap();
        setDeactivateDialog(false);
        setAssetToDeactivate('');
        setDeactivateConfirmText('');
        void dispatch(fetchAssets());
      } catch (error) {
        console.error('Failed to deactivate asset:', error);
      }
    }
  };

  const assetColumns: GridColDef[] = [
    { field: 'symbol', headerName: 'Symbol', width: 100 },
    {
      field: 'status',
      headerName: 'Status',
      width: 150,
      renderCell: (params: GridRenderCellParams) => (
        <Chip
          label={params.value}
          color={
            params.value === 'ACTIVE'
              ? 'success'
              : params.value === 'MAINTENANCE'
                ? 'warning'
                : 'error'
          }
          size="small"
        />
      ),
    },
    {
      field: 'createdAt',
      headerName: 'Created',
      width: 150,
      renderCell: (params) => new Date(params.value).toLocaleDateString(),
    },
    {
      field: 'updatedAt',
      headerName: 'Updated',
      width: 150,
      renderCell: (params) => new Date(params.value).toLocaleDateString(),
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 200,
      sortable: false,
      renderCell: (params: GridRenderCellParams) => (
        <Box display="flex" gap={1}>
          <Button
            size="small"
            variant="outlined"
            color="success"
            onClick={() => {
              void handleUpdateAssetStatus(params.row.symbol, 'ACTIVE');
            }}
            disabled={params.row.status === 'ACTIVE'}
          >
            Activate
          </Button>
          <Button
            size="small"
            variant="outlined"
            color="error"
            onClick={() => handleDeactivateAsset(params.row.symbol)}
            disabled={params.row.status === 'INACTIVE'}
          >
            Deactivate
          </Button>
        </Box>
      ),
    },
  ];

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Crypto Assets Management
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => dispatch(clearError())}>
          {error}
        </Alert>
      )}

      <Card>
        <Box sx={{ p: 3 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">Crypto Assets Management</Typography>
            <Box display="flex" gap={1}>
              <Button
                variant="contained"
                color="primary"
                onClick={() => setCreateAssetDialog(true)}
                disabled={getAvailableAssetSymbols().length === 0}
              >
                Add Asset
              </Button>
              <Button
                variant="outlined"
                startIcon={<Refresh />}
                onClick={() => {
                  void dispatch(fetchAssets());
                }}
              >
                Refresh
              </Button>
            </Box>
          </Box>

          <DataGrid
            rows={assets}
            columns={assetColumns}
            loading={loading}
            pageSizeOptions={[10, 20, 50]}
            disableRowSelectionOnClick
            autoHeight
            getRowId={(row) => row.symbol}
          />
        </Box>
      </Card>

      {/* Create Asset Dialog */}
      <Dialog
        open={createAssetDialog}
        onClose={() => setCreateAssetDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Create New Asset</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel>Asset Symbol</InputLabel>
            <Select
              value={newAssetSymbol}
              onChange={(e) => setNewAssetSymbol(e.target.value)}
              label="Asset Symbol"
            >
              {getAvailableAssetSymbols().map((symbol) => (
                <MenuItem key={symbol} value={symbol}>
                  {symbol}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel>Initial Status</InputLabel>
            <Select
              value={newAssetStatus}
              onChange={(e) => setNewAssetStatus(e.target.value)}
              label="Initial Status"
            >
              <MenuItem value="ACTIVE">Active</MenuItem>
              <MenuItem value="INACTIVE">Inactive</MenuItem>
              <MenuItem value="MAINTENANCE">Maintenance</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateAssetDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="primary"
            onClick={() => {
              void handleCreateAsset();
            }}
            disabled={!newAssetSymbol}
          >
            Create Asset
          </Button>
        </DialogActions>
      </Dialog>

      {/* Deactivate Asset Confirmation Dialog */}
      <Dialog
        open={deactivateDialog}
        onClose={() => setDeactivateDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ color: 'error.main' }}>⚠️ Deactivate Asset</DialogTitle>
        <DialogContent>
          <Typography variant="body1" gutterBottom>
            You are about to <strong>deactivate</strong> the asset{' '}
            <strong>{assetToDeactivate}</strong>.
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            This will prevent users from making deposits and withdrawals with this asset.
          </Typography>
          <Typography variant="body2" color="error.main" gutterBottom sx={{ mt: 2 }}>
            To confirm this dangerous action, please type:{' '}
            <strong>deactivate_{assetToDeactivate}</strong>
          </Typography>
          <TextField
            fullWidth
            label={`Type "deactivate_${assetToDeactivate}" to confirm`}
            value={deactivateConfirmText}
            onChange={(e) => setDeactivateConfirmText(e.target.value)}
            sx={{ mt: 2 }}
            error={
              deactivateConfirmText.length > 0 &&
              deactivateConfirmText !== `deactivate_${assetToDeactivate}`
            }
            helperText={
              deactivateConfirmText.length > 0 &&
              deactivateConfirmText !== `deactivate_${assetToDeactivate}`
                ? 'Text does not match'
                : ''
            }
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeactivateDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => {
              void handleConfirmDeactivate();
            }}
            disabled={deactivateConfirmText !== `deactivate_${assetToDeactivate}`}
          >
            Deactivate Asset
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Payments;
