import { Cancel, CheckCircle, Close } from '@mui/icons-material';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  TextField,
  Typography,
} from '@mui/material';
import React from 'react';
import { SeedPair } from '../../types/provably-fair.types';

interface ViewSeedPairDialogProps {
  open: boolean;
  onClose: () => void;
  seedPair: SeedPair | null;
}

const ViewSeedPairDialog: React.FC<ViewSeedPairDialogProps> = ({ open, onClose, seedPair }) => {
  if (!seedPair) return null;

  const formatDate = (date: string | Date): string => {
    return new Date(date).toLocaleString();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box display="flex" alignItems="center" gap={2}>
            <Typography variant="h6">Seed Pair Details</Typography>
            <Chip
              label={seedPair.isActive ? 'Active' : 'Inactive'}
              color={seedPair.isActive ? 'success' : 'default'}
              size="small"
              icon={seedPair.isActive ? <CheckCircle /> : <Cancel />}
            />
          </Box>
          <IconButton onClick={onClose} size="small">
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        <Grid container spacing={2}>
          <Grid size={12}>
            <Typography variant="subtitle2" color="textSecondary" gutterBottom>
              Seed Pair ID
            </Typography>
            <Typography
              variant="body1"
              sx={{ fontFamily: 'monospace', fontSize: '0.95rem' }}
              gutterBottom
            >
              {seedPair.id}
            </Typography>
          </Grid>

          <Grid size={12}>
            <Typography variant="subtitle2" color="textSecondary" gutterBottom>
              User ID
            </Typography>
            <Typography
              variant="body1"
              sx={{ fontFamily: 'monospace', fontSize: '0.95rem' }}
              gutterBottom
            >
              {seedPair.userId}
            </Typography>
          </Grid>

          <Grid size={12}>
            <TextField
              label="Server Seed"
              value={seedPair.serverSeed}
              fullWidth
              InputProps={{
                readOnly: true,
                style: { fontFamily: 'monospace', fontSize: '0.9rem' },
              }}
              multiline
            />
          </Grid>

          <Grid size={12}>
            <TextField
              label="Server Seed Hash"
              value={seedPair.serverSeedHash}
              fullWidth
              InputProps={{
                readOnly: true,
                style: { fontFamily: 'monospace', fontSize: '0.9rem', color: '#666' },
              }}
              multiline
            />
          </Grid>

          <Grid size={12}>
            <TextField
              label="Client Seed"
              value={seedPair.clientSeed}
              fullWidth
              InputProps={{
                readOnly: true,
              }}
            />
          </Grid>

          <Grid size={12}>
            <TextField
              label="Nonce"
              value={seedPair.nonce}
              fullWidth
              InputProps={{
                readOnly: true,
              }}
              helperText="Number of bets placed with this seed pair"
            />
          </Grid>

          <Grid size={12}>
            <TextField
              label="Next Server Seed"
              value={seedPair.nextServerSeed}
              fullWidth
              InputProps={{
                readOnly: true,
                style: { fontFamily: 'monospace', fontSize: '0.9rem' },
              }}
              multiline
            />
          </Grid>

          <Grid size={12}>
            <TextField
              label="Next Server Seed Hash"
              value={seedPair.nextServerSeedHash}
              fullWidth
              InputProps={{
                readOnly: true,
                style: { fontFamily: 'monospace', fontSize: '0.9rem', color: '#666' },
              }}
              multiline
            />
          </Grid>

          <Grid size={6}>
            <Typography variant="subtitle2" color="textSecondary" gutterBottom>
              Created At
            </Typography>
            <Typography variant="body1">{formatDate(seedPair.createdAt)}</Typography>
          </Grid>

          <Grid size={6}>
            <Typography variant="subtitle2" color="textSecondary" gutterBottom>
              Updated At
            </Typography>
            <Typography variant="body1">{formatDate(seedPair.updatedAt)}</Typography>
          </Grid>

          <Grid size={12}>
            <Typography variant="subtitle2" color="textSecondary" gutterBottom>
              Status
            </Typography>
            <Chip
              label={seedPair.isActive ? 'Active - In Use' : 'Inactive - Revealed'}
              color={seedPair.isActive ? 'success' : 'default'}
              icon={seedPair.isActive ? <CheckCircle /> : <Cancel />}
            />
          </Grid>
        </Grid>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default ViewSeedPairDialog;
