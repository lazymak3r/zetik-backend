import {
  Add as AddIcon,
  Cancel as CancelIcon,
  Receipt as ClaimsIcon,
  Rule as EligibilityIcon,
  History as HistoryIcon,
  Pause as PauseIcon,
  PlayArrow as ResumeIcon,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Pagination,
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
  Tooltip,
  Typography,
} from '@mui/material';
import React, { useCallback, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  ClaimsHistoryDialog,
  CreatePromocodeDialog,
  EligibilityRulesDialog,
  PromocodeHistory,
} from '../components/dialogs/promocodes';
import { NoteCell } from '../components/promocodes';
import { useDebounce } from '../hooks/useDebounce';
import { AppDispatch, RootState } from '../store';
import { clearError } from '../store/promocodes/slice';
import {
  cancelPromocode,
  fetchPromocodes,
  pausePromocode,
  resumePromocode,
} from '../store/promocodes/thunks';
import { IPromocodeAdminResponse } from '../types/promocode.types';

const STATUSES = [
  { label: 'All', status: undefined },
  { label: 'Active', status: 'ACTIVE' },
  { label: 'Paused', status: 'PAUSED' },
  { label: 'Cancelled', status: 'CANCELLED' },
  { label: 'Expired', status: 'EXPIRED' },
] as const;

