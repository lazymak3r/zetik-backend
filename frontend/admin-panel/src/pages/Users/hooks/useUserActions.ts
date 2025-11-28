import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '../../../store';
import { clearSelectedUser } from '../../../store/users/model/users.slice';
import { fetchUserDetails, unmuteUser, updateUser } from '../../../store/users/model/users.thunks';

export const useUserActions = (loadUsers: () => void) => {
  const dispatch = useDispatch<AppDispatch>();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [balanceDialogOpen, setBalanceDialogOpen] = useState(false);
  const [muteDialogOpen, setMuteDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const handleViewDetails = async (userId: string) => {
    setSelectedUserId(userId);
    try {
      await dispatch(fetchUserDetails(userId)).unwrap();
    } catch (error) {
      console.error('Failed to fetch user details:', error);
      setSelectedUserId(null);
    }
  };

  const handleCloseDetails = () => {
    setDetailsOpen(false);
    setSelectedUserId(null);
    dispatch(clearSelectedUser());
  };

  const handleAdjustBalance = (userId: string) => {
    setSelectedUserId(userId);
    setBalanceDialogOpen(true);
  };

  const handleToggleBanned = async (userId: string, currentStatus: boolean) => {
    await dispatch(updateUser({ userId, data: { isBanned: !currentStatus } }));
    loadUsers();
  };

  const handleMuteUser = (userId: string) => {
    setSelectedUserId(userId);
    setMuteDialogOpen(true);
  };

  const handleUnmuteUser = async (userId: string) => {
    try {
      await dispatch(unmuteUser(userId)).unwrap();
      setTimeout(() => {
        loadUsers();
      }, 100);
    } catch (error) {
      console.error('Failed to unmute user:', error);
    }
  };

  return {
    detailsOpen,
    setDetailsOpen,
    balanceDialogOpen,
    setBalanceDialogOpen,
    muteDialogOpen,
    setMuteDialogOpen,
    selectedUserId,
    handleViewDetails,
    handleCloseDetails,
    handleAdjustBalance,
    handleToggleBanned,
    handleMuteUser,
    handleUnmuteUser,
  };
};
