import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from '@mui/material';
import React from 'react';

interface EditDescriptionDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  onDelete?: () => void;
  description: string;
  onDescriptionChange: (description: string) => void;
  loading: boolean;
  hasDescription: boolean;
}

const EditDescriptionDialog: React.FC<EditDescriptionDialogProps> = ({
  open,
  onClose,
  onSave,
  onDelete,
  description,
  onDescriptionChange,
  loading,
  hasDescription,
}) => {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Edit Game Description</DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 2 }}>
          <TextField
            fullWidth
            multiline
            rows={6}
            label="Description"
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            placeholder="Enter game description..."
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        {hasDescription && onDelete && (
          <Button variant="outlined" color="error" disabled={loading} onClick={onDelete}>
            Delete
          </Button>
        )}
        <Button variant="contained" disabled={loading} onClick={onSave}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EditDescriptionDialog;
