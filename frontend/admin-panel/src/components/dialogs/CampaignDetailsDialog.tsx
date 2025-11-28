import { ChevronLeft, ChevronRight } from '@mui/icons-material';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Link,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { api } from '../../config/api';
import { AppDispatch, RootState } from '../../store';
import { fetchUserDetails } from '../../store/users/model/users.thunks';
import UserDetailsDialog from './UserDetailsDialog';

interface CampaignDetailsDialogProps {
  open: boolean;
  onClose: () => void;
  campaign: any;
}

const CampaignDetailsDialog: React.FC<CampaignDetailsDialogProps> = ({
  open,
  onClose,
  campaign,
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const { selectedUser } = useSelector((state: RootState) => state.users);
  const [userDetailsOpen, setUserDetailsOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [referralsPage, setReferralsPage] = useState(1);
  const [campaignDetails, setCampaignDetails] = useState<any>(null);

  const handleUserClick = async (userId: string) => {
    setSelectedUserId(userId);
    await dispatch(fetchUserDetails(userId));
    setUserDetailsOpen(true);
  };

  useEffect(() => {
    if (open && campaign?.id) {
      void loadCampaignDetails();
      void loadReferrals();
    } else if (!open) {
      setReferralsPage(1);
      setCampaignDetails(null);
    }
  }, [open, campaign?.id]);

  useEffect(() => {
    if (open && campaign?.id) {
      void loadReferrals();
    }
  }, [referralsPage]);

  const loadCampaignDetails = async () => {
    if (!campaign?.id) return;
    try {
      const response = await api.get(`/affiliate/campaigns/${campaign.id}`);
      setCampaignDetails(response.data);
    } catch (error) {
      console.error('Failed to load campaign details:', error);
    }
  };

  const loadReferrals = async () => {
    if (!campaign?.id) return;
    try {
      const response = await api.get(`/affiliate/campaigns/${campaign.id}/referrals`, {
        params: {
          page: referralsPage,
          limit: 3,
        },
      });
      setCampaignDetails((prev: any) => ({
        ...prev,
        referrals: response.data.referrals,
        referralsPagination: response.data.pagination,
      }));
    } catch (error) {
      console.error('Failed to load referrals:', error);
    }
  };

  if (!campaign) {
    return null;
  }

  const displayCampaign = campaignDetails || campaign;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Campaign Details</DialogTitle>
      <DialogContent>
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Basic Information
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
            <Box>
              <Typography variant="subtitle2" color="text.secondary">
                Campaign Name
              </Typography>
              <Typography variant="body1">{displayCampaign.name || 'Unnamed Campaign'}</Typography>
            </Box>
            <Box>
              <Typography variant="subtitle2" color="text.secondary">
                Description
              </Typography>
              <Typography variant="body1">
                {displayCampaign.description || 'No description'}
              </Typography>
            </Box>
            <Box>
              <Typography variant="subtitle2" color="text.secondary">
                Owner
              </Typography>
              <Typography variant="body1">
                {displayCampaign.owner?.id ? (
                  <Link
                    component="button"
                    variant="body1"
                    onClick={() => void handleUserClick(displayCampaign.owner.id)}
                    sx={{ textAlign: 'left', cursor: 'pointer' }}
                  >
                    {displayCampaign.owner?.email || displayCampaign.owner?.username || 'Unknown'}
                  </Link>
                ) : (
                  'Unknown'
                )}
              </Typography>
            </Box>
            <Box>
              <Typography variant="subtitle2" color="text.secondary">
                Created
              </Typography>
              <Typography variant="body1">
                {displayCampaign.createdAt
                  ? new Date(displayCampaign.createdAt).toLocaleString()
                  : 'Unknown'}
              </Typography>
            </Box>
          </Box>
        </Box>

        <Divider sx={{ my: 3 }} />

        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Campaign Statistics
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
            <Box>
              <Typography variant="subtitle2" color="text.secondary">
                Total Commission
              </Typography>
              <Typography variant="body1">
                ${(displayCampaign.totalCommission || 0).toFixed(2)}
              </Typography>
            </Box>
            <Box>
              <Typography variant="subtitle2" color="text.secondary">
                Registered Users
              </Typography>
              <Typography variant="body1">{displayCampaign.totalReferrals || 0}</Typography>
            </Box>
          </Box>
        </Box>

        <Divider sx={{ my: 3 }} />

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">Referred Users</Typography>
          {displayCampaign.referralsPagination &&
            displayCampaign.referralsPagination.totalPages > 1 && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <IconButton
                  size="small"
                  onClick={() => setReferralsPage((p) => Math.max(1, p - 1))}
                  disabled={referralsPage === 1}
                >
                  <ChevronLeft />
                </IconButton>
                <Typography variant="body2">
                  Page {referralsPage} of {displayCampaign.referralsPagination.totalPages}
                </Typography>
                <IconButton
                  size="small"
                  onClick={() => setReferralsPage((p) => p + 1)}
                  disabled={referralsPage >= displayCampaign.referralsPagination.totalPages}
                >
                  <ChevronRight />
                </IconButton>
              </Box>
            )}
        </Box>
        {displayCampaign.referrals?.length > 0 ? (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>User</TableCell>
                  <TableCell>Total Earned</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(displayCampaign.referrals || []).map((referral: any) => (
                  <TableRow key={referral.userId}>
                    <TableCell>
                      {referral.userId ? (
                        <Link
                          component="button"
                          variant="body2"
                          onClick={() => void handleUserClick(referral.userId)}
                          sx={{ textAlign: 'left', cursor: 'pointer' }}
                        >
                          {referral.email || referral.username || 'Unknown'}
                        </Link>
                      ) : (
                        'Unknown'
                      )}
                    </TableCell>
                    <TableCell>${(referral.totalEarnedUsd || 0).toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <Typography variant="body2" color="text.secondary">
            No referred users found for this campaign.
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>

      {selectedUser && (
        <UserDetailsDialog
          open={userDetailsOpen}
          onClose={() => setUserDetailsOpen(false)}
          user={selectedUser}
          onRefresh={() => selectedUserId && void dispatch(fetchUserDetails(selectedUserId))}
        />
      )}
    </Dialog>
  );
};

export default CampaignDetailsDialog;
