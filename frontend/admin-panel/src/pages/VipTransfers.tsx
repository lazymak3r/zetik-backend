import { Check as CheckIcon, Close as CloseIcon, Visibility } from '@mui/icons-material';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Pagination,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import React, { useCallback, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import VipTransferDetailsDialog from '../components/dialogs/VipTransferDetailsDialog';
import { AppDispatch, RootState } from '../store';
import { fetchVipTiers } from '../store/slices/bonusSlice';
import {
  fetchVipTransfers,
  updateNote,
  VipTransferSubmission,
} from '../store/slices/vipTransfersSlice';

const VipTransfers: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { submissions, total, loading } = useSelector((state: RootState) => state.vipTransfers);
  const { vipTiers } = useSelector((state: RootState) => state.bonus);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [filters, setFilters] = useState({
    tag: '',
    casino: '',
    userId: '',
  });
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<VipTransferSubmission | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteValue, setEditingNoteValue] = useState('');

  const loadVipTransfers = useCallback(() => {
    const params: any = {
      page,
      limit,
    };

    if (filters.tag) params.tag = filters.tag;
    if (filters.casino) params.casino = filters.casino;
    if (filters.userId) params.userId = filters.userId;

    void dispatch(fetchVipTransfers(params));
  }, [dispatch, page, limit, filters]);

  useEffect(() => {
    loadVipTransfers();
  }, [loadVipTransfers]);

  useEffect(() => {
    if (vipTiers.length === 0) {
      void dispatch(fetchVipTiers());
    }
  }, [dispatch, vipTiers.length]);

  const handleViewDetails = (submission: VipTransferSubmission) => {
    setSelectedSubmission(submission);
    setDetailsOpen(true);
  };

  const handleCloseDetails = () => {
    setDetailsOpen(false);
    setSelectedSubmission(null);
  };

  const handleStartEditNote = useCallback((submission: VipTransferSubmission) => {
    setEditingNoteId(submission.id);
    setEditingNoteValue(submission.customNote || '');
  }, []);

  const handleCancelEditNote = useCallback(() => {
    setEditingNoteId(null);
    setEditingNoteValue('');
  }, []);

  const handleSaveNote = useCallback(async () => {
    if (editingNoteId) {
      await dispatch(
        updateNote({ id: editingNoteId, customNote: editingNoteValue.trim() || undefined }),
      );
      setEditingNoteId(null);
      setEditingNoteValue('');
      loadVipTransfers();
    }
  }, [dispatch, editingNoteId, editingNoteValue, loadVipTransfers]);

  const handlePageChange = (_: React.ChangeEvent<unknown>, value: number) => {
    setPage(value);
  };

  const handleLimitChange = (e: any) => {
    setLimit(e.target.value);
    setPage(1);
  };

  const getTagColor = (tag?: string) => {
    switch (tag) {
      case 'New':
        return 'default';
      case 'Pending':
        return 'warning';
      case 'Approved':
        return 'success';
      case 'Rejected':
        return 'error';
      default:
        return 'default';
    }
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        VIP Transfer Submissions
      </Typography>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box display="flex" gap={2} flexWrap="wrap" alignItems="center">
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Tag</InputLabel>
              <Select
                value={filters.tag}
                onChange={(e) => setFilters({ ...filters, tag: e.target.value })}
                label="Tag"
              >
                <MenuItem value="">All</MenuItem>
                <MenuItem value="New">New</MenuItem>
                <MenuItem value="Pending">Pending</MenuItem>
                <MenuItem value="Approved">Approved</MenuItem>
                <MenuItem value="Rejected">Rejected</MenuItem>
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Casino</InputLabel>
              <Select
                value={filters.casino}
                onChange={(e) => setFilters({ ...filters, casino: e.target.value })}
                label="Casino"
              >
                <MenuItem value="">All</MenuItem>
                <MenuItem value="shuffle">Shuffle</MenuItem>
                <MenuItem value="rollbit">Rollbit</MenuItem>
                <MenuItem value="gamdom">Gamdom</MenuItem>
                <MenuItem value="roobet">Roobet</MenuItem>
                <MenuItem value="bcgame">BC.Game</MenuItem>
              </Select>
            </FormControl>

            <TextField
              size="small"
              label="User ID"
              value={filters.userId}
              onChange={(e) => setFilters({ ...filters, userId: e.target.value })}
              sx={{ minWidth: 200 }}
            />

            <Button
              variant="outlined"
              onClick={() =>
                setFilters({
                  tag: '',
                  casino: '',
                  userId: '',
                })
              }
            >
              Clear Filters
            </Button>
          </Box>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell></TableCell>
                  <TableCell>User</TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell>Casino</TableCell>
                  <TableCell>Rank</TableCell>
                  <TableCell>Total Wager</TableCell>
                  <TableCell>Tag</TableCell>
                  <TableCell>Note</TableCell>
                  <TableCell>Submitted</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={9} align="center">
                      <Typography variant="body2">Loading...</Typography>
                    </TableCell>
                  </TableRow>
                ) : submissions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} align="center">
                      <Typography variant="body2">No submissions found</Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  submissions.map((submission) => {
                    const isEditing = editingNoteId === submission.id;

                    return (
                      <TableRow key={submission.id}>
                        <TableCell>
                          <Tooltip title="View Details">
                            <IconButton size="small" onClick={() => handleViewDetails(submission)}>
                              <Visibility fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {`${submission.user?.username || 'N/A'} (${submission.user?.email || 'N/A'})`}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{submission.name}</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{submission.casino}</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{submission.rank}</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            $
                            {parseFloat(submission.totalWager).toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={submission.tag || 'New'}
                            size="small"
                            color={getTagColor(submission.tag) as any}
                          />
                        </TableCell>
                        <TableCell sx={{ minWidth: '250px' }}>
                          {isEditing ? (
                            <TextField
                              fullWidth
                              multiline
                              rows={2}
                              value={editingNoteValue}
                              onChange={(e) => setEditingNoteValue(e.target.value)}
                              variant="outlined"
                              size="small"
                              placeholder="Enter note..."
                              InputProps={{
                                endAdornment: (
                                  <InputAdornment position="end">
                                    <IconButton
                                      size="small"
                                      onClick={() => void handleSaveNote()}
                                      title="Save"
                                      color="primary"
                                    >
                                      <CheckIcon />
                                    </IconButton>
                                    <IconButton
                                      size="small"
                                      onClick={handleCancelEditNote}
                                      title="Cancel"
                                    >
                                      <CloseIcon />
                                    </IconButton>
                                  </InputAdornment>
                                ),
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && e.ctrlKey) {
                                  void handleSaveNote();
                                } else if (e.key === 'Escape') {
                                  handleCancelEditNote();
                                }
                              }}
                              autoFocus
                            />
                          ) : (
                            <Box
                              onDoubleClick={() => handleStartEditNote(submission)}
                              sx={{
                                cursor: 'pointer',
                                minHeight: '40px',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'center',
                                padding: '8px',
                                borderRadius: '4px',
                                width: '100%',
                                '&:hover': {
                                  backgroundColor: 'action.hover',
                                },
                              }}
                              title="Double-click to edit note"
                            >
                              {submission.customNote ? (
                                <>
                                  <Typography
                                    variant="body2"
                                    sx={{
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    {submission.customNote}
                                  </Typography>
                                  {submission.taggedByAdmin && submission.taggedAt && (
                                    <Typography variant="caption" color="text.secondary">
                                      added by <strong>{submission.taggedByAdmin.name}</strong> on{' '}
                                      {new Date(submission.taggedAt).toLocaleDateString('en-US', {
                                        year: 'numeric',
                                        month: 'short',
                                        day: 'numeric',
                                      })}
                                    </Typography>
                                  )}
                                </>
                              ) : (
                                <Typography
                                  variant="body2"
                                  sx={{ color: 'text.secondary', fontStyle: 'italic' }}
                                >
                                  No note - double-click to add
                                </Typography>
                              )}
                            </Box>
                          )}
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {new Date(submission.createdAt).toLocaleString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>

          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              mt: 3,
              position: 'relative',
            }}
          >
            <Pagination
              count={Math.ceil(total / limit)}
              page={page}
              onChange={handlePageChange}
              color="primary"
            />
            <FormControl size="small" sx={{ minWidth: 120, position: 'absolute', right: 0 }}>
              <InputLabel>Items per page</InputLabel>
              <Select value={limit} label="Items per page" onChange={handleLimitChange}>
                <MenuItem value={10}>10</MenuItem>
                <MenuItem value={20}>20</MenuItem>
                <MenuItem value={50}>50</MenuItem>
                <MenuItem value={100}>100</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </CardContent>
      </Card>

      <VipTransferDetailsDialog
        open={detailsOpen}
        submission={selectedSubmission}
        onClose={handleCloseDetails}
        onUpdate={loadVipTransfers}
      />
    </Box>
  );
};

export default VipTransfers;
