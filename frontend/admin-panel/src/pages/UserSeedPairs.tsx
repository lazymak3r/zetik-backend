import {
  ArrowBack,
  Cancel,
  CheckCircle,
  Edit,
  Sync,
  Visibility,
  Warning,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import EditSeedPairDialog from '../components/dialogs/EditSeedPairDialog';
import RotateSeedPairDialog from '../components/dialogs/RotateSeedPairDialog';
import ViewSeedPairDialog from '../components/dialogs/ViewSeedPairDialog';
import { provablyFairService } from '../services/provablyFairService';
import { SeedPair } from '../types/provably-fair.types';

const UserSeedPairs: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const userId = searchParams.get('userId');

  const [activeSeedPair, setActiveSeedPair] = useState<SeedPair | null>(null);
  const [seedPairs, setSeedPairs] = useState<SeedPair[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [rotateDialogOpen, setRotateDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedSeedPair, setSelectedSeedPair] = useState<SeedPair | null>(null);

  useEffect(() => {
    if (userId) {
      void loadData();
    }
  }, [userId, page, pageSize]);

  const loadData = async () => {
    if (!userId) return;

    setLoading(true);
    setError(null);

    try {
      // Load active seed pair and history in parallel
      const [activeResult, historyResult] = await Promise.all([
        provablyFairService.getActiveSeedPair(userId),
        provablyFairService.getSeedPairs(userId, page + 1, pageSize),
      ]);

      setActiveSeedPair(activeResult);
      setSeedPairs(historyResult.seedPairs);
      setTotal(historyResult.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load seed pairs');
    } finally {
      setLoading(false);
    }
  };

  const handleEditActive = () => {
    if (activeSeedPair) {
      setSelectedSeedPair(activeSeedPair);
      setEditDialogOpen(true);
    }
  };

  const handleRotate = () => {
    setRotateDialogOpen(true);
  };

  const handleViewDetails = (seedPair: SeedPair) => {
    setSelectedSeedPair(seedPair);
    setViewDialogOpen(true);
  };

  const handleSuccess = () => {
    void loadData();
  };

  const formatDate = (date: string | Date): string => {
    return new Date(date).toLocaleDateString();
  };

  const truncateSeed = (seed: string, length: number = 16): string => {
    if (seed.length <= length) return seed;
    return `${seed.slice(0, length)}...`;
  };

  if (!userId) {
    return (
      <Box>
        <Alert severity="error">User ID is required. Please select a user.</Alert>
        <Button
          startIcon={<ArrowBack />}
          onClick={() => {
            navigate('/users');
          }}
          sx={{ mt: 2 }}
        >
          Back to Users
        </Button>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box display="flex" alignItems="center" gap={2} mb={3}>
        <IconButton
          onClick={() => {
            navigate('/users');
          }}
        >
          <ArrowBack />
        </IconButton>
        <Box>
          <Typography variant="h4">Provably Fair - Seed Pairs</Typography>
          <Typography variant="body2" color="textSecondary" sx={{ fontFamily: 'monospace' }}>
            User ID: {userId}
          </Typography>
        </Box>
      </Box>

      {/* Warning Banner */}
      <Alert severity="warning" icon={<Warning />} sx={{ mb: 3 }}>
        <Typography variant="body2">
          <strong>ADMIN ONLY:</strong> Modifying seed data is for testing purposes only. Changes
          affect game outcomes and provably fair verification.
        </Typography>
      </Alert>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Active Seed Pair Section */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">Active Seed Pair</Typography>
            <Box display="flex" gap={1}>
              <Button
                variant="outlined"
                startIcon={<Edit />}
                onClick={handleEditActive}
                disabled={!activeSeedPair || loading}
                size="small"
              >
                Edit
              </Button>
              <Button
                variant="outlined"
                color="warning"
                startIcon={<Sync />}
                onClick={handleRotate}
                disabled={!activeSeedPair || loading}
                size="small"
              >
                Rotate
              </Button>
            </Box>
          </Box>

          {loading && !activeSeedPair ? (
            <Box display="flex" justifyContent="center" p={4}>
              <CircularProgress />
            </Box>
          ) : activeSeedPair ? (
            <Grid container spacing={2}>
              <Grid size={12}>
                <TextField
                  label="Server Seed"
                  value={activeSeedPair.serverSeed}
                  fullWidth
                  InputProps={{
                    readOnly: true,
                    style: { fontFamily: 'monospace', fontSize: '0.9rem' },
                  }}
                />
              </Grid>
              <Grid size={12}>
                <TextField
                  label="Server Seed Hash"
                  value={activeSeedPair.serverSeedHash}
                  fullWidth
                  InputProps={{
                    readOnly: true,
                    style: { fontFamily: 'monospace', fontSize: '0.9rem', color: '#999' },
                  }}
                />
              </Grid>
              <Grid size={6}>
                <TextField
                  label="Client Seed"
                  value={activeSeedPair.clientSeed}
                  fullWidth
                  InputProps={{ readOnly: true }}
                />
              </Grid>
              <Grid size={6}>
                <TextField
                  label="Nonce"
                  value={activeSeedPair.nonce}
                  fullWidth
                  InputProps={{
                    readOnly: true,
                    style: { fontSize: '1.2rem', fontWeight: 'bold' },
                  }}
                />
              </Grid>
              <Grid size={12}>
                <TextField
                  label="Next Server Seed Hash (Public)"
                  value={activeSeedPair.nextServerSeedHash}
                  fullWidth
                  InputProps={{
                    readOnly: true,
                    style: { fontFamily: 'monospace', fontSize: '0.9rem', color: '#999' },
                  }}
                  helperText="This hash is visible to users before rotation"
                />
              </Grid>
              <Grid size={6}>
                <Typography variant="body2" color="textSecondary">
                  Created At
                </Typography>
                <Typography variant="body1">
                  {new Date(activeSeedPair.createdAt).toLocaleString()}
                </Typography>
              </Grid>
              <Grid size={6}>
                <Typography variant="body2" color="textSecondary">
                  Updated At
                </Typography>
                <Typography variant="body1">
                  {new Date(activeSeedPair.updatedAt).toLocaleString()}
                </Typography>
              </Grid>
            </Grid>
          ) : (
            <Alert severity="info">No active seed pair found for this user.</Alert>
          )}
        </CardContent>
      </Card>

      {/* Seed History Section */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Seed Pair History
          </Typography>

          {loading && seedPairs.length === 0 ? (
            <Box display="flex" justifyContent="center" p={4}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              <TableContainer component={Paper} variant="outlined">
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>ID</TableCell>
                      <TableCell>Server Seed</TableCell>
                      <TableCell>Client Seed</TableCell>
                      <TableCell>Nonce</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Created</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {seedPairs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} align="center">
                          <Typography color="textSecondary">No seed pairs found</Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      seedPairs.map((seedPair) => (
                        <TableRow key={seedPair.id} hover>
                          <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                            {seedPair.id}
                          </TableCell>
                          <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                            {truncateSeed(seedPair.serverSeed)}
                          </TableCell>
                          <TableCell>{truncateSeed(seedPair.clientSeed, 20)}</TableCell>
                          <TableCell>
                            <Typography variant="body2" fontWeight="bold">
                              {seedPair.nonce}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={seedPair.isActive ? 'Active' : 'Inactive'}
                              color={seedPair.isActive ? 'success' : 'default'}
                              size="small"
                              icon={seedPair.isActive ? <CheckCircle /> : <Cancel />}
                            />
                          </TableCell>
                          <TableCell>{formatDate(seedPair.createdAt)}</TableCell>
                          <TableCell>
                            <IconButton
                              size="small"
                              onClick={() => handleViewDetails(seedPair)}
                              title="View Details"
                            >
                              <Visibility />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>

              <TablePagination
                component="div"
                count={total}
                page={page}
                onPageChange={(_, newPage) => setPage(newPage)}
                rowsPerPage={pageSize}
                onRowsPerPageChange={(e) => {
                  setPageSize(parseInt(e.target.value, 10));
                  setPage(0);
                }}
                rowsPerPageOptions={[5, 10, 20, 50]}
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <EditSeedPairDialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        userId={userId}
        seedPair={selectedSeedPair}
        onSuccess={handleSuccess}
      />

      <RotateSeedPairDialog
        open={rotateDialogOpen}
        onClose={() => setRotateDialogOpen(false)}
        userId={userId}
        onSuccess={handleSuccess}
      />

      <ViewSeedPairDialog
        open={viewDialogOpen}
        onClose={() => setViewDialogOpen(false)}
        seedPair={selectedSeedPair}
      />
    </Box>
  );
};

export default UserSeedPairs;
