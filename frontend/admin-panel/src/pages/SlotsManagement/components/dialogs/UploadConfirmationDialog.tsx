import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Typography,
} from '@mui/material';
import React from 'react';

interface UploadConfirmationDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  filesCount: number;
}

const UploadConfirmationDialog: React.FC<UploadConfirmationDialogProps> = ({
  open,
  onClose,
  onConfirm,
  filesCount,
}) => {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Confirm Image Upload</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Please review before uploading. These rules help keep slot assets consistent:
        </Typography>
        <List dense>
          <ListItem>
            <ListItemIcon sx={{ minWidth: 32 }}>
              <CheckCircleIcon color="primary" fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Use the provider's required naming convention (letter case matters)." />
          </ListItem>
          <ListItem>
            <ListItemIcon sx={{ minWidth: 32 }}>
              <CheckCircleIcon color="primary" fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Uploading a file with an existing name will overwrite the previous image." />
          </ListItem>
          <ListItem>
            <ListItemIcon sx={{ minWidth: 32 }}>
              <CheckCircleIcon color="primary" fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Keep every image in the same format (slots currently use PNG). Each file must be up to 5 MB." />
          </ListItem>
          <ListItem>
            <ListItemIcon sx={{ minWidth: 32 }}>
              <CheckCircleIcon color="primary" fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="All selected files will be uploaded to the current provider folder." />
          </ListItem>
        </List>
        <Typography variant="caption" color="text.secondary">
          Files selected: {filesCount}
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={onConfirm} variant="contained" color="primary">
          Upload
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default UploadConfirmationDialog;