const Promocodes: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { promocodes, total, error } = useSelector((state: RootState) => state.promocodes);

  const [tabValue, setTabValue] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [searchCode, setSearchCode] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [claimsHistoryDialogOpen, setClaimsHistoryDialogOpen] = useState(false);
  const [eligibilityDialogOpen, setEligibilityDialogOpen] = useState(false);
  const [selectedPromocode, setSelectedPromocode] = useState<IPromocodeAdminResponse | null>(null);

  const debouncedSearchCode = useDebounce(searchCode, 500);

  useEffect(() => {
    const status = STATUSES[tabValue]?.status;
    dispatch(
      fetchPromocodes({
        status,
        page,
        limit,
        search: debouncedSearchCode || undefined,
      }),
    );
  }, [dispatch, tabValue, page, limit, debouncedSearchCode]);

  const toggleCreateDialog = useCallback(() => {
    setCreateDialogOpen(!createDialogOpen);
  }, [createDialogOpen]);

  const handleViewHistory = useCallback((promocode: IPromocodeAdminResponse) => {
    setSelectedPromocode(promocode);
    setHistoryDialogOpen(true);
  }, []);

  const toggleHistoryDialog = useCallback(() => {
    setHistoryDialogOpen(!historyDialogOpen);
    if (!historyDialogOpen) {
      setSelectedPromocode(null);
    }
  }, [historyDialogOpen]);

  const handleViewClaimsHistory = useCallback((promocode: IPromocodeAdminResponse) => {
    setSelectedPromocode(promocode);
    setClaimsHistoryDialogOpen(true);
  }, []);

  const toggleClaimsHistoryDialog = useCallback(() => {
    setClaimsHistoryDialogOpen(!claimsHistoryDialogOpen);
    if (!claimsHistoryDialogOpen) {
      setSelectedPromocode(null);
    }
  }, [claimsHistoryDialogOpen]);

  const handleViewEligibility = useCallback((promocode: IPromocodeAdminResponse) => {
    setSelectedPromocode(promocode);
    setEligibilityDialogOpen(true);
  }, []);

  const toggleEligibilityDialog = useCallback(() => {
    setEligibilityDialogOpen(!eligibilityDialogOpen);
    if (!eligibilityDialogOpen) {
      setSelectedPromocode(null);
    }
  }, [eligibilityDialogOpen]);

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
    setPage(1);
  };

  const handlePageChange = (_: React.ChangeEvent<unknown>, value: number) => {
    setPage(value);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchCode(e.target.value);
    setPage(1);
  };

  const handleLimitChange = (e: any) => {
    setLimit(e.target.value);
    setPage(1);
  };

  const handleCreateSuccess = () => {
    const status = STATUSES[tabValue]?.status;
    dispatch(
      fetchPromocodes({
        status,
        page,
        limit,
        search: debouncedSearchCode || undefined,
      }),
    );
  };

  const handlePause = (id: string) => {
    dispatch(pausePromocode(id));
  };

  const handleResume = (id: string) => {
    dispatch(resumePromocode(id));
  };

  const handleCancel = (id: string) => {
    dispatch(cancelPromocode(id));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'success';
      case 'PAUSED':
        return 'warning';
      case 'CANCELLED':
        return 'error';
      case 'EXPIRED':
        return 'default';
      default:
        return 'default';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Promocodes
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={toggleCreateDialog}>
          Create Promocode
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => dispatch(clearError())}>
          {error}
        </Alert>
      )}

      <Card>
        <CardContent>
          <Box
            sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}
          >
            <TextField
              label="Search by code"
              variant="outlined"
              size="small"
              value={searchCode}
              onChange={handleSearchChange}
              sx={{ width: 300 }}
            />
          </Box>

          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs value={tabValue} onChange={handleTabChange} aria-label="promocode status tabs">
              {STATUSES.map((tab, index) => (
                <Tab key={index} label={tab.label} />
              ))}
            </Tabs>
          </Box>

          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Code</TableCell>
                  <TableCell>Value per claim</TableCell>
                  <TableCell>Claims</TableCell>
                  <TableCell>Asset</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Start Date</TableCell>
                  <TableCell>End Date</TableCell>
                  <TableCell>Created by</TableCell>
                  <TableCell>Notes (Double-click to edit)</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {promocodes.map((promocode) => (
                  <TableRow key={promocode.id}>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                        {promocode.code}
                      </Typography>
                    </TableCell>
                    <TableCell>{parseFloat(promocode.valuePerClaim)}</TableCell>
                    <TableCell>
                      {promocode.claimedCount} / {promocode.totalClaims}
                    </TableCell>
                    <TableCell>{promocode.asset}</TableCell>
                    <TableCell>
                      <Chip
                        label={promocode.status}
                        color={getStatusColor(promocode.status) as any}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>{formatDate(promocode.startsAt)}</TableCell>
                    <TableCell>{formatDate(promocode.endsAt)}</TableCell>
                    <TableCell>{promocode.createdByAdminEmail}</TableCell>
                    <TableCell sx={{ minWidth: '200px' }}>
                      <NoteCell promocodeId={promocode.id} note={promocode.note} />
                    </TableCell>
                    <TableCell>
                      <Tooltip title="View promocode change history">
                        <IconButton size="small" onClick={() => handleViewHistory(promocode)}>
                          <HistoryIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="View promocode claims history">
                        <IconButton size="small" onClick={() => handleViewClaimsHistory(promocode)}>
                          <ClaimsIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="View eligibility rules">
                        <IconButton size="small" onClick={() => handleViewEligibility(promocode)}>
                          <EligibilityIcon />
                        </IconButton>
                      </Tooltip>
                      {promocode.status === 'ACTIVE' && (
                        <Tooltip title="Pause promocode">
                          <IconButton size="small" onClick={() => handlePause(promocode.id)}>
                            <PauseIcon />
                          </IconButton>
                        </Tooltip>
                      )}
                      {promocode.status === 'PAUSED' && (
                        <Tooltip title="Resume promocode">
                          <IconButton size="small" onClick={() => handleResume(promocode.id)}>
                            <ResumeIcon />
                          </IconButton>
                        </Tooltip>
                      )}
                      {(promocode.status === 'ACTIVE' || promocode.status === 'PAUSED') && (
                        <Tooltip title="Cancel promocode">
                          <IconButton size="small" onClick={() => handleCancel(promocode.id)}>
                            <CancelIcon />
                          </IconButton>
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
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

      <CreatePromocodeDialog
        open={createDialogOpen}
        onClose={toggleCreateDialog}
        onSuccess={handleCreateSuccess}
      />

      <PromocodeHistory
        open={historyDialogOpen}
        onClose={toggleHistoryDialog}
        promocodeId={selectedPromocode?.id}
        promocodeCode={selectedPromocode?.code}
      />

      <ClaimsHistoryDialog
        open={claimsHistoryDialogOpen}
        onClose={toggleClaimsHistoryDialog}
        promocodeId={selectedPromocode?.id}
        promocodeCode={selectedPromocode?.code}
      />

      <EligibilityRulesDialog
        open={eligibilityDialogOpen}
        onClose={toggleEligibilityDialog}
        eligibilityRules={selectedPromocode?.eligibilityRules || {}}
        promocodeCode={selectedPromocode?.code || ''}
      />
    </Box>
  );
};

export default Promocodes;
