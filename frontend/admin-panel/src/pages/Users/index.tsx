import { Box, Typography } from '@mui/material';
import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import UserDetailsDialog from '../../components/dialogs/UserDetailsDialog';
import { AppDispatch, RootState } from '../../store';
import { fetchUserDetails } from '../../store/users/model/users.thunks';
import BalanceAdjustmentDialog from './components/dialogs/BalanceAdjustmentDialog';
import MuteUserDialog from './components/dialogs/MuteUserDialog';
import UsersFilters from './components/UsersFilters';
import UsersTable from './components/UsersTable';
import { useMuteStatus } from './hooks/useMuteStatus';
import { useUserActions } from './hooks/useUserActions';
import { useUsersData } from './hooks/useUsersData';

const Users: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { users, total, loading, selectedUser } = useSelector((state: RootState) => state.users);

  const {
    page,
    setPage,
    pageSize,
    setPageSize,
    searchTerm,
    setSearchTerm,
    bannedFilter,
    setBannedFilter,
    loadUsers,
  } = useUsersData();

  const {
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
  } = useUserActions(loadUsers);

  const { isUserMuted } = useMuteStatus();

  useEffect(() => {
    if (selectedUser && selectedUserId && selectedUser.id === selectedUserId && !detailsOpen) {
      setDetailsOpen(true);
    }
  }, [selectedUser, selectedUserId, detailsOpen, setDetailsOpen]);

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Users Management
      </Typography>

      <UsersFilters
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        bannedFilter={bannedFilter}
        onFilterChange={setBannedFilter}
      />

      <UsersTable
        users={users}
        total={total}
        loading={loading}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        onViewDetails={(userId) => {
          void handleViewDetails(userId);
        }}
        onToggleBanned={(userId, currentStatus) => {
          void handleToggleBanned(userId, currentStatus);
        }}
        onAdjustBalance={handleAdjustBalance}
        onMuteUser={handleMuteUser}
        onUnmuteUser={(userId) => {
          void handleUnmuteUser(userId);
        }}
        isUserMuted={isUserMuted}
      />

      <UserDetailsDialog
        open={detailsOpen}
        onClose={handleCloseDetails}
        user={selectedUser}
        onRefresh={() => {
          if (selectedUserId) {
            void dispatch(fetchUserDetails(selectedUserId));
          }
        }}
      />

      <BalanceAdjustmentDialog
        open={balanceDialogOpen}
        onClose={() => setBalanceDialogOpen(false)}
        userId={selectedUserId}
        onSuccess={() => {
          setBalanceDialogOpen(false);
          loadUsers();
        }}
      />

      <MuteUserDialog
        open={muteDialogOpen}
        onClose={() => setMuteDialogOpen(false)}
        userId={selectedUserId}
        onSuccess={() => {
          setMuteDialogOpen(false);
          loadUsers();
        }}
      />
    </Box>
  );
};

export default Users;
