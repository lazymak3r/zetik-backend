import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from '@mui/material';
import React from 'react';

interface ApiKeyGeneratedDialogProps {
  open: boolean;
  apiKey: string | null;
  onClose: () => void;
}

const ApiKeyGeneratedDialog: React.FC<ApiKeyGeneratedDialogProps> = ({ open, apiKey, onClose }) => {
  const handleCopy = () => {
    if (apiKey) {
      void navigator.clipboard.writeText(apiKey).catch((err) => {
        console.error('Failed to copy to clipboard:', err);
      });
    }
  };

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>API Key Generated</DialogTitle>
      <DialogContent>
        <Typography gutterBottom>
          Please copy and save this API key securely. It will not be shown again.
        </Typography>
        <TextField
          fullWidth
          value={apiKey || ''}
          InputProps={{ readOnly: true }}
          sx={{ mb: 2, mt: 2 }}
        />
        <Button variant="outlined" onClick={handleCopy}>
          Copy to Clipboard
        </Button>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default ApiKeyGeneratedDialog;
