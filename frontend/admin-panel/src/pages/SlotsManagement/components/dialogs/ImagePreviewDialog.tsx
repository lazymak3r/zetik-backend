import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material';
import React from 'react';
import { ImageItem } from '../../types';

interface ImagePreviewDialogProps {
  open: boolean;
  onClose: () => void;
  image: ImageItem | null;
}

const ImagePreviewDialog: React.FC<ImagePreviewDialogProps> = ({ open, onClose, image }) => {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Image Preview</DialogTitle>
      <DialogContent>
        {image && (
          <Box sx={{ width: '100%', textAlign: 'center' }}>
            <img
              src={image.src}
              alt={image.name}
              style={{ maxWidth: '100%', height: 'auto', borderRadius: 4 }}
            />
            <Typography variant="body2" sx={{ mt: 1 }}>
              {image.name}
            </Typography>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default ImagePreviewDialog;
