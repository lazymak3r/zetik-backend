import { Cancel, CheckCircle } from '@mui/icons-material';
import { Box, Card, Chip } from '@mui/material';
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import React from 'react';
import { formatCurrency } from '../utils/formatCurrency';
import UserActionsCell from './UserActionsCell';

interface UsersTableProps {
  users: any[];
  total: number;
  loading: boolean;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onViewDetails: (userId: string) => void;
  onToggleBanned: (userId: string, currentStatus: boolean) => void;
  onAdjustBalance: (userId: string) => void;
  onMuteUser: (userId: string) => void;
  onUnmuteUser: (userId: string) => void;
  isUserMuted: (user: any) => boolean;
}

const UsersTable: React.FC<UsersTableProps> = ({
  users,
  total,
  loading,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  onViewDetails,
  onToggleBanned,
  onAdjustBalance,
  onMuteUser,
  onUnmuteUser,
  isUserMuted,
}) => {
  const columns: GridColDef[] = [
    {
      field: 'email',
      headerName: 'Email (wallet address / steam id)',
      flex: 1,
      minWidth: 200,
    },
    {
      field: 'username',
      headerName: 'Username',
      width: 150,
      renderCell: (params) => params.value || '-',
    },
    {
      field: 'isBanned',
      headerName: 'Status',
      width: 100,
      renderCell: (params: GridRenderCellParams) => (
        <Chip
          size="small"
          label={params.value ? 'Banned' : 'Active'}
          color={params.value ? 'error' : 'success'}
          icon={params.value ? <Cancel /> : <CheckCircle />}
        />
      ),
    },
    {
      field: 'isEmailVerified',
      headerName: 'Verified',
      width: 100,
      renderCell: (params: GridRenderCellParams) => (
        <Chip
          size="small"
          label={params.value ? 'Yes' : 'No'}
          color={params.value ? 'primary' : 'default'}
        />
      ),
    },
    {
      field: 'currentBalance',
      headerName: 'Balance',
      width: 160,
      renderCell: (params) => formatCurrency(params.value),
    },
    {
      field: 'totalDeposits',
      headerName: 'Total Deposits',
      width: 180,
      renderCell: (params) => formatCurrency(params.value),
    },
    {
      field: 'createdAt',
      headerName: 'Joined',
      width: 120,
      valueFormatter: (value) => new Date(value).toLocaleDateString(),
    },
    {
      field: 'lastLoginAt',
      headerName: 'Last Login',
      width: 120,
      valueFormatter: (value) => (value ? new Date(value).toLocaleDateString() : 'Never'),
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 200,
      sortable: false,
      renderCell: (params: GridRenderCellParams) => (
        <UserActionsCell
          params={params}
          onViewDetails={onViewDetails}
          onToggleBanned={onToggleBanned}
          onAdjustBalance={onAdjustBalance}
          onMuteUser={onMuteUser}
          onUnmuteUser={onUnmuteUser}
          isUserMuted={isUserMuted}
        />
      ),
    },
  ];

  return (
    <Card>
      <Box sx={{ height: 600, width: '100%' }}>
        <DataGrid
          rows={users}
          columns={columns}
          rowCount={total}
          loading={loading}
          pageSizeOptions={[10, 20, 50, 100]}
          paginationModel={{ page, pageSize }}
          paginationMode="server"
          onPaginationModelChange={(model) => {
            onPageChange(model.page);
            onPageSizeChange(model.pageSize);
          }}
          disableRowSelectionOnClick
        />
      </Box>
    </Card>
  );
};

export default UsersTable;
