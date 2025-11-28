import { Add, Close, CloudUpload } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography,
} from '@mui/material';
import axios from 'axios';
import React, { useEffect, useState } from 'react';

interface CoverSelectorProps {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  error?: boolean;
  helperText?: string;
}

const CoverSelector: React.FC<CoverSelectorProps> = ({
  value,
  onChange,
  required = false,
  error = false,
  helperText,
}) => {
  const [open, setOpen] = useState(false);
  const [covers, setCovers] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string>('');

  const fetchCovers = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('adminToken');
      const response = await axios.get('/v1/upload/list?directory=blog/covers', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setCovers(response.data);
    } catch (err) {
      console.error('Failed to fetch covers', err);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (open) {
      fetchCovers();
    }
  }, [open]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadError('');

    try {
      const uploadData = new FormData();
      uploadData.append('file', file);
      uploadData.append('directory', 'blog/covers');

      const token = localStorage.getItem('adminToken');
      const response = await axios.post('/v1/upload', uploadData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      });

      const newCover = response.data.path;
      setCovers((prev) => [newCover, ...prev]);
      onChange(newCover);
      setOpen(false);
    } catch (err: any) {
      console.error('Upload failed', err);
      setUploadError(err.response?.data?.message || 'Upload failed. Please try again.');
    }
    setUploading(false);
    // Reset file input
    event.target.value = '';
  };

  const handleSelectCover = (cover: string) => {
    onChange(cover);
    setOpen(false);
  };

  const getImageUrl = (path: string) => {
    const baseUrl = process.env.REACT_APP_PUBLIC_STORAGE_BASE_URL || 'http://localhost:9000/zetik';
    return `${baseUrl}/${path}`;
  };

  return (
    <>
      <Box sx={{ mb: 1.5 }}>
        <Typography
          variant="subtitle2"
          sx={{ mb: 1, fontWeight: 600, color: error ? 'error.main' : 'text.primary' }}
        >
          Cover Image {required && '*'}
        </Typography>

        <Box
          onClick={() => setOpen(true)}
          sx={{
            width: '100%',
            height: 120,
            border: error ? '2px solid' : '1px solid',
            borderColor: error ? 'error.main' : 'grey.300',
            borderRadius: 1,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            overflow: 'hidden',
            backgroundColor: value ? 'transparent' : 'grey.50',
            '&:hover': {
              borderColor: error ? 'error.dark' : 'primary.main',
              backgroundColor: value ? 'rgba(0,0,0,0.05)' : 'grey.100',
            },
          }}
        >
          {value ? (
            <>
              <img
                src={getImageUrl(value)}
                alt="Cover"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
              <Box
                sx={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: 'rgba(0,0,0,0.5)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: 0,
                  transition: 'opacity 0.2s',
                  '&:hover': {
                    opacity: 1,
                  },
                }}
              >
                <Typography variant="body2" sx={{ color: 'white', fontWeight: 600 }}>
                  Click to change
                </Typography>
              </Box>
            </>
          ) : (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 1,
                color: error ? 'error.main' : 'text.secondary',
              }}
            >
              <Add sx={{ fontSize: 32 }} />
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                {required ? 'Select cover image (required)' : 'Select cover image'}
              </Typography>
            </Box>
          )}
        </Box>

        {helperText && (
          <Typography
            variant="caption"
            sx={{ mt: 0.5, color: error ? 'error.main' : 'text.secondary' }}
          >
            {helperText}
          </Typography>
        )}
      </Box>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle
          sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <Typography variant="h6">Select Cover Image</Typography>
          <IconButton onClick={() => setOpen(false)} size="small">
            <Close />
          </IconButton>
        </DialogTitle>

        <DialogContent>
          {uploadError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {uploadError}
            </Alert>
          )}

          <Box sx={{ mb: 2 }}>
            <Button
              variant="outlined"
              component="label"
              startIcon={uploading ? <CircularProgress size={16} /> : <CloudUpload />}
              disabled={uploading}
              fullWidth
            >
              {uploading ? 'Uploading...' : 'Upload New Cover'}
              <input
                type="file"
                hidden
                accept="image/avif,image/webp,image/svg+xml,image/png,image/jpeg"
                onChange={handleFileUpload}
              />
            </Button>
            <Typography
              variant="caption"
              sx={{ mt: 0.5, display: 'block', color: 'text.secondary' }}
            >
              Supported formats: .avif, .webp, .svg, .png, .jpg (max 200KB)
            </Typography>
          </Box>

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: 'repeat(2, 1fr)',
                  sm: 'repeat(3, 1fr)',
                  md: 'repeat(4, 1fr)',
                },
                gap: 2,
              }}
            >
              {covers.length === 0 ? (
                <Box sx={{ gridColumn: '1 / -1', textAlign: 'center', py: 4 }}>
                  <Typography variant="body2" color="text.secondary">
                    No covers found. Upload your first cover image.
                  </Typography>
                </Box>
              ) : (
                covers.map((cover) => (
                  <Box key={cover}>
                    <Box
                      onClick={() => handleSelectCover(cover)}
                      sx={{
                        width: '100%',
                        height: 120,
                        border: value === cover ? '3px solid' : '1px solid',
                        borderColor: value === cover ? 'primary.main' : 'grey.300',
                        borderRadius: 1,
                        cursor: 'pointer',
                        overflow: 'hidden',
                        position: 'relative',
                        '&:hover': {
                          borderColor: 'primary.main',
                        },
                      }}
                    >
                      <img
                        src={getImageUrl(cover)}
                        alt={cover.split('/').pop()}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                        }}
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                      {value === cover && (
                        <Box
                          sx={{
                            position: 'absolute',
                            top: 4,
                            right: 4,
                            backgroundColor: 'primary.main',
                            color: 'white',
                            borderRadius: '50%',
                            width: 24,
                            height: 24,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 14,
                          }}
                        >
                          ✓
                        </Box>
                      )}
                    </Box>
                    <Typography
                      variant="caption"
                      sx={{
                        mt: 0.5,
                        display: 'block',
                        textAlign: 'center',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {cover.split('/').pop()}
                    </Typography>
                  </Box>
                ))
              )}
            </Box>
          )}
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default CoverSelector;
