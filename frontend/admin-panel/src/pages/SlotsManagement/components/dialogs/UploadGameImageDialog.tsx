import { CloudUpload } from '@mui/icons-material';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material';
import React, { useCallback, useRef } from 'react';
import { ALLOWED_IMAGE_TYPES } from '../../consts';
import { ProviderGame } from '../../types';

interface UploadGameImageDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (game: ProviderGame, file: File) => void;
  game: ProviderGame | null;
  loading: boolean;
}

const UploadGameImageDialog: React.FC<UploadGameImageDialogProps> = ({
  open,
  onClose,
  onConfirm,
  game,
  loading,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return;
    }

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return;
    }

    setSelectedFile(file);
  }, []);

  const handleConfirm = useCallback(() => {
    if (!game || !selectedFile) return;
    onConfirm(game, selectedFile);
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [game, selectedFile, onConfirm]);

  const handleClose = useCallback(() => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onClose();
  }, [onClose]);

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Upload Image for {game?.name}</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Select an image file to upload. The file will be automatically renamed to match the game
          code ({game?.code}).
        </Typography>
        <input
          ref={fileInputRef}
          type="file"
          accept={ALLOWED_IMAGE_TYPES.join(',')}
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
        <Button
          variant="outlined"
          component="label"
          startIcon={<CloudUpload />}
          disabled={loading}
          fullWidth
        >
          Select Image
          <input
            type="file"
            accept={ALLOWED_IMAGE_TYPES.join(',')}
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
        </Button>
        {selectedFile && (
          <Typography variant="body2" sx={{ mt: 2, color: 'text.secondary' }}>
            Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          color="primary"
          disabled={!selectedFile || loading}
        >
          Upload
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default UploadGameImageDialog;
