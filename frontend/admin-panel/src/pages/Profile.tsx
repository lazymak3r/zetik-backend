import { Save } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { api } from '../config/api';

interface ProfileData {
  id: string;
  email: string;
  name: string;
  role: string;
  permissions: Record<string, boolean>;
  lastLoginAt?: string;
  lastLoginIp?: string;
  createdAt: string;
  updatedAt: string;
}

export default function Profile() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await api.get('/auth/profile');
      setProfile(response.data);
      setFormData({
        name: response.data.name,
        email: response.data.email,
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch (err) {
      setError('Failed to load profile data');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      // Validate passwords if they are being changed
      if (formData.newPassword) {
        if (!formData.currentPassword) {
          setError('Current password is required to set a new password');
          return;
        }
        if (formData.newPassword !== formData.confirmPassword) {
          setError('New passwords do not match');
          return;
        }
      }

      const updateData = {
        name: formData.name,
        email: formData.email,
        ...(formData.newPassword && {
          currentPassword: formData.currentPassword,
          newPassword: formData.newPassword,
        }),
      };

      await api.put('/auth/profile', updateData);
      setSuccess('Profile updated successfully');
      setEditMode(false);
      fetchProfile();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update profile');
      setTimeout(() => setError(null), 3000);
    }
  };

  if (loading) {
    return <Typography>Loading...</Typography>;
  }

  if (!profile) {
    return <Typography>Profile not found</Typography>;
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Profile
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}

      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3 }}>
        <Box sx={{ flex: 1 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Account Information
              </Typography>
              <Box sx={{ mt: 2 }}>
                {editMode ? (
                  <>
                    <TextField
                      fullWidth
                      label="Name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      sx={{ mb: 2 }}
                    />
                    <TextField
                      fullWidth
                      label="Email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      sx={{ mb: 2 }}
                    />
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="subtitle1" gutterBottom>
                      Change Password
                    </Typography>
                    <TextField
                      fullWidth
                      label="Current Password"
                      type="password"
                      value={formData.currentPassword}
                      onChange={(e) =>
                        setFormData({ ...formData, currentPassword: e.target.value })
                      }
                      sx={{ mb: 2 }}
                    />
                    <TextField
                      fullWidth
                      label="New Password"
                      type="password"
                      value={formData.newPassword}
                      onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                      sx={{ mb: 2 }}
                    />
                    <TextField
                      fullWidth
                      label="Confirm New Password"
                      type="password"
                      value={formData.confirmPassword}
                      onChange={(e) =>
                        setFormData({ ...formData, confirmPassword: e.target.value })
                      }
                      sx={{ mb: 2 }}
                    />
                    <Box sx={{ display: 'flex', gap: 2 }}>
                      <Button variant="contained" startIcon={<Save />} onClick={handleSave}>
                        Save Changes
                      </Button>
                      <Button onClick={() => setEditMode(false)}>Cancel</Button>
                    </Box>
                  </>
                ) : (
                  <>
                    <Typography variant="body2" color="textSecondary">
                      Name
                    </Typography>
                    <Typography variant="body1" gutterBottom>
                      {profile.name}
                    </Typography>

                    <Typography variant="body2" color="textSecondary">
                      Email
                    </Typography>
                    <Typography variant="body1" gutterBottom>
                      {profile.email}
                    </Typography>

                    <Typography variant="body2" color="textSecondary">
                      Role
                    </Typography>
                    <Typography variant="body1" gutterBottom>
                      <Chip
                        label={profile.role}
                        color={
                          profile.role === 'super_admin'
                            ? 'error'
                            : profile.role === 'admin'
                              ? 'warning'
                              : 'default'
                        }
                        size="small"
                      />
                    </Typography>

                    <Button variant="outlined" onClick={() => setEditMode(true)} sx={{ mt: 2 }}>
                      Edit Profile
                    </Button>
                  </>
                )}
              </Box>
            </CardContent>
          </Card>
        </Box>

        <Box sx={{ flex: 1 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Account Activity
              </Typography>
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" color="textSecondary">
                  Last Login
                </Typography>
                <Typography variant="body1" gutterBottom>
                  {profile.lastLoginAt ? new Date(profile.lastLoginAt).toLocaleString() : 'Never'}
                </Typography>

                {profile.lastLoginIp && (
                  <>
                    <Typography variant="body2" color="textSecondary">
                      Last Login IP
                    </Typography>
                    <Typography variant="body1" gutterBottom>
                      {profile.lastLoginIp}
                    </Typography>
                  </>
                )}

                <Divider sx={{ my: 2 }} />

                <Typography variant="body2" color="textSecondary">
                  Account Created
                </Typography>
                <Typography variant="body1" gutterBottom>
                  {profile.createdAt ? new Date(profile.createdAt).toLocaleString() : 'N/A'}
                </Typography>

                <Typography variant="body2" color="textSecondary">
                  Last Updated
                </Typography>
                <Typography variant="body1">
                  {profile.updatedAt ? new Date(profile.updatedAt).toLocaleString() : 'N/A'}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Box>
      </Box>
    </Box>
  );
}
