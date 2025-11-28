import { Add, Block, Delete, Edit } from '@mui/icons-material';
import {
  Box,
  Button,
  Chip,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import React from 'react';
import { AdminUser } from '../../types/settings.types';

interface AdminUsersTabProps {
  adminUsers: AdminUser[];
  isSuperAdmin: boolean;
  onAddAdmin: () => void;
  onEditAdmin: (admin: AdminUser) => void;
  onDeleteAdmin: (adminId: string) => void;
  onRemoveRole: (admin: AdminUser) => void;
}

const AdminUsersTab: React.FC<AdminUsersTabProps> = ({
  adminUsers,
  isSuperAdmin,
  onAddAdmin,
  onEditAdmin,
  onDeleteAdmin,
  onRemoveRole,
}) => {
  return (
    <>
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between' }}>
        <Typography variant="h6">Admin Users</Typography>
        {isSuperAdmin && (
          <Button variant="contained" startIcon={<Add />} onClick={onAddAdmin}>
            Add Admin
          </Button>
        )}
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Username</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Last Login</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {adminUsers.map((admin) => (
              <TableRow key={admin.id}>
                <TableCell>{admin.username}</TableCell>
                <TableCell>{admin.email}</TableCell>
                <TableCell>
                  <Chip
                    label={admin.role}
                    color={
                      admin.role === 'super_admin'
                        ? 'error'
                        : admin.role === 'admin'
                          ? 'warning'
                          : 'default'
                    }
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <Chip
                    label={admin.isActive ? 'Active' : 'Inactive'}
                    color={admin.isActive ? 'success' : 'default'}
                    size="small"
                  />
                </TableCell>
                <TableCell>{new Date(admin.lastLogin).toLocaleString()}</TableCell>
                <TableCell>
                  <IconButton onClick={() => onEditAdmin(admin)} size="small">
                    <Edit />
                  </IconButton>
                  {isSuperAdmin && admin.userId && (
                    <IconButton
                      onClick={() => onRemoveRole(admin)}
                      size="small"
                      color="warning"
                      title="Remove admin role"
                    >
                      <Block />
                    </IconButton>
                  )}
                  <IconButton onClick={() => onDeleteAdmin(admin.id)} size="small" color="error">
                    <Delete />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </>
  );
};

export default AdminUsersTab;
