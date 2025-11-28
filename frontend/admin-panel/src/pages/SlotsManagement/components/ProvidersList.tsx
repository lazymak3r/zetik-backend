import { Folder } from '@mui/icons-material';
import {
  Box,
  Card,
  CardContent,
  FormControlLabel,
  Grid,
  Pagination,
  Switch,
  Typography,
} from '@mui/material';
import React from 'react';
import { Developer } from '../types';

interface ProvidersListProps {
  folders: string[];
  providerByCode: Record<string, Developer>;
  folderPage: number;
  totalFolderPages: number;
  onFolderPageChange: (page: number) => void;
  onFolderSelect: (folder: string) => void;
  onProviderEnabledChange: (provider: Developer, enabled: boolean) => void;
}

const ProvidersList: React.FC<ProvidersListProps> = ({
  folders,
  providerByCode,
  folderPage,
  totalFolderPages,
  onFolderPageChange,
  onFolderSelect,
  onProviderEnabledChange,
}) => {
  return (
    <Box sx={{ mt: 5 }}>
      <Grid container spacing={3}>
        {folders.map((folder) => {
          const developer = providerByCode[folder];
          const gamesCount = developer?.gamesCount;
          return (
            <Grid key={folder} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
              <Card
                sx={{
                  cursor: 'pointer',
                  userSelect: 'none',
                  opacity: developer?.enabled === false ? 0.6 : 1,
                  '&:hover': { boxShadow: 6 },
                }}
                onClick={() => onFolderSelect(folder)}
              >
                <CardContent>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      mb: 1,
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Folder />
                      <Typography variant="h6">{developer?.code || folder}</Typography>
                    </Box>
                    {developer?.code !== 'zetik' && (
                      <FormControlLabel
                        control={
                          <Switch
                            checked={developer?.enabled !== false}
                            size="small"
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => {
                              e.stopPropagation();
                              if (developer) {
                                onProviderEnabledChange(developer, e.target.checked);
                              }
                            }}
                          />
                        }
                        label=""
                        sx={{ m: 0 }}
                      />
                    )}
                  </Box>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ display: 'block', mb: 1 }}
                  >
                    {developer?.name || folder}
                  </Typography>
                  <Typography variant="body1" color="text.secondary">
                    {gamesCount ?? 0} games
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
        <Pagination
          count={totalFolderPages}
          page={folderPage}
          color="primary"
          showFirstButton
          showLastButton
          onChange={(_, value) => onFolderPageChange(value)}
        />
      </Box>
    </Box>
  );
};

export default ProvidersList;
