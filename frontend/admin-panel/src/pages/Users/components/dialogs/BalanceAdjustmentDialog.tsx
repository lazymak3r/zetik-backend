import {
  Alert,
  Box,
  Button,
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
import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch } from '../../../../store';
import { fetchAssets, selectActiveAssets } from '../../../../store/payments';
import { adjustBalance } from '../../../../store/users/model/users.thunks';

interface BalanceAdjustmentDialogProps {
  open: boolean;
  onClose: () => void;
  userId: string | null;
  onSuccess: () => void;
}

const BalanceAdjustmentDialog: React.FC<BalanceAdjustmentDialogProps> = ({
  open,
  onClose,
  userId,
  onSuccess,
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const activeAssets = useSelector(selectActiveAssets);
  const [asset, setAsset] = useState(activeAssets[0]?.symbol || 'BTC');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      void dispatch(fetchAssets());
    }
  }, [open, dispatch]);

  const handleSubmit = async () => {
    if (!userId) return;

    if (!amount || parseFloat(amount) === 0) {
      setError('Amount cannot be zero');
      return;
    }

    if (!reason.trim()) {
      setError('Reason is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await dispatch(
        adjustBalance({
          userId,
          data: {
            asset,
            amount: parseFloat(amount),
            reason: reason.trim(),
          },
        }),
      ).unwrap();

      onSuccess();
      handleClose();
    } catch (err: any) {
      setError(err.message || 'Failed to adjust balance');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (activeAssets.length > 0) {
      setAsset(activeAssets[0].symbol);
    } else {
      setAsset('BTC');
    }
    setAmount('');
    setReason('');
    setError('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Adjust User Balance</DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 2 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <FormControl fullWidth margin="normal">
            <InputLabel>Asset</InputLabel>
            <Select value={asset} onChange={(e) => setAsset(e.target.value)} label="Asset">
              {activeAssets.map((activeAsset) => (
                <MenuItem key={activeAsset.symbol} value={activeAsset.symbol}>
                  {activeAsset.symbol}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            fullWidth
            margin="normal"
            label="Amount"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            helperText="Use positive number to credit, negative to debit"
            inputProps={{
              step: '0.00000001',
            }}
          />

          <TextField
            fullWidth
            margin="normal"
            label="Reason"
            multiline
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            helperText="Provide a clear reason for this adjustment"
          />

          <Alert severity="warning" sx={{ mt: 2 }}>
            <Typography variant="body2">
              This action will update the wallet balance and create a balance history record with
              your reason. It's not a real Payment transaction and won't appear in Payments, but
              will be reflected in balance statistics.
            </Typography>
          </Alert>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={() => {
            void handleSubmit();
          }}
          variant="contained"
          disabled={loading}
        >
          {loading ? 'Processing...' : 'Adjust Balance'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default BalanceAdjustmentDialog;
