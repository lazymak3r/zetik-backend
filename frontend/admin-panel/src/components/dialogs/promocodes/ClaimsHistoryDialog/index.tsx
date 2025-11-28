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
import { getPromocodeClaims } from '../../../../store/promocodes/thunks';

interface ClaimsHistoryDialogProps {
  open: boolean;
  onClose: () => void;
  promocodeId?: string;
  promocodeCode?: string;
}

export const ClaimsHistoryDialogComponent = ({
  open,
  onClose,
  promocodeId,
  promocodeCode,
}: ClaimsHistoryDialogProps) => {
  const dispatch = useDispatch<AppDispatch>();
  const { claimsHistory, loading, error } = useSelector((state: RootState) => state.promocodes);

  useEffect(() => {
    if (open && promocodeId) {
      dispatch(getPromocodeClaims(promocodeId));
    }
  }, [dispatch, open, promocodeId]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ru-RU');
  };

  const formatUserAgent = (userAgent?: string) => {
    if (!userAgent) return 'Not specified';

    const browserMatch = userAgent.match(/(Chrome|Firefox|Safari|Edge|Opera)\/[\d.]+/);
    const osMatch = userAgent.match(/(Windows|Mac|Linux|Android|iOS)/);

    const browser = browserMatch ? browserMatch[0] : 'Unknown browser';
    const os = osMatch ? osMatch[0] : 'Unknown OS';

    return `${browser} on ${os}`;
  };

  const renderMetadata = (metadata?: Record<string, any>) => {
    if (!metadata || Object.keys(metadata).length === 0) {
      return (
        <Typography variant="body2" color="text.secondary">
          No additional data
        </Typography>
      );
    }

    return (
      <Box>
        {Object.entries(metadata).map(([key, value]) => (
          <Box key={key} sx={{ mb: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
              {key}:
            </Typography>
            <Typography variant="body2" sx={{ ml: 1 }}>
              {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
            </Typography>
          </Box>
        ))}
      </Box>
    );
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        Promocode Claims History
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

        {!loading && !error && claimsHistory.length === 0 && (
          <Alert severity="info">Claims history is empty</Alert>
        )}

        {!loading && !error && claimsHistory.length > 0 && (
          <TableContainer component={Paper} sx={{ mt: 2 }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Claim Date</TableCell>
                  <TableCell>User</TableCell>
                  <TableCell>Amount</TableCell>
                  <TableCell>IP Address</TableCell>
                  <TableCell>Device</TableCell>
                  <TableCell>Additional Data</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {claimsHistory.map((claim) => (
                  <TableRow key={claim.id}>
                    <TableCell>
                      <Typography variant="body2">{formatDate(claim.createdAt)}</Typography>
                    </TableCell>
                    <TableCell>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                          {claim.userEmail || 'Unknown user'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          ID: {claim.userId}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={`${parseFloat(claim.amount)} ${claim.asset}`}
                        color="success"
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                        {claim.ipAddress || 'Not specified'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{formatUserAgent(claim.userAgent)}</Typography>
                      {claim.deviceFingerprint && (
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ display: 'block' }}
                        >
                          Fingerprint: {claim.deviceFingerprint.substring(0, 8)}...
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Accordion>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                          <Typography variant="body2">Show details</Typography>
                        </AccordionSummary>
                        <AccordionDetails>{renderMetadata(claim.metadata)}</AccordionDetails>
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

export const ClaimsHistoryDialog = memo(ClaimsHistoryDialogComponent);
