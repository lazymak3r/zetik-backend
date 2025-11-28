import {
  CloudUpload,
  Delete,
  Edit,
  Image,
  Save,
  Visibility,
  VisibilityOff,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  CardMedia,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  Paper,
  Snackbar,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../config/api';

interface DefaultAvatar {
  id: string;
  avatarUrl: string;
  originalFilename: string;
  fileSize: number;
  mimeType: string;
  displayOrder: number;
  isActive: boolean;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

interface EditDialogState {
  open: boolean;
  avatar: DefaultAvatar | null;
  displayOrder: number;
  isActive: boolean;
  description: string;
}

export default function DefaultAvatars() {
  const [avatars, setAvatars] = useState<DefaultAvatar[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error',
  });
  const [editDialog, setEditDialog] = useState<EditDialogState>({
    open: false,
    avatar: null,
    displayOrder: 0,
    isActive: true,
    description: '',
  });
  const [deleteConfirm, setDeleteConfirm] = useState<{
    open: boolean;
    avatar: DefaultAvatar | null;
  }>({
    open: false,
    avatar: null,
  });

  const fetchAvatars = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get('/avatars/default');
      setAvatars(response.data);
    } catch (error: any) {
      setSnackbar({
        open: true,
        message: error.response?.data?.message || 'Failed to load avatars',
        severity: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAvatars();
  }, [fetchAvatars]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
    if (!allowedTypes.includes(file.type)) {
      setSnackbar({
        open: true,
        message: 'Invalid file type. Only JPEG, PNG, WebP, and AVIF are allowed.',
        severity: 'error',
      });
      return;
    }

    // Validate file size (5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      setSnackbar({
        open: true,
        message: 'File too large. Maximum size is 5MB.',
        severity: 'error',
      });
      return;
    }

    void (async () => {
      try {
        setUploading(true);
        const formData = new FormData();
        formData.append('avatar', file);
        formData.append('displayOrder', String(avatars.length));
        formData.append('description', `Uploaded ${new Date().toLocaleDateString()}`);

        await api.post('/avatars/default', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });

        setSnackbar({
          open: true,
          message: 'Avatar uploaded successfully',
          severity: 'success',
        });
        void fetchAvatars();
      } catch (error: any) {
        setSnackbar({
          open: true,
          message: error.response?.data?.message || 'Failed to upload avatar',
          severity: 'error',
        });
      } finally {
        setUploading(false);
        // Reset file input
        event.target.value = '';
      }
    })();
  };

  const handleEditOpen = (avatar: DefaultAvatar) => {
    setEditDialog({
      open: true,
      avatar,
      displayOrder: avatar.displayOrder,
      isActive: avatar.isActive,
      description: avatar.description || '',
    });
  };

  const handleEditClose = () => {
    setEditDialog({
      open: false,
      avatar: null,
      displayOrder: 0,
      isActive: true,
      description: '',
    });
  };

  const handleEditSave = () => {
    if (!editDialog.avatar) return;

    const avatarId = editDialog.avatar.id;
    const displayOrder = editDialog.displayOrder;
    const isActive = editDialog.isActive;
    const description = editDialog.description;

    void (async () => {
      try {
        await api.patch(`/avatars/default/${avatarId}`, {
          displayOrder,
          isActive,
          description,
        });

        setSnackbar({
          open: true,
          message: 'Avatar updated successfully',
          severity: 'success',
        });
        handleEditClose();
        void fetchAvatars();
      } catch (error: any) {
        setSnackbar({
          open: true,
          message: error.response?.data?.message || 'Failed to update avatar',
          severity: 'error',
        });
      }
    })();
  };

  const handleDeleteConfirm = (avatar: DefaultAvatar) => {
    setDeleteConfirm({ open: true, avatar });
  };

  const handleDeleteCancel = () => {
    setDeleteConfirm({ open: false, avatar: null });
  };

  const handleDelete = () => {
    if (!deleteConfirm.avatar) return;

    const avatarId = deleteConfirm.avatar.id;

    void (async () => {
      try {
        await api.delete(`/avatars/default/${avatarId}`);

        setSnackbar({
          open: true,
          message: 'Avatar deleted successfully',
          severity: 'success',
        });
        handleDeleteCancel();
        void fetchAvatars();
      } catch (error: any) {
        setSnackbar({
          open: true,
          message: error.response?.data?.message || 'Failed to delete avatar',
          severity: 'error',
        });
      }
    })();
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4" component="h1">
          Default Avatars
        </Typography>
        <Button
          variant="contained"
          component="label"
          startIcon={<CloudUpload />}
          disabled={uploading}
        >
          {uploading ? 'Uploading...' : 'Upload Avatar'}
          <input
            type="file"
            hidden
            accept="image/jpeg,image/png,image/webp,image/avif"
            onChange={handleFileSelect}
          />
        </Button>
      </Box>

      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          <strong>Total Avatars:</strong> {avatars.length} | <strong>Active:</strong>{' '}
          {avatars.filter((a) => a.isActive).length}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Allowed formats: JPEG, PNG, WebP, AVIF | Max size: 5MB
        </Typography>
      </Paper>

      {loading ? (
        <Typography>Loading...</Typography>
      ) : (
        <Grid container spacing={3}>
          {avatars.map((avatar) => (
            <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={avatar.id}>
              <Card>
                <Box sx={{ position: 'relative' }}>
                  <CardMedia
                    component="img"
                    height="200"
                    image={avatar.avatarUrl}
                    alt={avatar.originalFilename}
                    sx={{ objectFit: 'cover' }}
                  />
                  {!avatar.isActive && (
                    <Chip
                      label="Inactive"
                      color="error"
                      size="small"
                      sx={{ position: 'absolute', top: 8, right: 8 }}
                    />
                  )}
                  <Chip
                    label={`#${avatar.displayOrder}`}
                    color="primary"
                    size="small"
                    sx={{ position: 'absolute', top: 8, left: 8 }}
                  />
                </Box>
                <CardContent>
                  <Typography variant="body2" noWrap title={avatar.originalFilename}>
                    <strong>{avatar.originalFilename}</strong>
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block">
                    {formatFileSize(avatar.fileSize)} •{' '}
                    {avatar.mimeType.split('/')[1].toUpperCase()}
                  </Typography>
                  {avatar.description && (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      display="block"
                      sx={{ mt: 1 }}
                    >
                      {avatar.description}
                    </Typography>
                  )}
                  <Box sx={{ mt: 1, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                    {avatar.isActive ? (
                      <Chip icon={<Visibility />} label="Active" color="success" size="small" />
                    ) : (
                      <Chip
                        icon={<VisibilityOff />}
                        label="Inactive"
                        color="default"
                        size="small"
                      />
                    )}
                  </Box>
                </CardContent>
                <CardActions>
                  <Tooltip title="Edit">
                    <IconButton size="small" onClick={() => handleEditOpen(avatar)} color="primary">
                      <Edit />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete">
                    <IconButton
                      size="small"
                      onClick={() => handleDeleteConfirm(avatar)}
                      color="error"
                    >
                      <Delete />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Preview">
                    <IconButton
                      size="small"
                      component="a"
                      href={avatar.avatarUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Image />
                    </IconButton>
                  </Tooltip>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Edit Dialog */}
      <Dialog open={editDialog.open} onClose={handleEditClose} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Avatar</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            <TextField
              label="Display Order"
              type="number"
              value={editDialog.displayOrder}
              onChange={(e) =>
                setEditDialog({ ...editDialog, displayOrder: parseInt(e.target.value) || 0 })
              }
              fullWidth
              helperText="Lower numbers appear first"
            />
            <TextField
              label="Description"
              value={editDialog.description}
              onChange={(e) => setEditDialog({ ...editDialog, description: e.target.value })}
              fullWidth
              multiline
              rows={3}
            />
            <Box>
              <Button
                variant={editDialog.isActive ? 'contained' : 'outlined'}
                onClick={() => setEditDialog({ ...editDialog, isActive: !editDialog.isActive })}
                startIcon={editDialog.isActive ? <Visibility /> : <VisibilityOff />}
                color={editDialog.isActive ? 'success' : 'inherit'}
              >
                {editDialog.isActive ? 'Active' : 'Inactive'}
              </Button>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleEditClose}>Cancel</Button>
          <Button onClick={handleEditSave} variant="contained" startIcon={<Save />}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirm.open} onClose={handleDeleteCancel}>
        <DialogTitle>Delete Avatar</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete{' '}
            <strong>{deleteConfirm.avatar?.originalFilename}</strong>? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel}>Cancel</Button>
          <Button onClick={handleDelete} variant="contained" color="error" startIcon={<Delete />}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
