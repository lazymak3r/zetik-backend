import { CloudUpload, Delete, Edit, Search } from '@mui/icons-material';
import {
  Box,
  Checkbox,
  FormControlLabel,
  IconButton,
  InputAdornment,
  MenuItem,
  Pagination,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import React from 'react';
import { ProviderGame } from '../types';

interface GameWithImage extends ProviderGame {
  imageUrl?: string | null;
  hasCustomImage: boolean;
  hasCustomDescription: boolean;
}

interface GamesTableProps {
  games: GameWithImage[];
  page: number;
  pageSize: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onUploadImage: (game: ProviderGame) => void;
  onEditDescription: (game: ProviderGame) => void;
  onDeleteImage?: (game: ProviderGame) => void;
  onDeleteDescription?: (game: ProviderGame) => void;
  filterCustomImage: boolean;
  filterCustomDescription: boolean;
  onFilterCustomImageChange: (value: boolean) => void;
  onFilterCustomDescriptionChange: (value: boolean) => void;
  searchQuery: string;
  onSearchChange: (value: string) => void;
}

const GamesTable: React.FC<GamesTableProps> = ({
  games,
  page,
  pageSize,
  totalPages,
  onPageChange,
  onPageSizeChange,
  onUploadImage,
  onEditDescription,
  onDeleteImage,
  onDeleteDescription,
  filterCustomImage,
  filterCustomDescription,
  onFilterCustomImageChange,
  onFilterCustomDescriptionChange,
  searchQuery,
  onSearchChange,
}) => {
  const paginatedGames = games.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize);

  return (
    <>
      <Box sx={{ mb: 2 }}>
        <TextField
          fullWidth
          placeholder="Search by game name..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search />
              </InputAdornment>
            ),
          }}
          sx={{ mb: 2 }}
        />
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <FormControlLabel
            control={
              <Checkbox
                checked={filterCustomImage}
                onChange={(e) => onFilterCustomImageChange(e.target.checked)}
              />
            }
            label="With custom image"
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={filterCustomDescription}
                onChange={(e) => onFilterCustomDescriptionChange(e.target.checked)}
              />
            }
            label="With custom description"
          />
        </Box>
      </Box>

      <TableContainer component={Paper} sx={{ mb: 3 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Image</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Code</TableCell>
              <TableCell>Description</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {paginatedGames.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  <Typography variant="body2" color="text.secondary">
                    No games found
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              paginatedGames.map((game) => (
                <TableRow key={game.code}>
                  <TableCell>
                    {game.imageUrl ? (
                      <img
                        style={{
                          maxWidth: 100,
                          height: 75,
                          objectFit: 'cover',
                          borderRadius: 4,
                        }}
                        src={game.imageUrl}
                        alt={game.name}
                      />
                    ) : (
                      <div>Default image</div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" noWrap title={game.name}>
                      <strong>{game.name}</strong>
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary" noWrap>
                      {game.code}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography
                      variant="body2"
                      sx={{
                        maxWidth: 300,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        cursor: 'pointer',
                        color: game.description ? 'text.primary' : 'text.secondary',
                      }}
                      title={game.description || 'No description'}
                      onClick={() => onEditDescription(game)}
                    >
                      {game.description || 'No description'}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Upload Image">
                      <IconButton size="small" color="primary" onClick={() => onUploadImage(game)}>
                        <CloudUpload />
                      </IconButton>
                    </Tooltip>
                    {game.imageUrl && onDeleteImage && (
                      <Tooltip title="Delete Image">
                        <IconButton size="small" color="error" onClick={() => onDeleteImage(game)}>
                          <Delete />
                        </IconButton>
                      </Tooltip>
                    )}
                    <Tooltip title="Edit Description">
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={() => onEditDescription(game)}
                      >
                        <Edit />
                      </IconButton>
                    </Tooltip>
                    {game.hasCustomDescription && onDeleteDescription && (
                      <Tooltip title="Delete Description">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => onDeleteDescription(game)}
                        >
                          <Delete />
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 2, mt: 3 }}>
        <Pagination
          count={totalPages}
          page={page}
          onChange={(_, value) => onPageChange(value)}
          color="primary"
          showFirstButton
          showLastButton
        />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Per page:
          </Typography>
          <Select
            size="small"
            value={pageSize}
            onChange={(e) => {
              const next = Number(e.target.value) || 12;
              onPageSizeChange(next);
            }}
          >
            {[8, 12, 16, 24, 32].map((n) => (
              <MenuItem key={n} value={n}>
                {n}
              </MenuItem>
            ))}
          </Select>
        </Box>
      </Box>
    </>
  );
};

export default GamesTable;
