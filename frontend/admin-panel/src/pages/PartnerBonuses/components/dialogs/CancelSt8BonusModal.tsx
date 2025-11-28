import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Stack,
  Typography,
} from '@mui/material';
import Autocomplete from '@mui/material/Autocomplete';
import Chip from '@mui/material/Chip';
import TextField from '@mui/material/TextField';
import React, { memo, useEffect, useState } from 'react';
import { St8LocalBonus } from '../../../../services/st8BonusService';

type Props = {
  open: boolean;
  onClose: () => void;
  bonus: St8LocalBonus | null;
  onSubmit: (bonusId: string, players?: string[]) => void;
  loading?: boolean;
};

const CancelSt8BonusModalComponent: React.FC<Props> = ({
  open,
  onClose,
  bonus,
  onSubmit,
  loading,
}) => {
  const [cancelForAll, setCancelForAll] = useState(true);
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      setCancelForAll(true);
      setSelectedPlayers([]);
    }
  }, [open]);

  const handleSubmit = () => {
    if (!bonus) return;

    const playersToCancel = cancelForAll ? undefined : selectedPlayers;
    onSubmit(bonus.bonus_id, playersToCancel);
  };

  const isValid = cancelForAll || selectedPlayers.length > 0;

  if (!bonus) return null;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Cancel ST8 Bonus</DialogTitle>
      <DialogContent>
        <Stack spacing={3} sx={{ mt: 1 }}>
          <Box>
            <Typography variant="h6" gutterBottom>
              Bonus Information
            </Typography>
            <Stack spacing={1}>
              <Typography variant="body2">
                <strong>Games:</strong> {bonus.gameCodes?.join(', ') || 'None'}
              </Typography>
              <Typography variant="body2">
                <strong>Type:</strong> {bonus.type}
              </Typography>
              <Typography variant="body2">
                <strong>Value:</strong> {bonus.value} {bonus.currency}
              </Typography>
              <Typography variant="body2">
                <strong>Players:</strong> {bonus.players?.length || 0}
              </Typography>
            </Stack>
          </Box>

          <FormControlLabel
            control={
              <Checkbox
                checked={cancelForAll}
                onChange={(e) => setCancelForAll(e.target.checked)}
              />
            }
            label="Cancel for all players"
          />

          {!cancelForAll && (
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Select specific players to cancel bonus for:
              </Typography>

              <Autocomplete
                multiple
                options={bonus.players || []}
                getOptionLabel={(playerId) => `Player ID: ${playerId}`}
                value={selectedPlayers}
                onChange={(_, newValue) => {
                  setSelectedPlayers(newValue);
                }}
                renderTags={(value, getTagProps) =>
                  value.map((playerId, index) => (
                    <Chip
                      variant="outlined"
                      label={`ID: ${playerId}`}
                      {...getTagProps({ index })}
                      key={playerId}
                    />
                  ))
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Select players"
                    placeholder="Choose players to cancel bonus for"
                    helperText={selectedPlayers.length === 0 ? 'Select at least one player' : ''}
                    error={selectedPlayers.length === 0}
                  />
                )}
              />
            </Box>
          )}

          {!cancelForAll && selectedPlayers.length === 0 && (
            <Alert severity="warning">
              Please select at least one player to cancel the bonus for.
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={!!loading}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          color="error"
          disabled={!isValid || !!loading}
        >
          {loading ? 'Cancelling...' : 'Confirm Cancel'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export const CancelSt8BonusModal = memo(CancelSt8BonusModalComponent);
