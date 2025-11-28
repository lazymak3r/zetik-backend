import {
  Add,
  Delete,
  Edit,
  FilterList,
  ImageNotSupported,
  Search,
  Visibility,
} from '@mui/icons-material';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  SelectChangeEvent,
  TextField,
  ThemeProvider,
  Typography,
  createTheme,
} from '@mui/material';
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import BlogArticleDialog from '../components/dialogs/BlogArticleDialog';
import { AppDispatch, RootState } from '../store';
import {
  BlogArticleTagEnum,
  deleteArticle,
  fetchArticles,
  getTagLabel,
} from '../store/slices/blogSlice';

// Dark theme for preview
const darkPreviewTheme = createTheme({
  palette: {
    mode: 'dark',
    background: {
      default: '#0a0a0a',
      paper: '#1a1a1a',
    },
    text: {
      primary: '#ffffff',
      secondary: '#cccccc',
    },
    primary: {
      main: '#F2BC4B',
    },
  },
  typography: {
    fontFamily:
      '"Poppins", "Roboto", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
});

const Blog: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { articles, total, page, pageSize, loading } = useSelector(
    (state: RootState) => state.blog,
  );

  // Function to get full image URL
  const getImageUrl = (path: string) => {
    if (!path) return '';
    if (path.startsWith('http')) return path; // Already full URL
    const baseUrl = process.env.REACT_APP_PUBLIC_STORAGE_BASE_URL || 'http://localhost:9000/zetik';
    return `${baseUrl}/${path}`;
  };
  const [articleDialogOpen, setArticleDialogOpen] = useState(false);
  const [selectedArticleId, setSelectedArticleId] = useState<number | null>(null);
  const [selectedTag, setSelectedTag] = useState<BlogArticleTagEnum | 'all'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // States for delete confirmation dialog
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [articleToDelete, setArticleToDelete] = useState<{ id: number; title: string } | null>(
    null,
  );
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  // States for preview dialog
  const [previewDialog, setPreviewDialog] = useState(false);
  const [previewArticle, setPreviewArticle] = useState<any>(null);

  // Modern debounce without lodash
  const fetchArticlesWithParams = useCallback(() => {
    const params = {
      page: currentPage,
      limit: 25,
      tag: selectedTag === 'all' ? undefined : selectedTag,
      search: searchTerm || undefined,
    };
    dispatch(fetchArticles(params));
  }, [dispatch, currentPage, selectedTag, searchTerm]);

  useEffect(() => {
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // If there's a search term, use debounce
    if (searchTerm) {
      searchTimeoutRef.current = setTimeout(fetchArticlesWithParams, 500);
    } else {
      // If no search, fetch immediately
      fetchArticlesWithParams();
    }

    // Cleanup
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [fetchArticlesWithParams, searchTerm]);

  const handleCreateArticle = () => {
    setSelectedArticleId(null);
    setArticleDialogOpen(true);
  };

  const handleEditArticle = (id: number) => {
    setSelectedArticleId(id);
    setArticleDialogOpen(true);
  };

  const handleDeleteArticle = (id: number, title: string) => {
    setArticleToDelete({ id, title });
    setDeleteConfirmText('');
    setDeleteDialog(true);
  };

  const handlePreviewArticle = (article: any) => {
    setPreviewArticle(article);
    setPreviewDialog(true);
  };

  const handleConfirmDelete = async () => {
    if (articleToDelete) {
      await dispatch(deleteArticle(articleToDelete.id));
      setDeleteDialog(false);
      setArticleToDelete(null);
      setDeleteConfirmText('');
      // Reload data after deletion
      dispatch(
        fetchArticles({
          page: currentPage,
          limit: 25,
          tag: selectedTag === 'all' ? undefined : selectedTag,
          search: searchTerm || undefined,
        }),
      );
    }
  };

  const handleTagFilterChange = (event: SelectChangeEvent<string>) => {
    setSelectedTag(event.target.value as BlogArticleTagEnum | 'all');
    setCurrentPage(1); // Reset to first page on filter change
  };

  // Removed handlePageChange - using handlePaginationModelChange

  const handlePaginationModelChange = (model: { page: number; pageSize: number }) => {
    setCurrentPage(model.page + 1); // DataGrid uses 0-based indexing
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
    setCurrentPage(1); // Reset to first page on search
  };

  const getTagChips = (tags: BlogArticleTagEnum[]) => {
    return tags.map((tag) => ({
      label: getTagLabel(tag),
      color: 'primary' as const,
    }));
  };

  const renderCoverImage = (coverUrl: string | null) => {
    if (!coverUrl) {
      return (
        <Box
          display="flex"
          alignItems="center"
          justifyContent="center"
          width={60}
          height={40}
          bgcolor="grey.100"
          borderRadius={1}
        >
          <ImageNotSupported color="disabled" fontSize="small" />
        </Box>
      );
    }

    return (
      <img
        src={getImageUrl(coverUrl)}
        alt="Cover"
        style={{
          width: 60,
          height: 40,
          objectFit: 'cover',
          borderRadius: 4,
        }}
        onError={(e) => {
          // If image failed to load, show icon
          const target = e.target as HTMLImageElement;
          target.style.display = 'none';
          const parent = target.parentElement;
          if (parent) {
            parent.innerHTML = `
              <div style="display: flex; align-items: center; justify-content: center; width: 60px; height: 40px; background-color: #f5f5f5; border-radius: 4px;">
                <svg class="MuiSvgIcon-root MuiSvgIcon-colorDisabled" focusable="false" aria-hidden="true" viewBox="0 0 24 24" style="font-size: 1.125rem;">
                  <path d="M21.9 21.9 2.1 2.1.7 3.5l3.8 3.8c-.5.4-.8 1.1-.8 1.8v9.9c0 1.1.9 2 2 2h12.1l1.8 1.8zM5 18l3.5-4.5 2.5 3.01L12.5 15l2.5 3zm11.8 0H21c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2H7c-.6 0-1.1.2-1.5.5L17.3 15.3z"></path>
                </svg>
              </div>
            `;
          }
        }}
      />
    );
  };

  const columns: GridColDef[] = [
    {
      field: 'cover',
      headerName: 'Cover',
      width: 80,
      sortable: false,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params: GridRenderCellParams) => (
        <Box display="flex" alignItems="center" justifyContent="center" height="100%">
          {renderCoverImage(params.value)}
        </Box>
      ),
    },
    {
      field: 'title',
      headerName: 'Title',
      flex: 1,
      minWidth: 150,
      align: 'left',
      headerAlign: 'center',
      renderCell: (params: GridRenderCellParams) => (
        <Box display="flex" alignItems="center" height="100%">
          <Typography
            variant="body2"
            fontWeight="bold"
            sx={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: '100%',
            }}
            title={params.value} // Show full text on hover
          >
            {params.value}
          </Typography>
        </Box>
      ),
    },
    {
      field: 'tags',
      headerName: 'Tags',
      width: 200,
      sortable: false,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params: GridRenderCellParams) => {
        const tagChips = getTagChips(params.value || []);
        return (
          <Box display="flex" alignItems="center" justifyContent="center" height="100%" py={1}>
            <Box
              display="flex"
              gap={0.5}
              flexWrap="wrap"
              justifyContent="center"
              sx={{
                overflow: 'hidden',
                maxHeight: '40px',
              }}
            >
              {tagChips.slice(0, 2).map((chip, index) => (
                <Chip
                  key={index}
                  label={chip.label}
                  size="small"
                  color={chip.color}
                  variant="outlined"
                />
              ))}
              {tagChips.length > 2 && (
                <Chip
                  label={`+${tagChips.length - 2}`}
                  size="small"
                  variant="outlined"
                  color="default"
                />
              )}
            </Box>
          </Box>
        );
      },
    },

    {
      field: 'isPublished',
      headerName: 'Published',
      width: 100,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params: GridRenderCellParams) => (
        <Box display="flex" alignItems="center" justifyContent="center" height="100%">
          <Chip
            label={params.value ? 'Published' : 'Draft'}
            color={params.value ? 'success' : 'default'}
            size="small"
            variant={params.value ? 'filled' : 'outlined'}
          />
        </Box>
      ),
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 130,
      sortable: false,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params: GridRenderCellParams) => (
        <Box display="flex" alignItems="center" justifyContent="center" height="100%" gap={0.5}>
          <IconButton
            size="small"
            onClick={() => handlePreviewArticle(params.row)}
            title="Preview"
            color="info"
          >
            <Visibility />
          </IconButton>
          <IconButton size="small" onClick={() => handleEditArticle(params.row.id)} title="Edit">
            <Edit />
          </IconButton>
          <IconButton
            size="small"
            onClick={() => handleDeleteArticle(params.row.id, params.row.title)}
            title="Delete"
            color="error"
          >
            <Delete />
          </IconButton>
        </Box>
      ),
    },
    {
      field: 'createdAt',
      headerName: 'Created',
      width: 120,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params: GridRenderCellParams) => (
        <Box display="flex" alignItems="center" justifyContent="center" height="100%">
          <Typography variant="body2" fontSize="0.8rem">
            {new Date(params.value).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: '2-digit',
            })}
          </Typography>
        </Box>
      ),
    },
    {
      field: 'endsAt',
      headerName: 'Expires',
      width: 120,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params: GridRenderCellParams) => (
        <Box display="flex" alignItems="center" justifyContent="center" height="100%">
          <Typography variant="body2" fontSize="0.8rem">
            {params.value
              ? new Date(params.value).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: '2-digit',
                })
              : '-'}
          </Typography>
        </Box>
      ),
    },
  ];

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Blog Management</Typography>
        <Button variant="contained" startIcon={<Add />} onClick={handleCreateArticle}>
          Create Article
        </Button>
      </Box>

      <Card>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">Articles ({total})</Typography>

            <Box display="flex" alignItems="center" gap={2}>
              <TextField
                size="small"
                placeholder="Search articles..."
                value={searchTerm}
                onChange={handleSearchChange}
                sx={{ minWidth: 200 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search />
                    </InputAdornment>
                  ),
                }}
              />

              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>Filter by Tag</InputLabel>
                <Select
                  value={selectedTag}
                  onChange={handleTagFilterChange}
                  label="Filter by Tag"
                  startAdornment={<FilterList sx={{ mr: 1, color: 'action.active' }} />}
                >
                  <MenuItem value="all">All Tags</MenuItem>
                  {Object.values(BlogArticleTagEnum)
                    .filter((tag) => tag !== BlogArticleTagEnum.ALL)
                    .map((tag) => (
                      <MenuItem key={tag} value={tag}>
                        {getTagLabel(tag)}
                      </MenuItem>
                    ))}
                </Select>
              </FormControl>
            </Box>
          </Box>

          <DataGrid
            rows={articles}
            columns={columns}
            loading={loading}
            rowCount={total}
            paginationMode="server"
            paginationModel={{
              page: page - 1, // DataGrid uses 0-based indexing
              pageSize: pageSize,
            }}
            onPaginationModelChange={handlePaginationModelChange}
            autoHeight
            disableRowSelectionOnClick
            getRowId={(row) => row.id}
            pageSizeOptions={[25, 50, 100]}
            initialState={{
              sorting: {
                sortModel: [{ field: 'createdAt', sort: 'desc' }],
              },
            }}
            sx={{
              '& .MuiDataGrid-row:hover': {
                backgroundColor: 'rgba(0, 0, 0, 0.04)',
              },
              '& .MuiDataGrid-cell': {
                display: 'flex',
                alignItems: 'center',
              },
              '& .MuiDataGrid-row': {
                minHeight: '60px !important',
              },
            }}
          />
        </CardContent>
      </Card>

      <BlogArticleDialog
        open={articleDialogOpen}
        onClose={() => {
          setArticleDialogOpen(false);
          // Reload data after dialog closes (if article was created/edited)
          dispatch(
            fetchArticles({
              page: currentPage,
              limit: 25,
              tag: selectedTag === 'all' ? undefined : selectedTag,
              search: searchTerm || undefined,
            }),
          );
        }}
        articleId={selectedArticleId}
      />

      {/* Delete Article Confirmation Dialog */}
      <Dialog open={deleteDialog} onClose={() => setDeleteDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ color: 'error.main' }}>⚠️ Delete Article</DialogTitle>
        <DialogContent>
          <Typography variant="body1" gutterBottom>
            You are about to <strong>permanently delete</strong> the article:
          </Typography>
          <Typography variant="h6" gutterBottom sx={{ color: 'text.primary', fontWeight: 'bold' }}>
            "{articleToDelete?.title}"
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            This action cannot be undone. The article and all its content will be permanently
            removed.
          </Typography>
          <Typography variant="body2" color="error.main" gutterBottom sx={{ mt: 2 }}>
            To confirm this dangerous action, please type the article title exactly:{' '}
            <strong>{articleToDelete?.title}</strong>
          </Typography>
          <TextField
            fullWidth
            label={`Type "${articleToDelete?.title}" to confirm`}
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
            sx={{ mt: 2 }}
            error={deleteConfirmText.length > 0 && deleteConfirmText !== articleToDelete?.title}
            helperText={
              deleteConfirmText.length > 0 && deleteConfirmText !== articleToDelete?.title
                ? 'Article title does not match'
                : ''
            }
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleConfirmDelete}
            disabled={deleteConfirmText !== articleToDelete?.title}
          >
            Delete Article
          </Button>
        </DialogActions>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog
        open={previewDialog}
        onClose={() => setPreviewDialog(false)}
        maxWidth={false}
        fullWidth
        PaperProps={{
          sx: {
            width: '95vw',
            height: '95vh',
            maxWidth: 'none',
            maxHeight: 'none',
            backgroundColor: '#0a0a0a',
            color: '#ffffff',
          },
        }}
      >
        <ThemeProvider theme={darkPreviewTheme}>
          <Box
            sx={{
              width: '100%',
              height: '100%',
              backgroundColor: '#0a0a0a',
              color: '#ffffff',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Preview Header */}
            <Box
              sx={{
                p: 2,
                borderBottom: '1px solid #333',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: '#1a1a1a',
              }}
            >
              <Typography variant="h6" sx={{ color: '#ffffff' }}>
                👁️ Article Preview
              </Typography>
              <Button onClick={() => setPreviewDialog(false)} sx={{ color: '#F2BC4B' }}>
                ✕ Close
              </Button>
            </Box>

            {/* Preview Content */}
            <Box sx={{ flex: 1, overflow: 'auto', backgroundColor: '#0a0a0a' }}>
              {previewArticle && (
                <>
                  {/* Article Info Section */}
                  <Box
                    sx={{
                      backgroundColor: '#0a0a0a',
                      px: { xs: 2, md: 4 },
                      py: { xs: 3, md: 4 },
                      maxWidth: '838px',
                      mx: 'auto',
                    }}
                  >
                    {/* End Date */}
                    {previewArticle.endsAt && (
                      <Typography
                        component="div"
                        sx={{
                          mb: 1,
                          color: '#888888',
                          fontSize: { xs: '0.75rem', md: '0.875rem' },
                          fontWeight: 400,
                          textAlign: 'left',
                        }}
                      >
                        Ends at{' '}
                        {new Date(previewArticle.endsAt).toLocaleString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit',
                          hour12: true,
                          month: 'numeric',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </Typography>
                    )}

                    {/* Main Title */}
                    <Typography
                      component="h1"
                      sx={{
                        mb: { xs: 1, md: 2 },
                        fontWeight: 700,
                        fontSize: { xs: '2rem', md: '2.75rem', lg: '3.25rem' },
                        lineHeight: { xs: 1.2, md: 1.1 },
                        color: 'white',
                        textAlign: 'left',
                        letterSpacing: '-0.02em',
                        fontFamily: '"Poppins", "Roboto", sans-serif',
                      }}
                    >
                      {previewArticle.title}
                    </Typography>

                    {/* Subtitle */}
                    {previewArticle.subTitle && (
                      <Typography
                        component="div"
                        sx={{
                          mb: { xs: 2, md: 3 },
                          color: '#cccccc',
                          fontSize: { xs: '1rem', md: '1.25rem' },
                          fontWeight: 400,
                          lineHeight: 1.5,
                          textAlign: 'left',
                          fontStyle: 'italic',
                        }}
                      >
                        {previewArticle.subTitle}
                      </Typography>
                    )}

                    {/* Tags */}
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'flex-start',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        gap: 1,
                        mb: { xs: 3, md: 4 },
                      }}
                    >
                      {previewArticle.tags?.map((tag: string) => (
                        <Box
                          key={tag}
                          sx={{
                            px: 2,
                            py: 0.5,
                            backgroundColor: 'transparent',
                            border: '1px solid #444',
                            borderRadius: 1,
                            color: '#cccccc',
                            fontSize: { xs: '0.75rem', md: '0.875rem' },
                            fontWeight: 400,
                            textTransform: 'capitalize',
                          }}
                        >
                          {getTagLabel(tag as BlogArticleTagEnum)}
                        </Box>
                      ))}
                    </Box>
                  </Box>

                  {/* Cover Image */}
                  {previewArticle.cover && (
                    <Box
                      sx={{
                        px: { xs: 2, md: 4 },
                        mb: { xs: 3, md: 4 },
                      }}
                    >
                      <Box
                        sx={{
                          maxWidth: '838px',
                          mx: 'auto',
                          maxHeight: { xs: '250px', md: '400px', lg: '500px' },
                          overflow: 'hidden',
                          borderRadius: 2,
                        }}
                      >
                        <img
                          src={getImageUrl(previewArticle.cover)}
                          alt={previewArticle.title}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            display: 'block',
                          }}
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      </Box>
                    </Box>
                  )}

                  {/* Article Content */}
                  <Box
                    sx={{
                      backgroundColor: '#0a0a0a',
                      minHeight: '60vh',
                      py: 4,
                    }}
                  >
                    <Box
                      sx={{
                        maxWidth: '838px',
                        mx: 'auto',
                        backgroundColor: 'transparent',
                        p: 4,
                        '& img': {
                          maxWidth: '100%',
                          height: 'auto',
                          borderRadius: '8px',
                          my: 3,
                          boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                        },
                        '& a': {
                          color: '#F2BC4B',
                          textDecoration: 'underline',
                          fontWeight: 600,
                          transition: 'color 0.2s ease',
                          '&:hover': {
                            color: '#FFD700',
                            textDecoration: 'none',
                          },
                        },
                        '& blockquote': {
                          borderLeft: '4px solid #F2BC4B',
                          paddingLeft: 3,
                          paddingY: 2,
                          margin: '24px 0',
                          fontStyle: 'italic',
                          backgroundColor: 'rgba(242,188,75,0.1)',
                          borderRadius: '0 8px 8px 0',
                          fontSize: '1.1rem',
                          color: '#cccccc',
                          boxShadow: '0 2px 8px rgba(242,188,75,0.2)',
                        },
                        '& ul, & ol': {
                          paddingLeft: 3,
                          '& li': {
                            marginBottom: 1.5,
                            lineHeight: 1.7,
                            color: '#cccccc',
                            '& strong': {
                              color: '#ffffff',
                              fontWeight: 700,
                            },
                          },
                        },
                        '& h1, & h2, & h3, & h4, & h5, & h6': {
                          marginTop: 4,
                          marginBottom: 2,
                          fontWeight: 700,
                          color: '#ffffff',
                        },
                        '& h2': {
                          fontSize: '1.875rem',
                          color: '#ffffff',
                          fontWeight: 700,
                          marginBottom: 2,
                        },
                        '& h3': {
                          fontSize: '1.5rem',
                          color: '#ffffff',
                          fontWeight: 700,
                        },
                        '& p': {
                          marginBottom: 2.5,
                          lineHeight: 1.7,
                          fontSize: '1.1rem',
                          color: '#cccccc',
                          '& strong': {
                            color: '#ffffff',
                            fontWeight: 700,
                          },
                          '& em': {
                            color: '#aaaaaa',
                            fontStyle: 'italic',
                          },
                          '& u': {
                            textDecoration: 'underline',
                            textDecorationColor: '#cccccc',
                          },
                        },
                        lineHeight: 1.7,
                        fontSize: '1.1rem',
                        fontFamily:
                          '"Inter", "Roboto", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                      }}
                    >
                      <div
                        dangerouslySetInnerHTML={{
                          __html: previewArticle.content || '<p>No content available</p>',
                        }}
                      />
                    </Box>
                  </Box>
                </>
              )}
            </Box>
          </Box>
        </ThemeProvider>
      </Dialog>
    </Box>
  );
};

export default Blog;
