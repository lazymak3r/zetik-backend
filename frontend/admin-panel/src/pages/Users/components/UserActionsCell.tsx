import {
  AccountBalanceWallet,
  Cancel,
  CheckCircle,
  Visibility,
  VolumeOff,
  VolumeUp,
} from '@mui/icons-material';
import { Box, IconButton } from '@mui/material';
import { GridRenderCellParams } from '@mui/x-data-grid';
import React from 'react';

interface UserActionsCellProps {
  params: GridRenderCellParams;
  onViewDetails: (userId: string) => void;
  onToggleBanned: (userId: string, currentStatus: boolean) => void;
  onAdjustBalance: (userId: string) => void;
  onMuteUser: (userId: string) => void;
  onUnmuteUser: (userId: string) => void;
  isUserMuted: (user: any) => boolean;
}

const UserActionsCell: React.FC<UserActionsCellProps> = ({
  params,
  onViewDetails,
  onToggleBanned,
  onAdjustBalance,
  onMuteUser,
  onUnmuteUser,
  isUserMuted,
}) => {
  const user = params.row;
  const isMuted = isUserMuted(user);

  return (
    <Box>
      <IconButton size="small" onClick={() => onViewDetails(user.id)} title="View Details">
        <Visibility />
      </IconButton>
      <IconButton
        size="small"
        onClick={() => onToggleBanned(user.id, user.isBanned)}
        title={user.isBanned ? 'Unban' : 'Ban'}
      >
        {user.isBanned ? <Cancel /> : <CheckCircle />}
      </IconButton>
      <IconButton size="small" onClick={() => onAdjustBalance(user.id)} title="Adjust Balance">
        <AccountBalanceWallet />
      </IconButton>
      <IconButton
        size="small"
        onClick={() => {
          if (isMuted) {
            onUnmuteUser(user.id);
          } else {
            onMuteUser(user.id);
          }
        }}
        title={isMuted ? 'Unmute' : 'Mute'}
      >
        {isMuted ? <VolumeOff /> : <VolumeUp />}
      </IconButton>
    </Box>
  );
};

export default UserActionsCell;
