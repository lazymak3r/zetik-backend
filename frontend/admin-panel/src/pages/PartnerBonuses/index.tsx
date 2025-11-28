import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  MenuItem,
  Alert as MuiAlert,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useDebounce } from '../../hooks/useDebounce';
import { St8LocalBonus } from '../../services/st8BonusService';
import { AppDispatch, RootState } from '../../store';
import { cancelSt8Bonus, createSt8Bonus, fetchLocalSt8Bonuses } from '../../store/st8Bonus/thunks';
import { parseErrorMessage } from '../../utils/parseError';
import { CancelSt8BonusModal, CreateSt8BonusModal, ViewSt8BonusModal } from './components/dialogs';

const PartnerBonuses: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { localBonuses, localLoading, localError, creating, cancelling } = useSelector(
    (s: RootState) => s.st8Bonus,
  );
  const [openCreate, setOpenCreate] = React.useState(false);
  const [gameCodes, setGameCodes] = React.useState<string>('');
  const [currency, setCurrency] = React.useState<string>('');
  const [typeFilter, setTypeFilter] = React.useState<
    'free_bets' | 'free_money' | 'bonus_game' | ''
  >('');
  const [statusFilter, setStatusFilter] = React.useState<
    'processing' | 'finished' | 'error' | 'canceled' | 'expired' | ''
  >('');
  const [viewId, setViewId] = React.useState<string | null>(null);
  const [cancelBonusId, setCancelBonusId] = React.useState<string | null>(null);
  const [cancelBonus, setCancelBonus] = React.useState<St8LocalBonus | null>(null);
  const [snack, setSnack] = React.useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({ open: false, message: '', severity: 'success' });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'finished':
        return 'success';
      case 'processing':
        return 'warning';
      case 'error':
        return 'error';
      case 'canceled':
        return 'default';
      case 'expired':
        return 'error';
      default:
        return 'default';
    }
  };

  useEffect(() => {
    void dispatch(fetchLocalSt8Bonuses({}));
  }, [dispatch]);

  const debouncedGameCodes = useDebounce(gameCodes, 500);
  const debouncedCurrency = useDebounce(currency, 500);

  useEffect(() => {
    const filters = {
      gameCode: debouncedGameCodes || undefined,
      currency: debouncedCurrency || undefined,
      type: (typeFilter as 'free_bets' | 'free_money' | 'bonus_game') || undefined,
      status:
        (statusFilter as 'processing' | 'finished' | 'error' | 'canceled' | 'expired') || undefined,
    };

    void dispatch(fetchLocalSt8Bonuses(filters));
  }, [debouncedGameCodes, debouncedCurrency, typeFilter, statusFilter, dispatch]);

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Partner Bonuses
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button
            onClick={() => {
              const refreshFilters = {
                gameCode: gameCodes || undefined,
                type: typeFilter || undefined,
                currency: currency || undefined,
                status: statusFilter || undefined,
              };
              void dispatch(fetchLocalSt8Bonuses(refreshFilters));
            }}
            variant="outlined"
          >
            Refresh
          </Button>
          <Button onClick={() => setOpenCreate(true)} variant="contained" disabled={creating}>
            {creating ? 'Creating…' : 'Create Bonus'}
          </Button>
        </Stack>
      </Box>

      <Card>
        <CardContent>
          <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
            <TextField
              label="Game Code"
              size="small"
              value={gameCodes}
              onChange={(e) => setGameCodes(e.target.value)}
              sx={{ minWidth: 200 }}
            />
            <TextField
              label="Currency"
              size="small"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              sx={{ minWidth: 120 }}
            />
            <TextField
              select
              label="Type"
              size="small"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              sx={{ minWidth: 180 }}
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="free_bets">free_bets</MenuItem>
              <MenuItem value="free_money">free_money</MenuItem>
              <MenuItem value="bonus_game">bonus_game</MenuItem>
            </TextField>
            <TextField
              select
              label="Status"
              size="small"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              sx={{ minWidth: 150 }}
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="processing">Processing</MenuItem>
              <MenuItem value="finished">Finished</MenuItem>
              <MenuItem value="error">Error</MenuItem>
              <MenuItem value="canceled">Canceled</MenuItem>
              <MenuItem value="expired">Expired</MenuItem>
            </TextField>
          </Stack>
          {localLoading ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CircularProgress size={20} />
              <Typography variant="body2">Loading bonuses…</Typography>
            </Box>
          ) : localError ? (
            <Alert severity="error">{localError}</Alert>
          ) : (
            <Box>
              <Typography variant="h6" sx={{ mb: 2 }}>
                ST8 Bonuses ({Array.isArray(localBonuses) ? localBonuses.length : 0} total)
              </Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>ID</TableCell>
                    <TableCell>Game</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Value</TableCell>
                    <TableCell>Currency</TableCell>
                    <TableCell>Players</TableCell>
                    <TableCell>Created</TableCell>
                    <TableCell align="right">actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {!Array.isArray(localBonuses) || localBonuses.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9}>
                        <Typography variant="body2" color="text.secondary">
                          {!Array.isArray(localBonuses)
                            ? 'Error: Invalid data format'
                            : 'No bonuses found'}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    localBonuses.map((bonus: St8LocalBonus) => (
                      <TableRow key={bonus.bonus_id} hover>
                        <TableCell>{bonus.bonus_id.slice(0, 8)}...</TableCell>
                        <TableCell>
                          <Box>
                            <Typography variant="body2" fontWeight="medium" sx={{ mb: 0.5 }}>
                              Games ({bonus.gameCodes?.length || 0})
                            </Typography>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                              {(bonus.gameCodes || []).map((gameCode, index) => (
                                <Chip
                                  key={index}
                                  label={gameCode}
                                  size="small"
                                  variant="outlined"
                                  sx={{ fontSize: '0.75rem' }}
                                />
                              ))}
                            </Box>
                          </Box>
                        </TableCell>
                        <TableCell>{bonus.type}</TableCell>
                        <TableCell>
                          <Chip
                            label={bonus.status}
                            color={getStatusColor(bonus.status) as any}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>{parseFloat(bonus.value).toFixed(2)}</TableCell>
                        <TableCell>{bonus.currency}</TableCell>
                        <TableCell>{bonus.players?.length || 0}</TableCell>
                        <TableCell>{new Date(bonus.createdAt).toLocaleDateString()}</TableCell>
                        <TableCell align="right">
                          <Stack direction="row" spacing={1} justifyContent="flex-end">
                            <Button
                              size="small"
                              variant="text"
                              onClick={() => {
                                setViewId(bonus.bonus_id);
                              }}
                            >
                              View
                            </Button>
                            {bonus.status !== 'canceled' && (
                              <Button
                                size="small"
                                variant="text"
                                color="error"
                                disabled={cancelling[bonus.bonus_id]}
                                onClick={() => {
                                  setCancelBonusId(bonus.bonus_id);
                                  setCancelBonus(bonus);
                                }}
                              >
                                {cancelling[bonus.bonus_id] ? 'Cancelling...' : 'Cancel'}
                              </Button>
                            )}
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Box>
          )}
        </CardContent>
      </Card>

      <CreateSt8BonusModal
        open={openCreate}
        onClose={() => setOpenCreate(false)}
        onSubmit={(payload: Record<string, unknown>) => {
          void (async () => {
            try {
              const result = await dispatch(createSt8Bonus(payload));
              if (createSt8Bonus.fulfilled.match(result)) {
                setOpenCreate(false);
                void dispatch(
                  fetchLocalSt8Bonuses({
                    gameCode: gameCodes || undefined,
                    type: typeFilter || undefined,
                    currency: currency || undefined,
                    status: statusFilter || undefined,
                  }),
                );
                setSnack({
                  open: true,
                  message: 'Bonus created, will be available in a ~1 minute',
                  severity: 'success',
                });
              } else if (createSt8Bonus.rejected.match(result)) {
                const errorMessage = parseErrorMessage(result.error || result.payload);
                setSnack({
                  open: true,
                  message: errorMessage || 'Failed to create bonus',
                  severity: 'error',
                });
              }
            } catch (e: any) {
              const errorMessage = parseErrorMessage(e);
              setSnack({
                open: true,
                message: errorMessage || 'Failed to create bonus',
                severity: 'error',
              });
            }
          })();
        }}
        loading={creating}
      />

      <ViewSt8BonusModal open={!!viewId} onClose={() => setViewId(null)} bonusId={viewId} />

      <CancelSt8BonusModal
        open={!!cancelBonusId}
        onClose={() => {
          setCancelBonusId(null);
          setCancelBonus(null);
        }}
        bonus={cancelBonus}
        onSubmit={(bonusId: string, players?: string[]) => {
          void (async () => {
            try {
              const result = await dispatch(cancelSt8Bonus({ bonusId, players }));
              if (cancelSt8Bonus.fulfilled.match(result)) {
                setCancelBonusId(null);
                setCancelBonus(null);
                void dispatch(
                  fetchLocalSt8Bonuses({
                    gameCode: gameCodes || undefined,
                    type: typeFilter || undefined,
                    currency: currency || undefined,
                    status: statusFilter || undefined,
                  }),
                );
                setSnack({
                  open: true,
                  message: 'Bonus cancelled successfully',
                  severity: 'success',
                });
              } else {
                setSnack({
                  open: true,
                  message: (result.payload as string) || 'Failed to cancel bonus',
                  severity: 'error',
                });
              }
            } catch (e: any) {
              setSnack({
                open: true,
                message: e?.message || 'Failed to cancel bonus',
                severity: 'error',
              });
            }
          })();
        }}
        loading={cancelBonusId ? cancelling[cancelBonusId] : false}
      />

      <Snackbar
        open={snack.open}
        autoHideDuration={3000}
        onClose={() => setSnack({ ...snack, open: false })}
      >
        <MuiAlert
          severity={snack.severity}
          variant="filled"
          onClose={() => setSnack({ ...snack, open: false })}
        >
          {snack.message}
        </MuiAlert>
      </Snackbar>
    </Box>
  );
};

export default PartnerBonuses;
