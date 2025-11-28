import { Add, Delete, Edit } from '@mui/icons-material';
import {
  Box,
  Button,
  Chip,
  IconButton,
  Paper,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import React from 'react';
import { ApiKey } from '../../types/settings.types';

interface ApiKeysTabProps {
  apiKeys: ApiKey[];
  onGenerateApiKey: () => void;
  onEditApiKey: (apiKey: ApiKey) => void;
  onDeleteApiKey: (apiKeyId: string, apiKeyName: string) => void;
  onToggleApiKey: (apiKeyId: string, isActive: boolean) => void;
}

const ApiKeysTab: React.FC<ApiKeysTabProps> = ({
  apiKeys,
  onGenerateApiKey,
  onEditApiKey,
  onDeleteApiKey,
  onToggleApiKey,
}) => {
  return (
    <>
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between' }}>
        <Typography variant="h6">API Keys</Typography>
        <Button variant="contained" startIcon={<Add />} onClick={onGenerateApiKey}>
          Generate API Key
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Key (Partial)</TableCell>
              <TableCell>Permissions</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Last Used</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {apiKeys.map((apiKey) => (
              <TableRow key={apiKey.id}>
                <TableCell>{apiKey.name}</TableCell>
                <TableCell>{apiKey.key.substring(0, 8)}...</TableCell>
                <TableCell>
                  {apiKey.permissions.map((perm) => (
                    <Chip key={perm} label={perm} size="small" sx={{ mr: 0.5 }} />
                  ))}
                </TableCell>
                <TableCell>
                  <Switch
                    checked={apiKey.isActive}
                    onChange={(e) => onToggleApiKey(apiKey.id, e.target.checked)}
                  />
                </TableCell>
                <TableCell>
                  {apiKey.lastUsed ? new Date(apiKey.lastUsed).toLocaleString() : 'Never'}
                </TableCell>
                <TableCell>
                  <IconButton onClick={() => onEditApiKey(apiKey)} size="small">
                    <Edit />
                  </IconButton>
                  <IconButton
                    onClick={() => onDeleteApiKey(apiKey.id, apiKey.name)}
                    size="small"
                    color="error"
                  >
                    <Delete />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </>
  );
};

export default ApiKeysTab;
