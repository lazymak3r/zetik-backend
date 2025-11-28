import { CheckCircle, Close, FiberManualRecord, Warning } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  TextField,
  Typography,
} from '@mui/material';
import React, { useState } from 'react';
import { provablyFairService } from '../../services/provablyFairService';

interface RotateSeedPairDialogProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  onSuccess: () => void;
}

const RotateSeedPairDialog: React.FC<RotateSeedPairDialogProps> = ({
  open,
  onClose,
  userId,
  onSuccess,
}) => {
  const [clientSeed, setClientSeed] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleClientSeedChange = (value: string) => {
    setClientSeed(value);
    if (validationError) {
      setValidationError(null);
    }
  };

  const validate = (): boolean => {
    if (!clientSeed.trim()) {
      setValidationError('Client seed is required');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validate()) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await provablyFairService.rotateSeedPair(userId, clientSeed);
      onSuccess();
      onClose();
      // Reset form
      setClientSeed('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rotate seed pair');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setClientSeed('');
      setError(null);
      setValidationError(null);
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">Rotate Seed Pair</Typography>
          <IconButton onClick={handleClose} size="small" disabled={loading}>
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        <Alert severity="warning" icon={<Warning />} sx={{ mb: 3 }}>
          <Typography variant="body2">
            <strong>WARNING:</strong> This will deactivate the current seed pair and create a new
            one. This action cannot be undone.
          </Typography>
        </Alert>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            What will happen:
          </Typography>
          <List dense>
            <ListItem>
              <ListItemIcon sx={{ minWidth: 36 }}>
                <FiberManualRecord sx={{ fontSize: 8 }} />
              </ListItemIcon>
              <ListItemText primary="Current seed pair will be deactivated" />
            </ListItem>
            <ListItem>
              <ListItemIcon sx={{ minWidth: 36 }}>
                <FiberManualRecord sx={{ fontSize: 8 }} />
              </ListItemIcon>
              <ListItemText primary="Current server seed will be revealed" />
            </ListItem>
            <ListItem>
              <ListItemIcon sx={{ minWidth: 36 }}>
                <CheckCircle sx={{ fontSize: 16, color: 'success.main' }} />
              </ListItemIcon>
              <ListItemText primary="New seed pair will be generated and activated" />
            </ListItem>
            <ListItem>
              <ListItemIcon sx={{ minWidth: 36 }}>
                <CheckCircle sx={{ fontSize: 16, color: 'success.main' }} />
              </ListItemIcon>
              <ListItemText primary="User can verify previous game results" />
            </ListItem>
          </List>
        </Box>

        <TextField
          label="Client Seed for New Seed Pair"
          value={clientSeed}
          onChange={(e) => handleClientSeedChange(e.target.value)}
          fullWidth
          error={!!validationError}
          helperText={validationError || 'Enter a client seed for the new seed pair'}
          placeholder="e.g., my-new-client-seed"
          autoFocus
        />
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
          color="warning"
          disabled={loading || !clientSeed.trim()}
        >
          {loading ? 'Rotating...' : 'Confirm Rotation'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default RotateSeedPairDialog;
