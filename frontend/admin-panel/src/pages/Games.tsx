import { Casino, Edit, People, Settings, TrendingUp } from '@mui/icons-material';
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
  FormHelperText,
  Grid,
  IconButton,
  MenuItem,
  Paper,
  Select,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import React, { useEffect, useState } from 'react';
import {
  GameConfigService,
  GameStatus,
  GameType,
  type BetLimitsUpdate,
  type BetTypeLimit,
  type GameConfig,
  type GameStats,
} from '../services/gameConfigService';

interface FormErrors {
  [key: string]: string;
}

interface EditBetLimitsData {
  gameType: GameType;
  minBetUsd: number;
  maxBetUsd: number;
  maxPayoutUsd: number;
}

interface EditBetTypeLimitsData {
  id: string;
  gameType: GameType;
  betTypeCategory: string;
  description: string;
  minBetUsd: number;
  maxBetUsd: number;
}

const Games: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [gameConfigs, setGameConfigs] = useState<GameConfig[]>([]);
  const [gameStats, setGameStats] = useState<GameStats[]>([]);
  const [betLimits, setBetLimits] = useState<BetLimitsUpdate[]>([]);
  const [betTypeLimits, setBetTypeLimits] = useState<BetTypeLimit[]>([]);
  const [loading, setLoading] = useState(false);
  const [editBetLimits, setEditBetLimits] = useState<EditBetLimitsData | null>(null);
  const [editBetTypeLimits, setEditBetTypeLimits] = useState<EditBetTypeLimitsData | null>(null);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');
  const [formErrors, setFormErrors] = useState<FormErrors>({});

  useEffect(() => {
    if (activeTab === 0) {
      fetchGameStats();
      const interval = setInterval(fetchGameStats, 5000); // Update every 5 seconds
      return () => clearInterval(interval);
    } else if (activeTab === 1) {
      fetchGameConfigs();
    } else if (activeTab === 2) {
      fetchBetLimits();
    } else if (activeTab === 3) {
      fetchBetTypeLimits();
    }
  }, [activeTab]);

  const showMessage = (msg: string, type: 'success' | 'error' = 'success') => {
    setMessage(msg);
    setMessageType(type);
    setTimeout(() => setMessage(''), 5000);
  };

  const clearMessage = () => {
    setMessage('');
  };

  const fetchGameStats = async () => {
    try {
      const response = await GameConfigService.getGameStats();
      setGameStats(response || []);
    } catch (error) {
      console.error('Failed to fetch game stats:', error);
      setGameStats([]);
      showMessage('Failed to fetch game statistics', 'error');
    }
  };

  const fetchGameConfigs = async () => {
    try {
      setLoading(true);
      const response = await GameConfigService.getGameConfigs();
      setGameConfigs(response || []);
    } catch (error) {
      console.error('Failed to fetch game configs:', error);
      setGameConfigs([]);
      showMessage('Failed to fetch game configurations', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchBetLimits = async () => {
    try {
      setLoading(true);
      const response = await GameConfigService.getBetLimits();
      setBetLimits(response || []);
    } catch (error) {
      console.error('Failed to fetch bet limits:', error);
      setBetLimits([]);
      showMessage('Failed to fetch bet limits', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchBetTypeLimits = async () => {
    try {
      setLoading(true);
      const response = await GameConfigService.getAllBetTypeLimits();
      setBetTypeLimits(response || []);
    } catch (error) {
      console.error('Failed to fetch bet type limits:', error);
      setBetTypeLimits([]);
      showMessage('Failed to fetch bet type limits', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateBetLimits = async (data: EditBetLimitsData) => {
    if (!editBetLimits) return;

    try {
      setLoading(true);
      await GameConfigService.updateBetLimits(
        data.gameType,
        data.minBetUsd,
        data.maxBetUsd,
        data.maxPayoutUsd,
      );
      setEditBetLimits(null);
      setFormErrors({});
      showMessage('Bet limits updated successfully');
      fetchBetLimits();
      fetchGameConfigs(); // Refresh configs too
    } catch (error: any) {
      console.error('Failed to update bet limits:', error);
      showMessage(error.message || 'Failed to update bet limits', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateBetTypeLimits = async (data: EditBetTypeLimitsData) => {
    if (!editBetTypeLimits) return;

    try {
      setLoading(true);
      await GameConfigService.updateBetTypeLimits(data.id, {
        minBetUsd: data.minBetUsd,
        maxBetUsd: data.maxBetUsd,
      });
      setEditBetTypeLimits(null);
      setFormErrors({});
      showMessage('Bet type limits updated successfully');
      fetchBetTypeLimits();
    } catch (error: any) {
      console.error('Failed to update bet type limits:', error);
      showMessage(error.message || 'Failed to update bet type limits', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (gameType: GameType, status: GameStatus) => {
    try {
      await GameConfigService.updateGameStatus(gameType, status);
      showMessage(`Game status updated to ${status} successfully`);
      fetchGameConfigs();
    } catch (error: any) {
      console.error('Failed to toggle game status:', error);
      showMessage(error.message || 'Failed to update game status', 'error');
    }
  };

  const validateBetLimits = (data: EditBetLimitsData): boolean => {
    const errors: FormErrors = {};

    const validationErrors = GameConfigService.validateBetLimits(
      data.minBetUsd,
      data.maxBetUsd,
      data.maxPayoutUsd,
    );
    if (validationErrors.length > 0) {
      errors.betLimits = validationErrors.join(', ');
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateBetTypeLimits = (data: EditBetTypeLimitsData): boolean => {
    const errors: FormErrors = {};

    const validationErrors = GameConfigService.validateBetTypeLimits(
      data.minBetUsd,
      data.maxBetUsd,
    );
    if (validationErrors.length > 0) {
      errors.betTypeLimits = validationErrors.join(', ');
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const getStatusColor = (status: GameStatus): 'success' | 'error' | 'warning' | 'default' => {
    switch (status) {
      case GameStatus.ENABLED:
        return 'success';
      case GameStatus.DISABLED:
        return 'error';
      case GameStatus.MAINTENANCE:
        return 'warning';
      default:
        return 'default';
    }
  };

  const formatGameName = (gameType: GameType): string => {
    return gameType.charAt(0).toUpperCase() + gameType.slice(1);
  };

  const renderLiveStats = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Live Game Statistics
      </Typography>

      {gameStats.length === 0 ? (
        <Typography color="text.secondary">No statistics available</Typography>
      ) : (
        <Grid container spacing={3}>
          {gameStats.map((stat) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={stat.gameType}>
              <Card>
                <CardContent>
                  <Box display="flex" alignItems="center" mb={2}>
                    <Casino sx={{ mr: 1 }} />
                    <Typography variant="h6">{formatGameName(stat.gameType)}</Typography>
                  </Box>

                  <Box display="flex" justifyContent="space-between" mb={1}>
                    <Typography variant="body2" color="text.secondary">
                      <People sx={{ fontSize: 16, verticalAlign: 'middle', mr: 0.5 }} />
                      Active Players:
                    </Typography>
                    <Typography variant="body2">{stat.activePlayers}</Typography>
                  </Box>

                  <Box display="flex" justifyContent="space-between" mb={1}>
                    <Typography variant="body2" color="text.secondary">
                      Active Games:
                    </Typography>
                    <Typography variant="body2">{stat.activeGames}</Typography>
                  </Box>

                  <Box display="flex" justifyContent="space-between" mb={1}>
                    <Typography variant="body2" color="text.secondary">
                      24h Volume:
                    </Typography>
                    <Typography variant="body2">
                      {GameConfigService.formatUsd(stat.volumeLast24h)}
                    </Typography>
                  </Box>

                  <Box display="flex" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">
                      24h Revenue:
                    </Typography>
                    <Typography variant="body2" color="success.main">
                      {GameConfigService.formatUsd(stat.revenueLast24h)}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );

  const renderGameConfigs = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Game Configurations
      </Typography>

      {loading ? (
        <Box display="flex" justifyContent="center" p={3}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Game</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Min Bet (USD)</TableCell>
                <TableCell>Max Bet (USD)</TableCell>
                <TableCell>Max Payout (USD)</TableCell>
                <TableCell>Updated</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {gameConfigs.map((config) => (
                <TableRow key={config.gameType}>
                  <TableCell>
                    <Box display="flex" alignItems="center">
                      <Casino sx={{ mr: 1 }} />
                      {formatGameName(config.gameType)}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={config.status}
                      color={getStatusColor(config.status)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>{GameConfigService.formatUsd(config.minBetUsd)}</TableCell>
                  <TableCell>{GameConfigService.formatUsd(config.maxBetUsd)}</TableCell>
                  <TableCell>{GameConfigService.formatUsd(config.maxPayoutUsd)}</TableCell>
                  <TableCell>{new Date(config.updatedAt).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <FormControl size="small" sx={{ minWidth: 120, mr: 1 }}>
                      <Select
                        value={config.status}
                        onChange={(e) =>
                          handleToggleStatus(config.gameType, e.target.value as GameStatus)
                        }
                      >
                        <MenuItem value={GameStatus.ENABLED}>Enabled</MenuItem>
                        <MenuItem value={GameStatus.DISABLED}>Disabled</MenuItem>
                        <MenuItem value={GameStatus.MAINTENANCE}>Maintenance</MenuItem>
                      </Select>
                    </FormControl>
                    <IconButton
                      size="small"
                      onClick={() =>
                        setEditBetLimits({
                          gameType: config.gameType,
                          minBetUsd: config.minBetUsd,
                          maxBetUsd: config.maxBetUsd,
                          maxPayoutUsd: config.maxPayoutUsd,
                        })
                      }
                    >
                      <Edit />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );

  const renderBetLimits = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Bet Limits Management
      </Typography>

      {loading ? (
        <Box display="flex" justifyContent="center" p={3}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Game</TableCell>
                <TableCell>Minimum Bet (USD)</TableCell>
                <TableCell>Maximum Bet (USD)</TableCell>
                <TableCell>Maximum Payout (USD)</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {betLimits.map((limit) => (
                <TableRow key={limit.gameType}>
                  <TableCell>
                    <Box display="flex" alignItems="center">
                      <Casino sx={{ mr: 1 }} />
                      {formatGameName(limit.gameType)}
                    </Box>
                  </TableCell>
                  <TableCell>{GameConfigService.formatUsd(limit.minBetUsd)}</TableCell>
                  <TableCell>{GameConfigService.formatUsd(limit.maxBetUsd)}</TableCell>
                  <TableCell>{GameConfigService.formatUsd(limit.maxPayoutUsd)}</TableCell>
                  <TableCell>
                    <IconButton
                      size="small"
                      onClick={() =>
                        setEditBetLimits({
                          gameType: limit.gameType,
                          minBetUsd: limit.minBetUsd,
                          maxBetUsd: limit.maxBetUsd,
                          maxPayoutUsd: limit.maxPayoutUsd,
                        })
                      }
                    >
                      <Edit />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );

  const renderBetTypeLimits = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Detailed Bet Type Limits
      </Typography>
      <Typography variant="body2" sx={{ mb: 3 }}>
        These are the specific limits that actually control individual bet types (main bets, side
        bets, etc.) and take priority over general game limits. These are the limits that are
        currently being enforced.
      </Typography>
      {loading ? (
        <Box display="flex" justifyContent="center" my={3}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Game</TableCell>
                <TableCell>Bet Type</TableCell>
                <TableCell>Description</TableCell>
                <TableCell>Min Bet (USD)</TableCell>
                <TableCell>Max Bet (USD)</TableCell>
                <TableCell>Updated</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {betTypeLimits.map((limit) => (
                <TableRow key={limit.id}>
                  <TableCell>
                    <Box display="flex" alignItems="center">
                      <Casino sx={{ mr: 1 }} />
                      {formatGameName(limit.gameType)}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={GameConfigService.formatBetTypeCategoryName(limit.betTypeCategory)}
                      size="small"
                      color="primary"
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>{limit.description}</TableCell>
                  <TableCell>{GameConfigService.formatUsd(limit.minBetUsd)}</TableCell>
                  <TableCell>{GameConfigService.formatUsd(limit.maxBetUsd)}</TableCell>
                  <TableCell>{limit.updatedAt.toLocaleDateString()}</TableCell>
                  <TableCell>
                    <IconButton
                      size="small"
                      onClick={() =>
                        setEditBetTypeLimits({
                          id: limit.id,
                          gameType: limit.gameType,
                          betTypeCategory: limit.betTypeCategory,
                          description: limit.description,
                          minBetUsd: limit.minBetUsd,
                          maxBetUsd: limit.maxBetUsd,
                        })
                      }
                    >
                      <Edit />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom display="flex" alignItems="center">
        <Casino sx={{ mr: 2 }} />
        Games Management
      </Typography>

      {message && (
        <Alert severity={messageType} onClose={clearMessage} sx={{ mb: 2 }}>
          {message}
        </Alert>
      )}

      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={(_, newValue) => setActiveTab(newValue)}
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab icon={<TrendingUp />} label="Live Statistics" iconPosition="start" />
          <Tab icon={<Settings />} label="Game Configuration" iconPosition="start" />
          <Tab icon={<Casino />} label="Bet Limits" iconPosition="start" />
          <Tab icon={<Settings />} label="Detailed Bet Types" iconPosition="start" />
        </Tabs>

        <Box sx={{ p: 3 }}>
          {activeTab === 0 && renderLiveStats()}
          {activeTab === 1 && renderGameConfigs()}
          {activeTab === 2 && renderBetLimits()}
          {activeTab === 3 && renderBetTypeLimits()}
        </Box>
      </Paper>

      {/* Edit Bet Limits Dialog */}
      <Dialog
        open={!!editBetLimits}
        onClose={() => {
          setEditBetLimits(null);
          setFormErrors({});
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Edit Bet Limits - {editBetLimits && formatGameName(editBetLimits.gameType)}
        </DialogTitle>
        <DialogContent>
          {editBetLimits && (
            <Box sx={{ mt: 2 }}>
              <TextField
                fullWidth
                label="Minimum Bet (USD)"
                type="number"
                value={editBetLimits.minBetUsd}
                onChange={(e) =>
                  setEditBetLimits({
                    ...editBetLimits,
                    minBetUsd: parseFloat(e.target.value) || 0,
                  })
                }
                inputProps={{ step: 0.01, min: 0.01 }}
                sx={{ mb: 2 }}
              />
              <TextField
                fullWidth
                label="Maximum Bet (USD)"
                type="number"
                value={editBetLimits.maxBetUsd}
                onChange={(e) =>
                  setEditBetLimits({
                    ...editBetLimits,
                    maxBetUsd: parseFloat(e.target.value) || 0,
                  })
                }
                inputProps={{ step: 0.01, min: 0.01 }}
                sx={{ mb: 2 }}
              />
              <TextField
                fullWidth
                label="Maximum Payout (USD)"
                type="number"
                value={editBetLimits.maxPayoutUsd}
                onChange={(e) =>
                  setEditBetLimits({
                    ...editBetLimits,
                    maxPayoutUsd: parseFloat(e.target.value) || 0,
                  })
                }
                inputProps={{ step: 1, min: 1 }}
                helperText="Auto cashout when payout exceeds this limit"
              />
              {formErrors.betLimits && (
                <FormHelperText error sx={{ mt: 1 }}>
                  {formErrors.betLimits}
                </FormHelperText>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setEditBetLimits(null);
              setFormErrors({});
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              if (editBetLimits && validateBetLimits(editBetLimits)) {
                handleUpdateBetLimits(editBetLimits);
              }
            }}
            disabled={loading}
          >
            {loading ? <CircularProgress size={20} /> : 'Update'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Bet Type Limits Dialog */}
      <Dialog
        open={!!editBetTypeLimits}
        onClose={() => {
          setEditBetTypeLimits(null);
          setFormErrors({});
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Edit Bet Type Limits - {editBetTypeLimits && formatGameName(editBetTypeLimits.gameType)}
        </DialogTitle>
        <DialogContent>
          {editBetTypeLimits && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" sx={{ mb: 2 }}>
                <strong>Bet Type:</strong>{' '}
                {GameConfigService.formatBetTypeCategoryName(editBetTypeLimits.betTypeCategory)}
              </Typography>
              <Typography variant="body2" sx={{ mb: 3 }}>
                <strong>Description:</strong> {editBetTypeLimits.description}
              </Typography>

              <TextField
                fullWidth
                label="Minimum Bet (USD)"
                type="number"
                value={editBetTypeLimits.minBetUsd}
                onChange={(e) =>
                  setEditBetTypeLimits({
                    ...editBetTypeLimits,
                    minBetUsd: parseFloat(e.target.value) || 0,
                  })
                }
                inputProps={{ step: 0.01, min: 0.01 }}
                sx={{ mb: 2 }}
              />
              <TextField
                fullWidth
                label="Maximum Bet (USD)"
                type="number"
                value={editBetTypeLimits.maxBetUsd}
                onChange={(e) =>
                  setEditBetTypeLimits({
                    ...editBetTypeLimits,
                    maxBetUsd: parseFloat(e.target.value) || 0,
                  })
                }
                inputProps={{ step: 0.01, min: 0.01 }}
              />
              {formErrors.betTypeLimits && (
                <FormHelperText error sx={{ mt: 1 }}>
                  {formErrors.betTypeLimits}
                </FormHelperText>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setEditBetTypeLimits(null);
              setFormErrors({});
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              if (editBetTypeLimits && validateBetTypeLimits(editBetTypeLimits)) {
                handleUpdateBetTypeLimits(editBetTypeLimits);
              }
            }}
            disabled={loading}
          >
            {loading ? <CircularProgress size={20} /> : 'Update'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Games;
