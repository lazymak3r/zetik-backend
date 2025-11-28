import {
  Alert,
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import React from 'react';
import { AdminUser, User } from '../../types/settings.types';

interface EmailCheckResult {
  exists: boolean;
  userId?: string;
  username?: string;
}

interface AdminUserDialogProps {
  open: boolean;
  selectedAdmin: AdminUser | null;
  isSuperAdmin: boolean;
  assignToExistingUser: boolean;
  onAssignToExistingUserChange: (value: boolean) => void;
  selectedUser: User | null;
  userSearchQuery: string;
  userSearchResults: User[];
  userCurrentRole: { role: string | null; userId: string } | null;
  adminForm: {
    name: string;
    email: string;
    password: string;
    role: string;
  };
  emailCheckResult: EmailCheckResult | null;
  isCheckingEmail: boolean;
  onUserSearchInputChange: (value: string) => void;
  onUserSelect: (user: User | null) => void;
  onAdminFormChange: (field: 'name' | 'email' | 'password' | 'role', value: string) => void;
  onClose: () => void;
  onSave: () => void;
}

const AdminUserDialog: React.FC<AdminUserDialogProps> = ({
  open,
  selectedAdmin,
  isSuperAdmin,
  assignToExistingUser,
  onAssignToExistingUserChange,
  selectedUser,
  userSearchQuery,
  userSearchResults,
  userCurrentRole,
  adminForm,
  emailCheckResult,
  isCheckingEmail,
  onUserSearchInputChange,
  onUserSelect,
  onAdminFormChange,
  onClose,
  onSave,
}) => {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{selectedAdmin ? 'Edit Admin User' : 'Add Admin User'}</DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 2 }}>
          {!selectedAdmin && isSuperAdmin && (
            <FormControlLabel
              control={
                <Switch
                  checked={assignToExistingUser}
                  onChange={(e) => onAssignToExistingUserChange(e.target.checked)}
                />
              }
              label="Assign role to existing user"
              sx={{ mb: 2 }}
            />
          )}

          {assignToExistingUser && !selectedAdmin ? (
            <>
              <Autocomplete
                options={userSearchResults}
                getOptionLabel={(option) =>
                  `${option.email}${option.username ? ` (${option.username})` : ''}`
                }
                value={selectedUser}
                onChange={(_, newValue) => onUserSelect(newValue)}
                onInputChange={(_, newInputValue) => onUserSearchInputChange(newInputValue)}
                inputValue={userSearchQuery}
                loading={false}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Search user by email or username"
                    placeholder="Type to search..."
                    sx={{ mb: 2 }}
                  />
                )}
                sx={{ mb: 2 }}
              />

              {selectedUser && (
                <Box sx={{ mb: 2, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
                  <Typography variant="body2" color="textSecondary" gutterBottom>
                    Selected User:
                  </Typography>
                  <Typography variant="body1" gutterBottom>
                    Email: {selectedUser.email}
                  </Typography>
                  {selectedUser.username && (
                    <Typography variant="body1" gutterBottom>
                      Username: {selectedUser.username}
                    </Typography>
                  )}
                  {userCurrentRole && (
                    <Typography
                      variant="body2"
                      color={userCurrentRole.role ? 'warning.main' : 'text.secondary'}
                    >
                      Current role:{' '}
                      {userCurrentRole.role
                        ? userCurrentRole.role.toUpperCase()
                        : 'No role assigned'}
                    </Typography>
                  )}
                </Box>
              )}

              <FormControl fullWidth>
                <InputLabel>Role</InputLabel>
                <Select
                  value={adminForm.role}
                  label="Role"
                  onChange={(e) => onAdminFormChange('role', e.target.value)}
                >
                  <MenuItem value="moderator">Moderator</MenuItem>
                  <MenuItem value="admin">Admin</MenuItem>
                </Select>
              </FormControl>
            </>
          ) : (
            <>
              <TextField
                fullWidth
                label="Name"
                value={adminForm.name}
                onChange={(e) => onAdminFormChange('name', e.target.value)}
                sx={{ mb: 2 }}
                disabled={assignToExistingUser}
              />
              <TextField
                fullWidth
                label="Email"
                type="email"
                value={adminForm.email}
                onChange={(e) => onAdminFormChange('email', e.target.value)}
                sx={{ mb: 2 }}
                disabled={assignToExistingUser}
                InputProps={{
                  endAdornment: isCheckingEmail ? <CircularProgress size={20} /> : null,
                }}
              />
              {emailCheckResult?.exists && !selectedAdmin && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  <Typography variant="body2" gutterBottom>
                    A user with this email already exists (
                    {emailCheckResult.username || 'no username'}).
                  </Typography>
                  <Typography variant="body2">
                    When creating the admin, it will be automatically linked to the existing user.
                  </Typography>
                </Alert>
              )}
              <TextField
                fullWidth
                label="Password"
                type="password"
                value={adminForm.password}
                onChange={(e) => onAdminFormChange('password', e.target.value)}
                sx={{ mb: 2 }}
                helperText={selectedAdmin ? 'Leave empty to keep current password' : ''}
                disabled={assignToExistingUser}
              />
              {isSuperAdmin && (
                <FormControl fullWidth>
                  <InputLabel>Role</InputLabel>
                  <Select
                    value={adminForm.role}
                    label="Role"
                    onChange={(e) => onAdminFormChange('role', e.target.value)}
                  >
                    <MenuItem value="moderator">Moderator</MenuItem>
                    <MenuItem value="admin">Admin</MenuItem>
                  </Select>
                </FormControl>
              )}
            </>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={onSave}
          variant="contained"
          disabled={assignToExistingUser && !selectedUser}
        >
          {assignToExistingUser ? 'Assign Role' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AdminUserDialog;
