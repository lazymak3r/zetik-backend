import { CheckCircle, Error, PlayArrow, Schedule, Search, Timer } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Paper,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import React, { useCallback, useState } from 'react';
import { api } from '../config/api';

interface SelfExclusion {
  id: string;
  userId: string;
  type: string;
  platform: string;
  endDate: string;
  postCooldownWindowEnd?: string;
  removalRequestedAt?: string;
  isActive: boolean;
}

interface GamblingLimit {
  id: string;
  userId: string;
  type: string;
  period: string;
  limit: number;
  used: number;
  platform: string;
  removalRequestedAt?: string;
}

interface TestResult {
  success: boolean;
  message: string;
  timestamp: string;
}

const SelfExclusionTesting: React.FC = () => {
  const [userId, setUserId] = useState('');
  const [userExclusions, setUserExclusions] = useState<SelfExclusion[]>([]);
  const [userLimits, setUserLimits] = useState<GamblingLimit[]>([]);
  const [loading, setLoading] = useState(false);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const showSnackbar = (message: string, severity: 'success' | 'error') => {
    setSnackbar({ open: true, message, severity });
  };

  const addTestResult = (success: boolean, message: string) => {
    setTestResults((prev) => [
      {
        success,
        message,
        timestamp: new Date().toLocaleTimeString(),
      },
      ...prev.slice(0, 9), // Keep last 10 results
    ]);
  };

  const fetchUserData = useCallback(async () => {
    if (!userId.trim()) {
      showSnackbar('Please enter a user ID', 'error');
      return;
    }

    setLoading(true);
    try {
      // Fetch self-exclusions via admin testing endpoint
      const exclusionsRes = await api.get(`/testing/self-exclusion/${userId}`);
      setUserExclusions(exclusionsRes.data || []);

      // Fetch gambling limits via admin testing endpoint
      const limitsRes = await api.get(`/testing/self-exclusion/gambling-limits/${userId}`);
      setUserLimits(limitsRes.data?.limits || []);

      addTestResult(true, `Loaded data for user ${userId}`);
      showSnackbar('User data loaded successfully', 'success');
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || error.message || 'Failed to load user data';
      addTestResult(false, `Error loading user data: ${errorMsg}`);
      showSnackbar(errorMsg, 'error');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const expireCooldown = async (cooldownId: string) => {
    setLoading(true);
    try {
      await api.post(`/testing/self-exclusion/expire-cooldown/${cooldownId}`);
      addTestResult(true, `Expired cooldown ${cooldownId} - post-cooldown window started`);
      showSnackbar('Cooldown expired successfully! Post-cooldown window is now active.', 'success');
      await fetchUserData();
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || error.message;
      addTestResult(false, `Error expiring cooldown: ${errorMsg}`);
      showSnackbar(errorMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const expireWindow = async (cooldownId: string) => {
    setLoading(true);
    try {
      await api.post(`/testing/self-exclusion/expire-window/${cooldownId}`);
      addTestResult(true, `Expired window for ${cooldownId} - will silent revert on next cron`);
      showSnackbar('Window expired! Exclusion will silent revert on next cron run.', 'success');
      await fetchUserData();
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || error.message;
      addTestResult(false, `Error expiring window: ${errorMsg}`);
      showSnackbar(errorMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const expireRemoval = async (limitId: string) => {
    setLoading(true);
    try {
      await api.post(`/testing/self-exclusion/expire-removal/${limitId}`);
      addTestResult(
        true,
        `Expired removal countdown for limit ${limitId} - will delete on next cron`,
      );
      showSnackbar('Removal countdown expired! Limit will be deleted on next cron run.', 'success');
      await fetchUserData();
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || error.message;
      addTestResult(false, `Error expiring removal: ${errorMsg}`);
      showSnackbar(errorMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const runCronJob = async () => {
    setLoading(true);
    try {
      await api.post(`/testing/self-exclusion/run-cron`);
      addTestResult(true, 'Triggered cron job manually - processing expirations');
      showSnackbar('Cron job triggered! Processing will complete asynchronously.', 'success');

      // Wait a bit then refresh
      setTimeout(() => {
        void fetchUserData();
      }, 2000);
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || error.message;
      addTestResult(false, `Error running cron: ${errorMsg}`);
      showSnackbar(errorMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const getStatusChip = (exclusion: SelfExclusion) => {
    if (exclusion.type === 'COOLDOWN' && exclusion.postCooldownWindowEnd) {
      return <Chip label="In Window" color="warning" size="small" />;
    }
    if (exclusion.isActive) {
      return <Chip label="Active" color="success" size="small" />;
    }
    return <Chip label="Inactive" color="default" size="small" />;
  };

  const getRemovalStatus = (limit: GamblingLimit) => {
    if (!limit.removalRequestedAt) {
      return <Chip label="Active" color="success" size="small" />;
    }
    return <Chip label="Removal Pending" color="warning" size="small" icon={<Timer />} />;
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Self-Exclusion Testing Controls
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        Test self-exclusion features without waiting 24 hours. Use these controls to manipulate
        timestamps for testing purposes only.
      </Typography>

      {/* User Search Section */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            1. Search User
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            <Box sx={{ flex: '1 1 300px' }}>
              <TextField
                fullWidth
                label="User ID"
                placeholder="Enter user ID (UUID)"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && void fetchUserData()}
                disabled={loading}
              />
            </Box>
            <Box sx={{ flex: '0 1 200px' }}>
              <Button
                fullWidth
                variant="contained"
                startIcon={loading ? <CircularProgress size={20} /> : <Search />}
                onClick={() => void fetchUserData()}
                disabled={loading || !userId.trim()}
              >
                Load User Data
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Self-Exclusions Table */}
      {userExclusions.length > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              2. Active Self-Exclusions & Cooldowns
            </Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Type</TableCell>
                    <TableCell>Platform</TableCell>
                    <TableCell>End Date</TableCell>
                    <TableCell>Window End</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {userExclusions.map((exclusion) => (
                    <TableRow key={exclusion.id}>
                      <TableCell>{exclusion.type}</TableCell>
                      <TableCell>{exclusion.platform}</TableCell>
                      <TableCell>{formatDate(exclusion.endDate)}</TableCell>
                      <TableCell>{formatDate(exclusion.postCooldownWindowEnd)}</TableCell>
                      <TableCell>{getStatusChip(exclusion)}</TableCell>
                      <TableCell>
                        {exclusion.type === 'COOLDOWN' && (
                          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                            {!exclusion.postCooldownWindowEnd && (
                              <Button
                                size="small"
                                variant="outlined"
                                startIcon={<Schedule />}
                                onClick={() => void expireCooldown(exclusion.id)}
                                disabled={loading}
                              >
                                Start Window
                              </Button>
                            )}
                            {exclusion.postCooldownWindowEnd && (
                              <Button
                                size="small"
                                variant="outlined"
                                color="warning"
                                startIcon={<Timer />}
                                onClick={() => void expireWindow(exclusion.id)}
                                disabled={loading}
                              >
                                Expire Window
                              </Button>
                            )}
                          </Box>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {/* Gambling Limits Table */}
      {userLimits.length > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              3. Gambling Limits (Loss & Wager)
            </Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Type</TableCell>
                    <TableCell>Period</TableCell>
                    <TableCell>Limit</TableCell>
                    <TableCell>Used</TableCell>
                    <TableCell>Platform</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {userLimits.map((limit) => (
                    <TableRow key={limit.id}>
                      <TableCell>{limit.type}</TableCell>
                      <TableCell>{limit.period}</TableCell>
                      <TableCell>${limit.limit.toFixed(2)}</TableCell>
                      <TableCell>${limit.used.toFixed(2)}</TableCell>
                      <TableCell>{limit.platform}</TableCell>
                      <TableCell>{getRemovalStatus(limit)}</TableCell>
                      <TableCell>
                        {limit.removalRequestedAt && (
                          <Button
                            size="small"
                            variant="outlined"
                            color="warning"
                            startIcon={<Timer />}
                            onClick={() => void expireRemoval(limit.id)}
                            disabled={loading}
                          >
                            Expire Countdown
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {/* Cron Job Control */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            4. Run Cron Job Manually
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            Execute the self-exclusion expiration job to process all pending changes immediately.
          </Typography>
          <Button
            variant="contained"
            color="primary"
            startIcon={loading ? <CircularProgress size={20} /> : <PlayArrow />}
            onClick={() => void runCronJob()}
            disabled={loading}
          >
            Trigger Cron Job Now
          </Button>
        </CardContent>
      </Card>

      {/* Test Results Log */}
      {testResults.length > 0 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Test Results Log
            </Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell width="80px">Status</TableCell>
                    <TableCell width="100px">Time</TableCell>
                    <TableCell>Message</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {testResults.map((result, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        {result.success ? (
                          <CheckCircle color="success" fontSize="small" />
                        ) : (
                          <Error color="error" fontSize="small" />
                        )}
                      </TableCell>
                      <TableCell>{result.timestamp}</TableCell>
                      <TableCell>{result.message}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default SelfExclusionTesting;
