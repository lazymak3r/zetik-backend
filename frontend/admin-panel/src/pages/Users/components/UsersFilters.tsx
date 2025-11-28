import { Search } from '@mui/icons-material';
import { Box, Card, CardContent, InputAdornment, Tab, Tabs, TextField } from '@mui/material';
import React from 'react';

interface UsersFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  bannedFilter: boolean | undefined;
  onFilterChange: (value: boolean | undefined) => void;
}

const UsersFilters: React.FC<UsersFiltersProps> = ({
  searchTerm,
  onSearchChange,
  bannedFilter,
  onFilterChange,
}) => {
  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Box display="flex" gap={2} alignItems="center">
          <TextField
            placeholder="Search by email or username..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              ),
            }}
            sx={{ flex: 1 }}
          />
          <Tabs
            value={bannedFilter === undefined ? 'all' : bannedFilter ? 'banned' : 'active'}
            onChange={(_, value) => {
              onFilterChange(value === 'all' ? undefined : value === 'banned');
            }}
          >
            <Tab value="all" label="All Users" />
            <Tab value="banned" label="Banned" />
            <Tab value="active" label="Active" />
          </Tabs>
        </Box>
      </CardContent>
    </Card>
  );
};

export default UsersFilters;
