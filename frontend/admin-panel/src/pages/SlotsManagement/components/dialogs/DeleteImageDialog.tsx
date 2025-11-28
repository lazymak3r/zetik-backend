import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material';
import React from 'react';

interface DeleteImageDialogProps {
  open: boolean;
  onClose: () => void;
  onDelete: () => void;
  imageName: string | undefined;
  loading: boolean;
}

const DeleteImageDialog: React.FC<DeleteImageDialogProps> = ({
  open,
  onClose,
  onDelete,
  imageName,
  loading,
}) => {
  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Delete Image</DialogTitle>
      <DialogContent>
        <Typography>
          Are you sure you want to delete <strong>{imageName}</strong>?
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" color="error" disabled={loading} onClick={onDelete}>
          Delete
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DeleteImageDialog;
