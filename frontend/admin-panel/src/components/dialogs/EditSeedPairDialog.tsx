import { Close, Warning } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  TextField,
  Typography,
} from '@mui/material';
import React, { useEffect, useState } from 'react';
import { provablyFairService } from '../../services/provablyFairService';
import { SeedPair, UpdateSeedPairDto } from '../../types/provably-fair.types';

interface EditSeedPairDialogProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  seedPair: SeedPair | null;
  onSuccess: () => void;
}

const EditSeedPairDialog: React.FC<EditSeedPairDialogProps> = ({
  open,
  onClose,
  userId,
  seedPair,
  onSuccess,
}) => {
  const [formData, setFormData] = useState<UpdateSeedPairDto>({
    serverSeed: '',
    clientSeed: '',
    nonce: 0,
    nextServerSeed: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [nextServerSeedHash, setNextServerSeedHash] = useState('');

  // Initialize form data when dialog opens
  useEffect(() => {
    if (open && seedPair) {
      setFormData({
        serverSeed: seedPair.serverSeed,
        clientSeed: seedPair.clientSeed,
        nonce: seedPair.nonce,
        nextServerSeed: seedPair.nextServerSeed,
      });
      setError(null);
      setValidationErrors({});
    }
  }, [open, seedPair]);

  // Calculate hash whenever nextServerSeed changes
  useEffect(() => {
    if (formData.nextServerSeed) {
      void calculateNextServerSeedHash(formData.nextServerSeed).then(setNextServerSeedHash);
    } else {
      setNextServerSeedHash('');
    }
  }, [formData.nextServerSeed]);

  // Calculate next server seed hash when next server seed changes
  const calculateNextServerSeedHash = async (seed: string): Promise<string> => {
    if (!seed || seed.length !== 64) return '';
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(seed);
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch {
      return '';
    }
  };

  const handleChange = (field: keyof UpdateSeedPairDto, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear validation error for this field
    if (validationErrors[field]) {
      setValidationErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    // Validate server seed (64-char hex)
    if (formData.serverSeed) {
      if (formData.serverSeed.length !== 64) {
        errors.serverSeed = 'Server seed must be exactly 64 characters';
      } else if (!/^[a-f0-9]{64}$/i.test(formData.serverSeed)) {
        errors.serverSeed = 'Server seed must be a valid hexadecimal string';
      }
    }

    // Validate next server seed (64-char hex)
    if (formData.nextServerSeed) {
      if (formData.nextServerSeed.length !== 64) {
        errors.nextServerSeed = 'Next server seed must be exactly 64 characters';
      } else if (!/^[a-f0-9]{64}$/i.test(formData.nextServerSeed)) {
        errors.nextServerSeed = 'Next server seed must be a valid hexadecimal string';
      }
    }

    // Validate client seed
    if (formData.clientSeed !== undefined && !formData.clientSeed.trim()) {
      errors.clientSeed = 'Client seed cannot be empty';
    }

    // Validate nonce
    if (formData.nonce !== undefined && formData.nonce < 0) {
      errors.nonce = 'Nonce must be non-negative';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!seedPair) return;

    if (!validate()) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Only send fields that have changed
      const updates: UpdateSeedPairDto = {};
      if (formData.serverSeed !== seedPair.serverSeed) {
        updates.serverSeed = formData.serverSeed;
      }
      if (formData.clientSeed !== seedPair.clientSeed) {
        updates.clientSeed = formData.clientSeed;
      }
      if (formData.nonce !== seedPair.nonce) {
        updates.nonce = formData.nonce;
      }
      if (formData.nextServerSeed !== seedPair.nextServerSeed) {
        updates.nextServerSeed = formData.nextServerSeed;
      }

      await provablyFairService.updateSeedPair(userId, Number(seedPair.id), updates);
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update seed pair');
    } finally {
      setLoading(false);
    }
  };

  if (!seedPair) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">Edit Seed Pair #{seedPair.id}</Typography>
          <IconButton onClick={onClose} size="small">
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        <Alert severity="warning" icon={<Warning />} sx={{ mb: 3 }}>
          <Typography variant="body2">
            <strong>ADMIN ONLY:</strong> Changing these values will affect future game outcomes.
            Only modify for testing purposes.
          </Typography>
        </Alert>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Box display="flex" flexDirection="column" gap={2}>
          <TextField
            label="Server Seed"
            value={formData.serverSeed}
            onChange={(e) => handleChange('serverSeed', e.target.value)}
            fullWidth
            error={!!validationErrors.serverSeed}
            helperText={validationErrors.serverSeed || '64-character hexadecimal string'}
            inputProps={{
              style: { fontFamily: 'monospace', fontSize: '0.9rem' },
              maxLength: 64,
            }}
          />

          <TextField
            label="Server Seed Hash (Auto-calculated)"
            value={seedPair.serverSeedHash}
            fullWidth
            disabled
            InputProps={{
              readOnly: true,
              style: { fontFamily: 'monospace', fontSize: '0.9rem', color: '#666' },
            }}
          />

          <TextField
            label="Client Seed"
            value={formData.clientSeed}
            onChange={(e) => handleChange('clientSeed', e.target.value)}
            fullWidth
            error={!!validationErrors.clientSeed}
            helperText={validationErrors.clientSeed || 'User-provided client seed'}
          />

          <TextField
            label="Nonce"
            type="number"
            value={formData.nonce}
            onChange={(e) => handleChange('nonce', parseInt(e.target.value) || 0)}
            fullWidth
            error={!!validationErrors.nonce}
            helperText={validationErrors.nonce || 'Number of bets placed with this seed pair'}
            inputProps={{ min: 0, step: 1 }}
          />

          <TextField
            label="Next Server Seed"
            value={formData.nextServerSeed}
            onChange={(e) => handleChange('nextServerSeed', e.target.value)}
            fullWidth
            error={!!validationErrors.nextServerSeed}
            helperText={validationErrors.nextServerSeed || '64-character hexadecimal string'}
            inputProps={{
              style: { fontFamily: 'monospace', fontSize: '0.9rem' },
              maxLength: 64,
            }}
          />

          <TextField
            label="Next Server Seed Hash (Auto-calculated)"
            value={nextServerSeedHash}
            fullWidth
            disabled
            InputProps={{
              readOnly: true,
              style: { fontFamily: 'monospace', fontSize: '0.9rem', color: '#666' },
            }}
            helperText="Automatically calculated from next server seed"
          />
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={() => {
            void handleSubmit();
          }}
          variant="contained"
          disabled={loading || Object.keys(validationErrors).length > 0}
        >
          {loading ? 'Saving...' : 'Save Changes'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EditSeedPairDialog;
