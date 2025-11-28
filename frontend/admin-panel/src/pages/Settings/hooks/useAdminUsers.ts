import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { api } from '../../../config/api';
import { useDebounce } from '../../../hooks/useDebounce';
import { AppDispatch, RootState } from '../../../store';
import { assignAdminRole, removeAdminRole } from '../../../store/users/model/users.thunks';
import { AdminUser, EmailCheckResult, User } from '../types/settings.types';
import { useUserSearch } from './useUserSearch';

export const useAdminUsers = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { admin } = useSelector((state: RootState) => state.auth);
  const isSuperAdmin = admin?.role === 'super_admin';

  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [adminDialogOpen, setAdminDialogOpen] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState<AdminUser | null>(null);
  const [adminForm, setAdminForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'admin',
  });
  const [assignToExistingUser, setAssignToExistingUser] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [emailCheckResult, setEmailCheckResult] = useState<EmailCheckResult | null>(null);
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);

  const userSearch = useUserSearch();
  const debouncedEmail = useDebounce(adminForm.email, 500);

  const checkEmail = async (email: string) => {
    if (!email || !email.includes('@')) {
      setEmailCheckResult(null);
      return;
    }

    setIsCheckingEmail(true);
    try {
      const response = await api.get(`/settings/admins/check-email/${encodeURIComponent(email)}`);
      setEmailCheckResult(response.data);
    } catch (error) {
      console.error('Failed to check email:', error);
      setEmailCheckResult(null);
    } finally {
      setIsCheckingEmail(false);
    }
  };

  useEffect(() => {
    if (adminDialogOpen && debouncedEmail && (!assignToExistingUser || !selectedAdmin)) {
      void checkEmail(debouncedEmail);
    } else {
      setEmailCheckResult(null);
    }
  }, [debouncedEmail, selectedAdmin, adminDialogOpen, assignToExistingUser]);

  const fetchAdminUsers = async () => {
    try {
      const response = await api.get('/settings/admins');
      setAdminUsers(response.data);
    } catch (error) {
      console.error('Failed to fetch admin users:', error);
    }
  };

  const handleEditAdmin = (admin: AdminUser) => {
    setSelectedAdmin(admin);
    setAssignToExistingUser(false);
    setSelectedUser(null);
    userSearch.resetUserSearch();
    setAdminForm({
      name: admin.username,
      email: admin.email,
      password: '',
      role: admin.role,
    });
    setAdminDialogOpen(true);
  };

  const handleDeleteAdmin = async (adminId: string) => {
    if (window.confirm('Are you sure you want to delete this admin user?')) {
      try {
        await api.delete(`/settings/admins/${adminId}`);
        void fetchAdminUsers();
      } catch (error) {
        console.error('Failed to delete admin:', error);
      }
    }
  };

  const handleRemoveRole = async (admin: AdminUser) => {
    if (!admin.userId) {
      console.error('Cannot remove role: admin has no userId');
      return;
    }

    if (
      window.confirm(
        `Are you sure you want to remove the admin role from ${admin.username}? They will lose admin access.`,
      )
    ) {
      try {
        await dispatch(removeAdminRole(admin.userId)).unwrap();
        void fetchAdminUsers();
      } catch (error) {
        console.error('Failed to remove admin role:', error);
      }
    }
  };

  const handleSaveAdmin = async () => {
    try {
      if (assignToExistingUser && selectedUser) {
        await dispatch(
          assignAdminRole({
            userId: selectedUser.id,
            role: adminForm.role,
            email: selectedUser.email,
            name: selectedUser.username || selectedUser.email,
          }),
        ).unwrap();
      } else {
        const adminToUpdate =
          selectedAdmin || adminUsers.find((admin) => admin.email === adminForm.email);

        if (adminToUpdate) {
          const updateData: any = {};
          if (adminForm.name !== adminToUpdate.username) {
            updateData.name = adminForm.name;
          }
          if (adminForm.email !== adminToUpdate.email) {
            updateData.email = adminForm.email;
          }
          if (adminForm.password) {
            updateData.password = adminForm.password;
          }
          if (adminForm.role !== adminToUpdate.role && isSuperAdmin) {
            updateData.role = adminForm.role;
          }

          if (Object.keys(updateData).length > 0) {
            if (adminToUpdate.userId && updateData.role && updateData.role !== adminToUpdate.role) {
              await dispatch(
                assignAdminRole({
                  userId: adminToUpdate.userId,
                  role: updateData.role,
                  email: adminToUpdate.email,
                  name: adminToUpdate.username,
                }),
              ).unwrap();
              const fieldsToPatch = { ...updateData };

              delete fieldsToPatch.role;

              if (Object.keys(fieldsToPatch).length > 0) {
                await api.patch(`/settings/admins/${adminToUpdate.id}`, fieldsToPatch);
              }
            } else {
              await api.patch(`/settings/admins/${adminToUpdate.id}`, updateData);
            }
          }
        } else {
          await api.post('/settings/admins', adminForm);
        }
      }
      setAdminDialogOpen(false);
      void fetchAdminUsers();
      resetAdminForm();
    } catch (error) {
      console.error('Failed to save admin:', error);
    }
  };

  const handleOpenAdminDialog = () => {
    setSelectedAdmin(null);
    setAssignToExistingUser(false);
    setSelectedUser(null);
    setEmailCheckResult(null);
    userSearch.resetUserSearch();
    setAdminForm({ name: '', email: '', password: '', role: 'admin' });
    setAdminDialogOpen(true);
  };

  const resetAdminForm = () => {
    setSelectedAdmin(null);
    setAssignToExistingUser(false);
    setSelectedUser(null);
    setEmailCheckResult(null);
    userSearch.resetUserSearch();
    setAdminForm({ name: '', email: '', password: '', role: 'admin' });
  };

  const handleUserSelect = async (user: User | null) => {
    setSelectedUser(user);
    if (user) {
      const role = await userSearch.handleUserSelect(user);
      if (role) {
        setAdminForm((prev) => ({ ...prev, role: role || 'moderator' }));
      }
    }
  };

  return {
    adminUsers,
    adminDialogOpen,
    setAdminDialogOpen,
    selectedAdmin,
    setSelectedAdmin,
    adminForm,
    setAdminForm,
    assignToExistingUser,
    setAssignToExistingUser,
    selectedUser,
    setSelectedUser,
    isSuperAdmin,
    userSearch,
    emailCheckResult,
    isCheckingEmail,
    fetchAdminUsers,
    handleEditAdmin,
    handleDeleteAdmin,
    handleRemoveRole,
    handleSaveAdmin,
    handleOpenAdminDialog,
    handleUserSelect,
    resetAdminForm,
  };
};
