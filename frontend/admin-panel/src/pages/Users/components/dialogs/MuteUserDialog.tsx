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
} from '@mui/material';
import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '../../../../store';
import { muteUser } from '../../../../store/users/model/users.thunks';

interface MuteUserDialogProps {
  open: boolean;
  onClose: () => void;
  userId: string | null;
  onSuccess: () => void;
}

const MuteUserDialog: React.FC<MuteUserDialogProps> = ({ open, onClose, userId, onSuccess }) => {
  const dispatch = useDispatch<AppDispatch>();
  const [duration, setDuration] = useState('');
  const [durationUnit, setDurationUnit] = useState<'minutes' | 'hours' | 'days'>('hours');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const convertToMinutes = (value: number, unit: 'minutes' | 'hours' | 'days'): number => {
    switch (unit) {
      case 'minutes':
        return value;
      case 'hours':
        return value * 60;
      case 'days':
        return value * 24 * 60;
      default:
        return value;
    }
  };

  const handleSubmit = async () => {
    if (!userId) return;

    if (!duration || parseFloat(duration) <= 0) {
      setError('Duration must be greater than 0');
      return;
    }

    if (!reason.trim()) {
      setError('Reason is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const durationMinutes = convertToMinutes(parseFloat(duration), durationUnit);
      await dispatch(
        muteUser({
          userId,
          durationMinutes,
          reason: reason.trim(),
        }),
      ).unwrap();

      onSuccess();
      handleClose();
    } catch (err: any) {
      setError(err.message || 'Failed to mute user');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setDuration('');
    setDurationUnit('hours');
    setReason('');
    setError('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Mute User</DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 2 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <TextField
              fullWidth
              label="Duration"
              type="number"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              inputProps={{
                min: 1,
                step: 1,
              }}
              helperText="Enter duration value"
            />
            <FormControl sx={{ minWidth: 120 }}>
              <InputLabel>Unit</InputLabel>
              <Select
                value={durationUnit}
                onChange={(e) => setDurationUnit(e.target.value as any)}
                label="Unit"
              >
                <MenuItem value="minutes">Minutes</MenuItem>
                <MenuItem value="hours">Hours</MenuItem>
                <MenuItem value="days">Days</MenuItem>
              </Select>
            </FormControl>
          </Box>

          <TextField
            fullWidth
            margin="normal"
            label="Reason"
            multiline
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            helperText="Provide a clear reason for muting this user"
            required
          />
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
          {loading ? 'Processing...' : 'Mute User'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default MuteUserDialog;
