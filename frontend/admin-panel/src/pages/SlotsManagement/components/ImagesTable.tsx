import { Delete, Edit } from '@mui/icons-material';
import {
  Box,
  IconButton,
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
  Tooltip,
  Typography,
} from '@mui/material';
import React from 'react';
import { ImageItem } from '../types';
import { formatFileSize } from '../utils/formatFileSize';

interface ImagesTableProps {
  images: ImageItem[];
  page: number;
  pageSize: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onImagePreview: (image: ImageItem) => void;
  onDelete: (image: ImageItem) => void;
  onEditDescription: (image: ImageItem) => void;
}

const ImagesTable: React.FC<ImagesTableProps> = ({
  images,
  page,
  pageSize,
  totalPages,
  onPageChange,
  onPageSizeChange,
  onImagePreview,
  onDelete,
  onEditDescription,
}) => {
  const paginatedImages = images.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize);

  return (
    <>
      <TableContainer component={Paper} sx={{ mb: 3 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Image</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Description</TableCell>
              <TableCell>Size</TableCell>
              <TableCell>Format</TableCell>
              <TableCell>Date</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {paginatedImages.map((img) => (
              <TableRow key={img.id}>
                <TableCell>
                  <img
                    style={{
                      maxWidth: 100,
                      height: 75,
                      objectFit: 'cover',
                      cursor: 'pointer',
                    }}
                    src={img.src}
                    alt={img.name}
                    onClick={() => onImagePreview(img)}
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="body2" noWrap title={img.name}>
                    <strong>{img.name}</strong>
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
                      cursor: img.gameCode ? 'pointer' : 'default',
                      color: img.description ? 'text.primary' : 'text.secondary',
                    }}
                    title={img.description || 'No description'}
                    onClick={() => {
                      if (img.gameCode) {
                        onEditDescription(img);
                      }
                    }}
                  >
                    {img.description || 'No description'}
                  </Typography>
                </TableCell>
                <TableCell>{formatFileSize(img.sizeBytes)}</TableCell>
                <TableCell>{img.format.toUpperCase()}</TableCell>
                <TableCell>{new Date(img.createdAt).toLocaleDateString()}</TableCell>
                <TableCell align="right">
                  {img.gameCode && (
                    <Tooltip title="Edit Description">
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={() => onEditDescription(img)}
                      >
                        <Edit />
                      </IconButton>
                    </Tooltip>
                  )}
                  <Tooltip title="Delete">
                    <IconButton size="small" color="error" onClick={() => onDelete(img)}>
                      <Delete />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
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

export default ImagesTable;
