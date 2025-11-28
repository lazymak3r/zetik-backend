import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { memo, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../../../../store';
import { getPromocodeHistory } from '../../../../store/promocodes/thunks';

interface PromocodeHistoryProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  promocodeId?: string;
  promocodeCode?: string;
}

export const PromocodeHistoryComponent = ({
  open,
  onClose,
  promocodeId,
  promocodeCode,
}: PromocodeHistoryProps) => {
  const dispatch = useDispatch<AppDispatch>();
  const { auditHistory, loading, error } = useSelector((state: RootState) => state.promocodes);

  useEffect(() => {
    if (open && promocodeId) {
      dispatch(getPromocodeHistory(promocodeId));
    }
  }, [dispatch, open, promocodeId]);

  const getActionColor = (action: string) => {
    switch (action) {
      case 'CREATED':
        return 'success';
      case 'UPDATED':
        return 'info';
      case 'PAUSED':
        return 'warning';
      case 'RESUMED':
        return 'success';
      case 'CANCELLED':
        return 'error';
      default:
        return 'default';
    }
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'CREATED':
        return 'Created';
      case 'UPDATED':
        return 'Updated';
      case 'PAUSED':
        return 'Paused';
      case 'RESUMED':
        return 'Resumed';
      case 'CANCELLED':
        return 'Cancelled';
      default:
        return action;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ru-RU');
  };

  const renderValueChanges = (
    previousValues?: Record<string, any>,
    newValues?: Record<string, any>,
  ) => {
    if (!previousValues && !newValues) return null;

    const changes: Array<{ field: string; oldValue: any; newValue: any }> = [];

    if (previousValues && newValues) {
      Object.keys(newValues).forEach((key) => {
        if (previousValues[key] !== newValues[key]) {
          changes.push({
            field: key,
            oldValue: previousValues[key],
            newValue: newValues[key],
          });
        }
      });
    } else if (newValues) {
      Object.keys(newValues).forEach((key) => {
        changes.push({
          field: key,
          oldValue: null,
          newValue: newValues[key],
        });
      });
    }

    if (changes.length === 0) return null;

    return (
      <Box sx={{ mt: 1 }}>
        <Typography variant="subtitle2" gutterBottom>
          Changes:
        </Typography>
        {changes.map((change, index) => (
          <Box key={index} sx={{ mb: 1, p: 1, bgcolor: 'grey.50', borderRadius: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
              {getFieldLabel(change.field)}:
            </Typography>
            {change.oldValue !== null && (
              <Typography variant="body2" color="error">
                Was: {formatFieldValue(change.field, change.oldValue)}
              </Typography>
            )}
            <Typography variant="body2" color="success.main">
              Now: {formatFieldValue(change.field, change.newValue)}
            </Typography>
          </Box>
        ))}
      </Box>
    );
  };

  const getFieldLabel = (field: string) => {
    const labels: Record<string, string> = {
      code: 'Promocode',
      valuePerClaim: 'Amount per claim',
      totalClaims: 'Total claims',
      asset: 'Asset',
      startsAt: 'Start date',
      endsAt: 'End date',
      status: 'Status',
      note: 'Note',
      eligibilityRules: 'Eligibility rules',
    };
    return labels[field] || field;
  };

  const formatFieldValue = (field: string, value: any) => {
    if (value === null || value === undefined) return 'Not specified';

    switch (field) {
      case 'startsAt':
      case 'endsAt':
        return formatDate(value);
      case 'valuePerClaim':
        return `${(parseFloat(value) / 100).toFixed(2)} cents`;
      case 'eligibilityRules':
        return JSON.stringify(value, null, 2);
      default:
        return String(value);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        Promocode Operation History
        {promocodeCode && (
          <Typography variant="subtitle1" color="text.secondary">
            {promocodeCode}
          </Typography>
        )}
      </DialogTitle>
      <DialogContent>
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {!loading && !error && auditHistory.length === 0 && (
          <Alert severity="info">Operation history is empty</Alert>
        )}

        {!loading && !error && auditHistory.length > 0 && (
          <TableContainer component={Paper} sx={{ mt: 2 }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Action</TableCell>
                  <TableCell>Administrator</TableCell>
                  <TableCell>Details</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {auditHistory.map((audit) => (
                  <TableRow key={audit.id}>
                    <TableCell>
                      <Typography variant="body2">{formatDate(audit.createdAt)}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={getActionLabel(audit.action)}
                        color={getActionColor(audit.action) as any}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{audit.adminEmail || audit.adminId}</Typography>
                    </TableCell>
                    <TableCell>
                      <Accordion>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                          <Typography variant="body2">Show details</Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                          {audit.reason && (
                            <Box sx={{ mb: 2 }}>
                              <Typography variant="subtitle2" gutterBottom>
                                Reason:
                              </Typography>
                              <Typography variant="body2">{audit.reason}</Typography>
                            </Box>
                          )}
                          {renderValueChanges(audit.previousValues, audit.newValues)}
                        </AccordionDetails>
                      </Accordion>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DialogContent>
    </Dialog>
  );
};

export const PromocodeHistory = memo(PromocodeHistoryComponent);
