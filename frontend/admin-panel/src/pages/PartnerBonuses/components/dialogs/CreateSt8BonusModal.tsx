import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
} from '@mui/material';
import Autocomplete from '@mui/material/Autocomplete';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import dayjs, { Dayjs } from 'dayjs';
import React, { memo, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useDebounce } from '../../../../hooks/useDebounce';
import { St8AvailableOffer, St8Game } from '../../../../services/st8BonusService';
import { AppDispatch, RootState } from '../../../../store';
import { fetchAvailableOffers, fetchSt8Games } from '../../../../store/st8Bonus/thunks';
import { fetchUsers } from '../../../../store/users/model/users.thunks';

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: Record<string, unknown>) => void;
  loading?: boolean;
};

const CreateSt8BonusModalComponent: React.FC<Props> = ({ open, onClose, onSubmit, loading }) => {
  const dispatch = useDispatch<AppDispatch>();

  const { games, availableOffers, offersLoading, offersError } = useSelector(
    (state: RootState) => state.st8Bonus,
  );
  const { users, loading: usersLoading } = useSelector((state: RootState) => state.users);

  const [selectedBonusType, setSelectedBonusType] = useState<
    'free_bets' | 'free_money' | 'bonus_game' | 'all'
  >('all');
  const [selectedGames, setSelectedGames] = useState<St8Game[]>([]);
  const [selectedOffer, setSelectedOffer] = useState<St8AvailableOffer | null>(null);
  const [selectedPlayers, setSelectedPlayers] = useState<
    Array<{ id: string; username?: string; email: string }>
  >([]);
  const [playerSearchTerm, setPlayerSearchTerm] = useState('');
  const [count, setCount] = useState('');
  const [startTime, setStartTime] = useState<Dayjs | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [durationUnit, setDurationUnit] = useState<'hours' | 'days'>('days');
  const [bonusId, setBonusId] = useState('');

  const debouncedSearchTerm = useDebounce(playerSearchTerm, 300);

  const filteredGames = useMemo(() => {
    return games;
  }, [games]);

  const bonusIdValidationRegex = /^[a-zA-Z0-9_-]+$/;
  const isBonusIdValid = useMemo(() => {
    if (!bonusId.trim()) return false;
    return bonusIdValidationRegex.test(bonusId);
  }, [bonusId]);

  const isValid = useMemo(() => {
    const haveCore =
      selectedGames.length > 0 && !!selectedOffer && selectedPlayers.length > 0 && isBonusIdValid;
    if (!haveCore) return false;
    if (selectedOffer?.type === 'free_bets') return !!count && Number(count) > 0;
    return true;
  }, [selectedGames, selectedOffer, selectedPlayers, count, isBonusIdValid]);

  useEffect(() => {
    if (open) {
      void dispatch(fetchSt8Games());
      setSelectedBonusType('all');
      setSelectedGames([]);
      setSelectedOffer(null);
      setSelectedPlayers([]);
      setCount('');
      setStartTime(null);
      setDuration(null);
      setDurationUnit('days');
      setBonusId('');
    }
  }, [dispatch, open]);

  useEffect(() => {
    if (selectedGames.length > 0) {
      void dispatch(
        fetchAvailableOffers({
          gameCodes: selectedGames.map((game) => game.code),
          type: selectedBonusType === 'all' ? undefined : selectedBonusType,
        }),
      );
    }
  }, [dispatch, selectedGames, selectedBonusType]);

  useEffect(() => {
    if (debouncedSearchTerm && debouncedSearchTerm.length >= 2) {
      void dispatch(
        fetchUsers({
          search: debouncedSearchTerm,
          limit: 10,
          page: 1,
        }),
      );
    }
  }, [debouncedSearchTerm, dispatch]);

  const handleSubmit = () => {
    if (!selectedGames.length || !selectedOffer) return;

    const payload: Record<string, unknown> = {
      bonus_id: bonusId.trim(),
      game_codes: selectedGames.map((game) => game.code),
      currency: selectedOffer.currency,
      value: selectedOffer.value,
      type: selectedOffer.type,
      players: selectedPlayers.map((player) => player.id),
    };
    if (selectedOffer.type === 'free_bets' && count) payload.count = Number(count);
    if (startTime) payload.start_time = startTime.toISOString();
    if (duration) {
      const durationInSeconds = durationUnit === 'hours' ? duration * 3600 : duration * 86400;
      payload.duration = durationInSeconds;
    }
    onSubmit(payload);
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
        <DialogTitle>Create ST8 Bonus</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 0.5 }}>
            <TextField
              fullWidth
              label="Bonus ID (user will see this in the game) (required)"
              value={bonusId}
              onChange={(e) => setBonusId(e.target.value)}
              placeholder="Enter unique bonus ID"
              helperText={
                !bonusId.trim()
                  ? 'Bonus ID is required'
                  : !isBonusIdValid
                    ? 'Bonus ID can only contain letters, numbers, hyphens, and underscores'
                    : ''
              }
              error={!bonusId.trim() || !isBonusIdValid}
              required
            />

            <Autocomplete
              multiple
              options={filteredGames}
              getOptionLabel={(game) =>
                `${game.name}${game.developerName ? ` · ${game.developerName}` : ''} (${game.code})`
              }
              value={selectedGames}
              onChange={(_, newValue) => {
                setSelectedGames(newValue);
                setSelectedOffer(null);
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Select Games (required)"
                  placeholder="Choose games to see available offers"
                  helperText={
                    selectedGames.length === 0
                      ? 'Select at least one game to see available bonus offers'
                      : ''
                  }
                  error={selectedGames.length === 0}
                  required
                />
              )}
            />

            {selectedGames.length > 0 && (
              <FormControl fullWidth>
                <InputLabel>Bonus Type Filter (optional)</InputLabel>
                <Select
                  value={selectedBonusType || ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    setSelectedBonusType(value);
                  }}
                  label="Bonus Type Filter (optional)"
                >
                  <MenuItem value="all">All Types</MenuItem>
                  <MenuItem value="free_bets">Free Bets</MenuItem>
                  <MenuItem value="free_money">Free Money</MenuItem>
                  <MenuItem value="bonus_game">Bonus Game</MenuItem>
                </Select>
              </FormControl>
            )}

            {selectedGames.length > 0 && (
              <Box>
                {offersLoading ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 2 }}>
                    <CircularProgress size={20} />
                    <TextField
                      fullWidth
                      label="Loading available offers..."
                      disabled
                      helperText="Fetching available bonus offers for selected games"
                    />
                  </Box>
                ) : offersError ? (
                  <TextField
                    fullWidth
                    label="Error loading offers"
                    error
                    helperText={offersError}
                    disabled
                  />
                ) : !Array.isArray(availableOffers) || availableOffers.length === 0 ? (
                  <TextField
                    fullWidth
                    label="No offers available"
                    helperText="No bonus offers are currently available for selected games"
                    disabled
                  />
                ) : (
                  <FormControl fullWidth>
                    <InputLabel>Available Offers</InputLabel>
                    <Select
                      value={selectedOffer ? JSON.stringify(selectedOffer) : ''}
                      onChange={(e) => {
                        const offer = JSON.parse(e.target.value) as St8AvailableOffer;
                        setSelectedOffer(offer);
                      }}
                      label="Available Offers"
                    >
                      {Array.isArray(availableOffers) &&
                        availableOffers.map((offer, index) => (
                          <MenuItem key={index} value={JSON.stringify(offer)}>
                            {offer.type}: {parseFloat(offer.value).toFixed(2)} {offer.currency}
                          </MenuItem>
                        ))}
                    </Select>
                  </FormControl>
                )}
              </Box>
            )}

            <Autocomplete
              multiple
              loading={usersLoading}
              options={users}
              getOptionLabel={(user) => `${user.username || 'No username'} (${user.email})`}
              value={selectedPlayers}
              onChange={(_, newValue) => {
                setSelectedPlayers(newValue);
              }}
              onInputChange={(_, newInputValue) => {
                setPlayerSearchTerm(newInputValue);
              }}
              renderTags={(value, getTagProps) =>
                value.map((player, index) => (
                  <Chip
                    variant="outlined"
                    label={`${player.username || 'No username'} (${player.email})`}
                    {...getTagProps({ index })}
                    key={player.id}
                  />
                ))
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Players (required)"
                  placeholder={usersLoading ? 'Searching...' : 'Search and select players'}
                  helperText={
                    selectedPlayers.length === 0 ? 'Need to select at least one player' : ''
                  }
                  error={selectedPlayers.length === 0}
                  required
                />
              )}
            />

            {selectedOffer?.type === 'free_bets' && (
              <TextField
                fullWidth
                label="Count (only for free_bets)"
                type="number"
                inputProps={{ min: 1 }}
                value={count}
                onChange={(e) => setCount(e.target.value)}
              />
            )}

            <DateTimePicker
              label="Start Time (optional)"
              value={startTime}
              onChange={(newValue) => setStartTime(newValue)}
              minDateTime={dayjs()}
              slotProps={{
                textField: {
                  fullWidth: true,
                  helperText: 'Leave empty to use current time (default).',
                },
              }}
            />

            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
              <TextField
                label="Duration (optional)"
                type="number"
                inputProps={{ min: 1 }}
                value={duration || ''}
                onChange={(e) => setDuration(e.target.value ? Number(e.target.value) : null)}
                helperText="Leave empty to use 2 weeks (default)"
                sx={{ flex: 1 }}
              />
              <FormControl sx={{ minWidth: 120 }}>
                <InputLabel>Unit</InputLabel>
                <Select
                  value={durationUnit}
                  onChange={(e) => setDurationUnit(e.target.value)}
                  label="Unit"
                >
                  <MenuItem value="hours">Hours</MenuItem>
                  <MenuItem value="days">Days</MenuItem>
                </Select>
              </FormControl>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={!!loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} variant="contained" disabled={!isValid || !!loading}>
            {loading ? 'Creating…' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </LocalizationProvider>
  );
};

export const CreateSt8BonusModal = memo(CreateSt8BonusModalComponent);
