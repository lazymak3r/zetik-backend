import { ArrowBack } from '@mui/icons-material';
import { Box, IconButton, Paper, Typography } from '@mui/material';
import React from 'react';
import { Developer } from '../types';

interface ProviderHeaderProps {
  provider: Developer | undefined;
  folder: string | undefined;
  gamesCount: number;
  onBack: () => void;
}

const ProviderHeader: React.FC<ProviderHeaderProps> = ({
  provider,
  folder,
  gamesCount,
  onBack,
}) => {
  if (!folder) return null;

  return (
    <Paper sx={{ p: 2, mb: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <IconButton onClick={onBack}>
          <ArrowBack />
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <Typography variant="subtitle1">
            {provider?.name} ({folder})
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Games: {gamesCount}
          </Typography>
        </Box>
      </Box>
    </Paper>
  );
};

export default ProviderHeader;
