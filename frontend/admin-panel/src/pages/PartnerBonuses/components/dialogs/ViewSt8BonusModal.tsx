import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import React, { memo, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../../../../store';
import { fetchSt8BonusById } from '../../../../store/st8Bonus/thunks';

type Props = {
  open: boolean;
  onClose: () => void;
  bonusId: string | null;
  site?: string;
};

const ViewSt8BonusModalComponent: React.FC<Props> = ({ open, onClose, bonusId, site }) => {
  const dispatch = useDispatch<AppDispatch>();
  const { bonusDetails, bonusDetailsLoading, bonusDetailsError } = useSelector(
    (state: RootState) => state.st8Bonus,
  );

  const bonusData = bonusId ? bonusDetails[bonusId] : null;
  const isLoading = bonusId ? bonusDetailsLoading[bonusId] : false;
  const error = bonusId ? bonusDetailsError[bonusId] : null;

  useEffect(() => {
    if (open && bonusId) {
      dispatch(fetchSt8BonusById({ bonusId, site }));
    }
  }, [dispatch, open, bonusId, site]);

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return 'success';
      case 'pending':
        return 'warning';
      case 'canceled':
      case 'cancelled':
        return 'default';
      case 'expired':
      case 'finished':
        return 'error';
      default:
        return 'default';
    }
  };

  const getStatusTooltip = (status: string) => {
    switch (status.toLowerCase()) {
      case 'finished':
        return 'Bonus created';
      case 'active':
        return 'Bonus active';
      case 'pending':
        return 'Bonus pending';
      case 'canceled':
      case 'cancelled':
        return 'Bonus cancelled';
      case 'expired':
        return 'Bonus expired';
      default:
        return '';
    }
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  if (!bonusId) return null;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
      <DialogTitle>ST8 Bonus Details</DialogTitle>
      <DialogContent>
        {isLoading ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 4 }}>
            <CircularProgress size={20} />
            <Typography variant="body2">Loading bonus details...</Typography>
          </Box>
        ) : error ? (
          <Alert severity="error" sx={{ my: 2 }}>
            {error}
          </Alert>
        ) : bonusData?.status === 'ok' && bonusData.bonus ? (
          <Stack spacing={3}>
            <Box>
              <Typography variant="h6" gutterBottom>
                General Information
              </Typography>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                  gap: 2,
                }}
              >
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Bonus ID
                  </Typography>
                  <Typography variant="body1" fontWeight="medium">
                    {bonusData.bonus.bonus_id}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Site
                  </Typography>
                  <Typography variant="body1" fontWeight="medium">
                    {bonusData.bonus.site || 'N/A'}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Type
                  </Typography>
                  <Chip
                    label={bonusData.bonus.type}
                    color="primary"
                    size="small"
                    variant="outlined"
                  />
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Status
                  </Typography>
                  <Tooltip title={getStatusTooltip(bonusData.bonus.status)}>
                    <Chip
                      label={bonusData.bonus.status}
                      color={getStatusColor(bonusData.bonus.status) as any}
                      size="small"
                    />
                  </Tooltip>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Value
                  </Typography>
                  <Typography variant="body1" fontWeight="medium">
                    {parseFloat(bonusData.bonus.value).toFixed(2)} {bonusData.bonus.currency}
                  </Typography>
                </Box>
                {bonusData.bonus.count && (
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Count
                    </Typography>
                    <Typography variant="body1" fontWeight="medium">
                      {bonusData.bonus.count}
                    </Typography>
                  </Box>
                )}
              </Box>
            </Box>

            <Divider />

            <Box>
              <Typography variant="h6" gutterBottom>
                Game Codes
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {bonusData.bonus.game_codes.map((gameCode, index) => (
                  <Chip key={index} label={gameCode} size="small" variant="outlined" />
                ))}
              </Box>
            </Box>

            <Divider />

            <Box>
              <Typography variant="h6" gutterBottom>
                Player Instances ({bonusData.bonus.instances.length})
              </Typography>
              {bonusData.bonus.instances.length > 0 ? (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Instance ID</TableCell>
                      <TableCell>Player</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Cancel Status</TableCell>
                      <TableCell>Start Time</TableCell>
                      <TableCell>End Time</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {bonusData.bonus.instances.map((instance, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <Typography variant="body2" fontFamily="monospace">
                            {instance.instance_id}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontFamily="monospace">
                            {instance.player}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Tooltip title={getStatusTooltip(instance.status)}>
                            <Chip
                              label={instance.status}
                              color={getStatusColor(instance.status) as any}
                              size="small"
                            />
                          </Tooltip>
                        </TableCell>
                        <TableCell>
                          {instance.cancel_status ? (
                            <Chip
                              label={instance.cancel_status}
                              color="default"
                              size="small"
                              variant="outlined"
                            />
                          ) : (
                            <Typography variant="body2" color="text.secondary">
                              N/A
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {instance.start_time ? formatDateTime(instance.start_time) : 'N/A'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {instance.end_time ? formatDateTime(instance.end_time) : 'N/A'}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No instances found
                </Typography>
              )}
            </Box>
          </Stack>
        ) : (
          <Alert severity="warning" sx={{ my: 2 }}>
            No bonus data available
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export const ViewSt8BonusModal = memo(ViewSt8BonusModalComponent);
