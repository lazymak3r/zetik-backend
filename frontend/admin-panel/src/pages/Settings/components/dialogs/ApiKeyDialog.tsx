import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
} from '@mui/material';
import React from 'react';

interface ApiKeyDialogProps {
  open: boolean;
  selectedApiKey: { id: string; name: string; permissions: string[] } | null;
  apiKeyForm: {
    name: string;
    permissions: string[];
  };
  onClose: () => void;
  onFormChange: (field: 'name' | 'permissions', value: string | string[]) => void;
  onSave: () => void;
}

const ApiKeyDialog: React.FC<ApiKeyDialogProps> = ({
  open,
  selectedApiKey,
  apiKeyForm,
  onClose,
  onFormChange,
  onSave,
}) => {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{selectedApiKey ? 'Edit API Key' : 'Generate API Key'}</DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 2 }}>
          <TextField
            fullWidth
            label="Name"
            value={apiKeyForm.name}
            onChange={(e) => onFormChange('name', e.target.value)}
            sx={{ mb: 2 }}
          />
          <FormControl fullWidth>
            <InputLabel>Permissions</InputLabel>
            <Select
              multiple
              value={apiKeyForm.permissions}
              label="Permissions"
              onChange={(e) => onFormChange('permissions', e.target.value as string[])}
            >
              <MenuItem value="read:users">Read Users</MenuItem>
              <MenuItem value="write:users">Write Users</MenuItem>
              <MenuItem value="read:transactions">Read Transactions</MenuItem>
              <MenuItem value="write:transactions">Write Transactions</MenuItem>
              <MenuItem value="read:games">Read Games</MenuItem>
              <MenuItem value="write:games">Write Games</MenuItem>
              <MenuItem value="read:settings">Read Settings</MenuItem>
              <MenuItem value="write:settings">Write Settings</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={onSave} variant="contained">
          {selectedApiKey ? 'Save' : 'Generate'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ApiKeyDialog;
