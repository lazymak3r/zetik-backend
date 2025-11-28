import {
  Calculate,
  Cancel,
  CardGiftcard,
  CheckCircle,
  Edit,
  EmojiEvents,
  Refresh,
  Star,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Card,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Paper,
  Switch,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import TabPanel from '../components/common/TabPanel';
import { AppDispatch, RootState } from '../store';
import {
  cancelBonuses,
  clearError,
  fetchBonuses,
  fetchVipTiers,
  fetchWeeklyRacePrizes,
  updateVipTier,
  updateWeeklyRacePrizes,
} from '../store/slices/bonusSlice';
import { fetchUsers } from '../store/users/model/users.thunks';

// Weekly Reload Section Component
const WeeklyReloadSection: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { users, loading: usersLoading } = useSelector((state: RootState) => state.users);
  const { vipTiers } = useSelector((state: RootState) => state.bonus);

  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [calculation, setCalculation] = useState<any>(null);
  const [activationResult, setActivationResult] = useState<any>(null);
  const [alertMessage, setAlertMessage] = useState<{
    type: 'error' | 'info' | 'warning' | 'success';
    message: string;
  } | null>(null);

  // Load users when search term changes
  useEffect(() => {
    if (searchTerm && searchTerm.length >= 2) {
      void dispatch(
        fetchUsers({
          search: searchTerm,
          limit: 10,
          page: 1,
        }),
      );
    }
  }, [searchTerm, dispatch]);

  const handleUserSelect = (user: any) => {
    setSelectedUser(user);
  };

  const calculateWeeklyReload = async () => {
    if (!selectedUser) return;

    // Clear previous results
    setCalculation(null);
    setAlertMessage(null);
    setLoading(true);
    try {
      const response = await fetch('/v1/bonuses/weekly-reload/calculate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('adminToken')}`,
        },
        body: JSON.stringify({ userId: selectedUser.id }),
      });

      if (response.ok) {
        const data = await response.json();
        setCalculation(data);
        // Clear any previous alerts on successful calculation
        setAlertMessage(null);
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to calculate weekly reload');
      }
    } catch (error) {
      console.error('Failed to calculate weekly reload:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';

      // Check if error is about VIP level not being eligible
      if (
        message.includes('not available for VIP tier') &&
        message.includes('Minimum daily amount is not configured')
      ) {
        const minVipLevel =
          vipTiers.find(
            (tier: any) => tier.weeklyReloadDailyMin && parseFloat(tier.weeklyReloadDailyMin) > 0,
          )?.level || 13;
        const minTierName =
          vipTiers.find((tier: any) => tier.level === minVipLevel)?.name || 'Platinum I';

        setAlertMessage({
          type: 'info',
          message: `Weekly reload is not available for this VIP level. User needs to reach at least VIP Level ${minVipLevel} (${minTierName}) to be eligible for weekly reload bonuses.`,
        });
      } else if (message.includes('User has no effective edge for weekly reload calculation')) {
        setAlertMessage({
          type: 'warning',
          message:
            'Unable to calculate weekly reload. User has insufficient betting activity or no effective edge in the analyzed period. User needs to have more significant betting activity to be eligible for weekly reload calculation.',
        });
      } else {
        setAlertMessage({
          type: 'error',
          message: `Failed to calculate weekly reload: ${message}`,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const activateWeeklyReload = async () => {
    if (!selectedUser) return;

    setLoading(true);
    try {
      const response = await fetch('/v1/bonuses/weekly-reload/activate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('adminToken')}`,
        },
        body: JSON.stringify({ userId: selectedUser.id }),
      });

      if (response.ok) {
        const data = await response.json();
        setActivationResult(data);
        setCalculation(null); // Clear calculation after activation
        setAlertMessage({
          type: 'success',
          message: `Weekly reload activated successfully! Created ${data.bonusesCreated} daily bonuses totaling $${(data.totalWeeklyAmount / 100).toFixed(2)}.`,
        });
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to activate weekly reload');
      }
    } catch (error) {
      console.error('Failed to activate weekly reload:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';

      // Check if error is about VIP level not being eligible
      if (
        message.includes('not available for VIP tier') &&
        message.includes('Minimum daily amount is not configured')
      ) {
        const minVipLevel =
          vipTiers.find(
            (tier: any) => tier.weeklyReloadDailyMin && parseFloat(tier.weeklyReloadDailyMin) > 0,
          )?.level || 13;
        const minTierName =
          vipTiers.find((tier: any) => tier.level === minVipLevel)?.name || 'Platinum I';

        setAlertMessage({
          type: 'info',
          message: `Weekly reload is not available for this VIP level. User needs to reach at least VIP Level ${minVipLevel} (${minTierName}) to be eligible for weekly reload bonuses.`,
        });
      } else if (message.includes('User has no effective edge for weekly reload calculation')) {
        setAlertMessage({
          type: 'warning',
          message:
            'Unable to activate weekly reload. User has insufficient betting activity or no effective edge in the analyzed period. User needs to have more significant betting activity to be eligible for weekly reload.',
        });
      } else {
        setAlertMessage({
          type: 'error',
          message: `Failed to activate weekly reload: ${message}`,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box display="flex" flexDirection="column" gap={3}>
      <Typography variant="h6">Weekly Reload Management</Typography>

      {/* User Search */}
      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle1" gutterBottom>
          Search User
        </Typography>
        <Box display="flex" gap={2} alignItems="center" mb={2}>
          <TextField
            placeholder="Search by email or username..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            sx={{ flex: 1 }}
          />
          <Button
            variant="outlined"
            startIcon={<Calculate />}
            onClick={() => void calculateWeeklyReload()}
            disabled={!selectedUser || loading}
          >
            Calculate
          </Button>
        </Box>

        {/* User Selection */}
        {searchTerm && searchTerm.length >= 2 && (
          <Box>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Select a user:
            </Typography>
            <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
              {usersLoading ? (
                <Box display="flex" justifyContent="center" p={2}>
                  <CircularProgress size={24} />
                </Box>
              ) : users.length > 0 ? (
                users.map((user) => (
                  <Box
                    key={user.id}
                    sx={{
                      p: 1,
                      border: 1,
                      borderColor: selectedUser?.id === user.id ? 'primary.main' : 'divider',
                      borderRadius: 1,
                      mb: 1,
                      cursor: 'pointer',
                      bgcolor: selectedUser?.id === user.id ? 'primary.light' : 'transparent',
                      '&:hover': {
                        bgcolor: 'action.hover',
                      },
                    }}
                    onClick={() => handleUserSelect(user)}
                  >
                    <Typography variant="body2">
                      <strong>{user.username || user.id}</strong>
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {user.email}
                    </Typography>
                  </Box>
                ))
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No users found
                </Typography>
              )}
            </Box>
          </Box>
        )}
      </Paper>

      {/* Alert Messages */}
      {alertMessage && (
        <Alert severity={alertMessage.type} onClose={() => setAlertMessage(null)} sx={{ mb: 2 }}>
          {alertMessage.message}
        </Alert>
      )}

      {/* Calculation Results */}
      {calculation && (
        <Paper sx={{ p: 2 }}>
          <Typography variant="subtitle1" gutterBottom>
            Weekly Reload Calculation
          </Typography>
          <Box display="flex" flexDirection="column" gap={2}>
            <Box display="flex" gap={4}>
              <Typography>
                <strong>User:</strong> {selectedUser?.email}
              </Typography>
              <Typography>
                <strong>VIP Level:</strong>{' '}
                {(() => {
                  const tier = vipTiers.find((t: any) => t.level === calculation.vipLevel);
                  return tier ? `${calculation.vipLevel} - ${tier.name}` : calculation.vipLevel;
                })()}
              </Typography>
              <Typography>
                <strong>Player Type:</strong> {calculation.isProfitable ? 'Profitable' : 'Losing'}
              </Typography>
            </Box>
            <Box display="flex" gap={4}>
              <Typography>
                <strong>Effective Edge:</strong> ${calculation.effectiveEdge.toFixed(2)}
              </Typography>
              <Typography>
                <strong>Applied %:</strong> {calculation.appliedPercentage}%
              </Typography>
              <Typography>
                <strong>Min Daily:</strong>{' '}
                {(() => {
                  const tier = vipTiers.find((t: any) => t.level === calculation.vipLevel);
                  const vipMin = tier?.weeklyReloadDailyMin
                    ? parseFloat(tier.weeklyReloadDailyMin)
                    : undefined;
                  return vipMin ? `$${vipMin.toFixed(2)}` : 'Not set';
                })()}
              </Typography>
              <Typography>
                <strong>Period:</strong> {calculation.periodAnalyzed}
              </Typography>
            </Box>
            <Box display="flex" gap={4}>
              <Typography variant="h6" color="primary">
                <strong>Total Weekly:</strong> ${calculation.totalWeeklyAmount.toFixed(2)}
              </Typography>
              <Typography variant="h6" color="secondary">
                <strong>Daily Amount:</strong>{' '}
                {(() => {
                  const tier = vipTiers.find((t: any) => t.level === calculation.vipLevel);
                  const vipMin = tier?.weeklyReloadDailyMin
                    ? parseFloat(tier.weeklyReloadDailyMin)
                    : undefined;
                  const calculatedDaily = calculation.totalWeeklyAmount / 7;

                  if (vipMin && calculatedDaily < vipMin) {
                    return `$${calculatedDaily.toFixed(2)} → $${vipMin.toFixed(2)} (minimum)`;
                  }
                  return `$${calculation.dailyAmount.toFixed(2)}`;
                })()}
              </Typography>
            </Box>
            {/* Tier minimum logic */}
            {(() => {
              const tier = vipTiers.find((t: any) => t.level === calculation.vipLevel);
              const vipMin = tier?.weeklyReloadDailyMin
                ? parseFloat(tier.weeklyReloadDailyMin)
                : undefined;
              if (vipMin === undefined || isNaN(vipMin) || vipMin <= 0) {
                return (
                  <Alert severity="error">
                    Weekly reload is not available for this VIP level: minimum daily amount is not
                    configured.
                  </Alert>
                );
              }
              const calculatedDaily = calculation.totalWeeklyAmount / 7;
              if (calculatedDaily < vipMin) {
                return (
                  <Alert severity="warning" sx={{ mt: 2 }}>
                    <strong>
                      Calculated daily amount ${calculatedDaily.toFixed(2)} is below the $
                      {vipMin.toFixed(2)} minimum.
                    </strong>
                    <br />
                    Clicking "Activate Weekly Reload" will provide the minimum daily bonus of $
                    {vipMin.toFixed(2)} per day.
                  </Alert>
                );
              }
              return null;
            })()}

            <Box display="flex" gap={2} mt={2}>
              <Button
                variant="contained"
                color="success"
                startIcon={<CheckCircle />}
                onClick={() => void activateWeeklyReload()}
                disabled={(() => {
                  if (loading) return true;
                  const tier = vipTiers.find((t: any) => t.level === calculation.vipLevel);
                  const vipMin = tier?.weeklyReloadDailyMin
                    ? parseFloat(tier.weeklyReloadDailyMin)
                    : undefined;
                  if (vipMin === undefined || isNaN(vipMin) || vipMin <= 0) return true; // not configured => disable
                  return false; // Allow activation even if below minimum
                })()}
                title={(() => {
                  const tier = vipTiers.find((t: any) => t.level === calculation.vipLevel);
                  const vipMin = tier?.weeklyReloadDailyMin
                    ? parseFloat(tier.weeklyReloadDailyMin)
                    : undefined;
                  if (vipMin === undefined || isNaN(vipMin) || vipMin <= 0)
                    return 'Weekly reload not available - minimum daily amount not configured for this VIP level';
                  if (calculation.dailyAmount < vipMin)
                    return `Will provide minimum daily amount of ${vipMin.toFixed(2)}`;
                  return undefined;
                })()}
              >
                Activate Weekly Reload
              </Button>
              <Button variant="outlined" onClick={() => setCalculation(null)}>
                Clear
              </Button>
            </Box>
          </Box>
        </Paper>
      )}

      {/* Activation Results */}
      {activationResult && (
        <Paper sx={{ p: 2 }}>
          <Typography variant="subtitle1" gutterBottom color="success.main">
            ✅ Weekly Reload Activated Successfully
          </Typography>
          <Box display="flex" flexDirection="column" gap={2}>
            <Typography>
              <strong>Message:</strong> {activationResult.message}
            </Typography>
            <Typography>
              <strong>Bonuses Created:</strong> {activationResult.bonusesCreated}
            </Typography>
            <Typography>
              <strong>Total Weekly Amount:</strong> ${activationResult.totalWeeklyAmount.toFixed(2)}
            </Typography>
            <Typography>
              <strong>Daily Amount:</strong> ${activationResult.dailyAmount.toFixed(2)}
            </Typography>

            {activationResult.bonusDetails && (
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Bonus Schedule:
                </Typography>
                <Box display="flex" flexDirection="column" gap={1}>
                  {activationResult.bonusDetails.map((bonus: any, index: number) => (
                    <Typography key={bonus.bonusId} variant="body2">
                      Day {index + 1}: ${bonus.amount.toFixed(2)} - Activates:{' '}
                      {new Date(bonus.activateAt).toLocaleDateString()} - Expires:{' '}
                      {new Date(bonus.expiredAt).toLocaleDateString()}
                    </Typography>
                  ))}
                </Box>
              </Box>
            )}

            <Button
              variant="outlined"
              onClick={() => setActivationResult(null)}
              sx={{ alignSelf: 'flex-start' }}
            >
              Close
            </Button>
          </Box>
        </Paper>
      )}
    </Box>
  );
};

const Bonus: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { vipTiers, bonuses, total, loading, error } = useSelector(
    (state: RootState) => state.bonus,
  );

  const [tabValue, setTabValue] = useState(0);
  const [tierDialog, setTierDialog] = useState(false);
  const [selectedTier, setSelectedTier] = useState<any>(null);
  const [selectedBonuses, setSelectedBonuses] = useState<string[]>([]);
  const [prizeDraft, setPrizeDraft] = useState<Array<{ place: number; amount: number }>>([]);

  // Form state for VIP Tier
  const [tierForm, setTierForm] = useState({
    level: 0,
    name: '',
    description: '',
    isForVip: false,
    imageUrl: '',
    wagerRequirement: '',
    levelUpBonusAmount: '',
    rakebackPercentage: '',
    rankUpBonusAmount: '',
    weeklyBonusPercentage: '',
    monthlyBonusPercentage: '',
    weeklyReloadProfitablePercentage: '',
    weeklyReloadLosingPercentage: '',
    weeklyReloadDailyMin: '',
  });

  useEffect(() => {
    void dispatch(fetchVipTiers());
    void dispatch(fetchBonuses({ page: 1, limit: 20 }));
    void dispatch(fetchWeeklyRacePrizes() as any).then((res: any) => {
      const data = (res?.payload || []) as Array<{ place: number; amount: number }>;
      setPrizeDraft(data);
    });
  }, [dispatch]);

  const handlePrizeChange = (place: number, value: number) => {
    setPrizeDraft((prev) => prev.map((p) => (p.place === place ? { ...p, amount: value } : p)));
  };

  const handleSavePrizes = async () => {
    await (dispatch(updateWeeklyRacePrizes(prizeDraft)) as any).unwrap();
    await dispatch(fetchWeeklyRacePrizes() as any);
  };

  const handleAddPlace = () => {
    const nextPlace = prizeDraft.length ? Math.max(...prizeDraft.map((p) => p.place)) + 1 : 1;
    setPrizeDraft((prev) => [...prev, { place: nextPlace, amount: 0 }]);
  };

  const handleRemovePlace = (place: number) => {
    setPrizeDraft((prev) => prev.filter((p) => p.place !== place));
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleEditTier = (tier: any) => {
    setSelectedTier(tier);
    setTierForm({
      level: tier.level,
      name: tier.name,
      description: tier.description || '',
      isForVip: tier.isForVip,
      imageUrl: tier.imageUrl || '',
      wagerRequirement: tier.wagerRequirement,
      levelUpBonusAmount: tier.levelUpBonusAmount || '',
      rakebackPercentage: tier.rakebackPercentage || '',
      rankUpBonusAmount: tier.rankUpBonusAmount || '',
      weeklyBonusPercentage: tier.weeklyBonusPercentage || '',
      monthlyBonusPercentage: tier.monthlyBonusPercentage || '',
      weeklyReloadProfitablePercentage: tier.weeklyReloadProfitablePercentage || '',
      weeklyReloadLosingPercentage: tier.weeklyReloadLosingPercentage || '',
      weeklyReloadDailyMin: tier.weeklyReloadDailyMin || '',
    });
    setTierDialog(true);
  };

  const handleSaveTier = async () => {
    try {
      // Remove level from form data since it's auto-assigned
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { level, ...formData } = tierForm;

      // Clean up empty string values - convert to undefined
      const tierData = {
        name: formData.name,
        description: formData.description || undefined,
        isForVip: formData.isForVip,
        imageUrl: formData.imageUrl || undefined,
        wagerRequirement: formData.wagerRequirement,
        levelUpBonusAmount: formData.levelUpBonusAmount || undefined,
        rakebackPercentage: formData.rakebackPercentage || undefined,
        rankUpBonusAmount: formData.rankUpBonusAmount || undefined,
        weeklyBonusPercentage: formData.weeklyBonusPercentage || undefined,
        monthlyBonusPercentage: formData.monthlyBonusPercentage || undefined,
        weeklyReloadProfitablePercentage: formData.weeklyReloadProfitablePercentage || undefined,
        weeklyReloadLosingPercentage: formData.weeklyReloadLosingPercentage || undefined,
        weeklyReloadDailyMin: formData.weeklyReloadDailyMin || undefined,
      };

      if (selectedTier) {
        // Update existing tier
        await dispatch(updateVipTier({ level: selectedTier.level, data: tierData })).unwrap();
      }
      setTierDialog(false);
      // Refresh tiers
      void dispatch(fetchVipTiers());
    } catch (error) {
      console.error('Failed to save tier:', error);
    }
  };

  const handleCancelSelectedBonuses = async () => {
    const pendingBonuses = selectedBonuses.filter((bonusId: string) => {
      const bonus = bonuses.find((b) => b.id === bonusId);
      return bonus?.status === 'PENDING';
    });

    if (pendingBonuses.length === 0) {
      alert('No pending bonuses selected for cancellation');
      return;
    }

    if (
      window.confirm(`Are you sure you want to cancel ${pendingBonuses.length} selected bonus(es)?`)
    ) {
      try {
        await dispatch(
          cancelBonuses({
            bonusIds: pendingBonuses,
            reason: 'Cancelled by admin panel',
          }),
        ).unwrap();
        setSelectedBonuses([]);
        // Refresh bonuses after successful cancellation
        void dispatch(fetchBonuses({ page: 1, limit: 20 }));
      } catch (error) {
        console.error('Failed to cancel bonuses:', error);
      }
    }
  };

  const handleBonusSelection = (bonusId: string, checked: boolean) => {
    if (checked) {
      setSelectedBonuses((prev) => [...prev, bonusId]);
    } else {
      setSelectedBonuses((prev) => prev.filter((id) => id !== bonusId));
    }
  };

  // VIP Tiers columns
  const tierColumns: GridColDef[] = [
    { field: 'level', headerName: 'Level', width: 80 },
    { field: 'name', headerName: 'Name', width: 120 },
    {
      field: 'isForVip',
      headerName: 'is for Vip',
      width: 100,
      renderCell: (params) => (params.value ? 'true' : 'false'),
    },
    {
      field: 'wagerRequirement',
      headerName: 'Wager Requirement',
      width: 140,
      renderCell: (params) => `$${parseFloat(params.value).toFixed(2)}`,
    },
    {
      field: 'levelUpBonusAmount',
      headerName: 'Level Up Bonus',
      width: 130,
      renderCell: (params) => (params.value ? `$${parseFloat(params.value).toFixed(2)}` : '-'),
    },
    {
      field: 'rankUpBonusAmount',
      headerName: 'Rank Up Bonus',
      width: 140,
      renderCell: (params) => (params.value ? `${parseFloat(params.value).toFixed(2)}` : '-'),
    },
    {
      field: 'rakebackPercentage',
      headerName: 'Rakeback %',
      width: 100,
      renderCell: (params) => (params.value ? `${params.value}%` : '-'),
    },
    {
      field: 'weeklyBonusPercentage',
      headerName: 'Weekly Bonus %',
      width: 120,
      renderCell: (params) => (params.value ? `${params.value}%` : '-'),
    },
    {
      field: 'monthlyBonusPercentage',
      headerName: 'Monthly Bonus %',
      width: 130,
      renderCell: (params) => (params.value ? `${params.value}%` : '-'),
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 100,
      sortable: false,
      renderCell: (params: GridRenderCellParams) => (
        <IconButton size="small" onClick={() => handleEditTier(params.row)} title="Edit Tier">
          <Edit />
        </IconButton>
      ),
    },
  ];

  // Bonus columns
  const bonusColumns: GridColDef[] = [
    {
      field: 'userId',
      headerName: 'User ID',
      width: 200,
      renderCell: (params) => (params.value ? params.value.substring(0, 8) + '...' : '-'),
    },
    { field: 'bonusType', headerName: 'Type', width: 120 },
    {
      field: 'amount',
      headerName: 'Amount',
      width: 120,
      renderCell: (params) => `$${parseFloat(params.value).toFixed(2)}`,
    },
    {
      field: 'status',
      headerName: 'Status / Cancel',
      width: 150,
      renderCell: (params: GridRenderCellParams) => (
        <Box display="flex" alignItems="center" gap={1}>
          <Typography
            variant="body2"
            color={
              params.row.status === 'PENDING'
                ? 'warning.main'
                : params.row.status === 'CLAIMED'
                  ? 'success.main'
                  : params.row.status === 'EXPIRED'
                    ? 'error.main'
                    : 'text.secondary'
            }
          >
            {params.row.status}
          </Typography>
          {params.row.status === 'PENDING' && (
            <Checkbox
              size="small"
              checked={selectedBonuses.includes(params.row.id)}
              onChange={(e) => handleBonusSelection(params.row.id, e.target.checked)}
              title="Select to cancel this bonus"
              sx={{
                color: 'error.main',
                '&.Mui-checked': {
                  color: 'error.main',
                },
              }}
            />
          )}
        </Box>
      ),
    },
    { field: 'description', headerName: 'Description', flex: 1 },
    {
      field: 'createdAt',
      headerName: 'Created',
      width: 120,
      renderCell: (params) => new Date(params.value).toLocaleDateString(),
    },
  ];

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Bonus Management
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => dispatch(clearError())}>
          {error}
        </Alert>
      )}

      <Card>
        <Tabs value={tabValue} onChange={handleTabChange}>
          <Tab label="Bonuses Management" icon={<CardGiftcard />} />
          <Tab label="VIP Tiers Settings" icon={<Star />} />
          <Tab label="Weekly Race Prizes" icon={<EmojiEvents />} />
          <Tab label="Weekly Reload" icon={<Refresh />} />
        </Tabs>

        <TabPanel value={tabValue} index={0}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">User Bonuses</Typography>
            <Box display="flex" alignItems="center" gap={2}>
              {selectedBonuses.length > 0 && (
                <Button
                  variant="contained"
                  color="error"
                  size="small"
                  startIcon={<Cancel />}
                  onClick={() => void handleCancelSelectedBonuses()}
                >
                  Cancel {selectedBonuses.length} Selected
                </Button>
              )}
              <Typography variant="body2" color="text.secondary">
                Total: {total} bonuses
              </Typography>
            </Box>
          </Box>

          <DataGrid
            rows={bonuses}
            columns={bonusColumns}
            loading={loading}
            pageSizeOptions={[20, 50, 100]}
            disableRowSelectionOnClick
            autoHeight
          />
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">VIP Tiers Settings</Typography>
          </Box>

          <DataGrid
            rows={vipTiers}
            columns={tierColumns}
            loading={loading}
            pageSizeOptions={[10, 20, 50]}
            disableRowSelectionOnClick
            autoHeight
            getRowId={(row) => row.level}
          />
        </TabPanel>
      </Card>

      {/* Weekly Race Prizes Tab */}
      <TabPanel value={tabValue} index={2}>
        <Box display="flex" flexDirection="column" gap={2}>
          <Typography variant="h6">Weekly Race Prizes</Typography>
          <DataGrid
            rows={[...prizeDraft].sort((a, b) => a.place - b.place)}
            getRowId={(row) => row.place}
            autoHeight
            pageSizeOptions={[10, 20, 50]}
            disableRowSelectionOnClick
            density="compact"
            rowHeight={36}
            columns={
              [
                { field: 'place', headerName: 'Place', width: 100 },
                {
                  field: 'amount',
                  headerName: 'Prize (USD)',
                  width: 180,
                  minWidth: 160,
                  renderCell: (params: any) => (
                    <TextField
                      type="number"
                      inputProps={{ min: 0, step: 1 }}
                      size="small"
                      value={params.row.amount}
                      sx={{
                        width: '100%',
                        '& .MuiOutlinedInput-root': {
                          height: 28,
                          fontSize: 12,
                        },
                        '& .MuiOutlinedInput-input': {
                          padding: '2px 6px',
                        },
                      }}
                      onChange={(e) => handlePrizeChange(params.row.place, Number(e.target.value))}
                    />
                  ),
                },
              ] as any
            }
          />
          <Box display="flex" justifyContent="flex-end" gap={2} alignItems="center" sx={{ mt: 1 }}>
            <Typography variant="body2" sx={{ mr: 'auto' }}>
              Total: $
              {prizeDraft.reduce((sum, x) => sum + (Number.isFinite(x.amount) ? x.amount : 0), 0)}
            </Typography>
            <Button variant="outlined" onClick={handleAddPlace}>
              Add Place
            </Button>
            <Button
              variant="outlined"
              color="error"
              onClick={() =>
                prizeDraft.length && handleRemovePlace(Math.max(...prizeDraft.map((p) => p.place)))
              }
              disabled={!prizeDraft.length}
            >
              Delete Last Place
            </Button>
            <Button
              variant="outlined"
              onClick={() =>
                dispatch(fetchWeeklyRacePrizes() as any).then((res: any) => {
                  const data = res?.payload || [];
                  setPrizeDraft(data);
                })
              }
            >
              Reset
            </Button>
            <Button variant="contained" onClick={() => void handleSavePrizes()}>
              Save
            </Button>
          </Box>
        </Box>
      </TabPanel>

      {/* Weekly Reload Tab */}
      <TabPanel value={tabValue} index={3}>
        <WeeklyReloadSection />
      </TabPanel>

      {/* VIP Tier Dialog */}
      <Dialog open={tierDialog} onClose={() => setTierDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Edit VIP Tier</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="Level"
                type="number"
                value={tierForm.level}
                disabled
                sx={{ flex: 1 }}
                helperText="Level cannot be changed"
              />
              <TextField
                label="Name"
                value={tierForm.name}
                onChange={(e) => setTierForm({ ...tierForm, name: e.target.value })}
                sx={{ flex: 1 }}
                disabled
                helperText="Name cannot be changed"
              />
            </Box>

            <TextField
              fullWidth
              label="Description"
              multiline
              rows={2}
              value={tierForm.description}
              onChange={(e) => setTierForm({ ...tierForm, description: e.target.value })}
            />

            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <TextField
                label="Image URL"
                value={tierForm.imageUrl}
                onChange={(e) => setTierForm({ ...tierForm, imageUrl: e.target.value })}
                sx={{ flex: 1 }}
                disabled
                helperText="Image URL cannot be changed"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={tierForm.isForVip}
                    onChange={(e) => setTierForm({ ...tierForm, isForVip: e.target.checked })}
                  />
                }
                label="Is for VIP"
              />
            </Box>

            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="Wager Requirement ($)"
                type="number"
                inputProps={{ min: 0, step: 0.01 }}
                value={tierForm.wagerRequirement}
                onChange={(e) => setTierForm({ ...tierForm, wagerRequirement: e.target.value })}
                sx={{ flex: 1 }}
              />
              <TextField
                label="Level Up Bonus Amount ($)"
                type="number"
                inputProps={{ min: 0, step: 0.01 }}
                value={tierForm.levelUpBonusAmount}
                onChange={(e) => setTierForm({ ...tierForm, levelUpBonusAmount: e.target.value })}
                sx={{ flex: 1 }}
              />
            </Box>

            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="Rakeback Percentage"
                type="number"
                inputProps={{ min: 0, max: 100, step: 0.01 }}
                value={tierForm.rakebackPercentage}
                onChange={(e) => setTierForm({ ...tierForm, rakebackPercentage: e.target.value })}
                sx={{ flex: 1 }}
              />
              <TextField
                label="Rank Up Bonus ($)"
                type="number"
                inputProps={{ min: 0, step: 0.01 }}
                value={tierForm.rankUpBonusAmount}
                onChange={(e) => setTierForm({ ...tierForm, rankUpBonusAmount: e.target.value })}
                sx={{ flex: 1 }}
              />
            </Box>

            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="Weekly Bonus Percentage"
                type="number"
                inputProps={{ min: 0, max: 100, step: 0.01 }}
                value={tierForm.weeklyBonusPercentage}
                onChange={(e) =>
                  setTierForm({ ...tierForm, weeklyBonusPercentage: e.target.value })
                }
                sx={{ flex: 1 }}
              />
              <TextField
                label="Monthly Bonus Percentage"
                type="number"
                inputProps={{ min: 0, max: 100, step: 0.01 }}
                value={tierForm.monthlyBonusPercentage}
                onChange={(e) =>
                  setTierForm({ ...tierForm, monthlyBonusPercentage: e.target.value })
                }
                sx={{ flex: 1 }}
              />
            </Box>

            {/* Weekly Reload Settings */}
            <Box>
              <Typography variant="subtitle1" gutterBottom>
                Weekly Reload Settings
              </Typography>
              <Box display="flex" gap={2}>
                <TextField
                  label="Weekly Reload (Profitable Players) %"
                  type="number"
                  inputProps={{ min: 0, max: 100, step: 0.01 }}
                  value={tierForm.weeklyReloadProfitablePercentage}
                  onChange={(e) =>
                    setTierForm({ ...tierForm, weeklyReloadProfitablePercentage: e.target.value })
                  }
                  sx={{ flex: 1 }}
                />
                <TextField
                  label="Weekly Reload (Losing Players) %"
                  type="number"
                  inputProps={{ min: 0, max: 100, step: 0.01 }}
                  value={tierForm.weeklyReloadLosingPercentage}
                  onChange={(e) =>
                    setTierForm({ ...tierForm, weeklyReloadLosingPercentage: e.target.value })
                  }
                  sx={{ flex: 1 }}
                />
                <TextField
                  label="Weekly Reload Daily Min ($)"
                  type="number"
                  inputProps={{ min: 0, step: 0.01 }}
                  value={tierForm.weeklyReloadDailyMin}
                  onChange={(e) =>
                    setTierForm({ ...tierForm, weeklyReloadDailyMin: e.target.value })
                  }
                  sx={{ flex: 1 }}
                />
              </Box>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTierDialog(false)}>Cancel</Button>
          <Button onClick={() => void handleSaveTier()} variant="contained">
            Update
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Bonus;
