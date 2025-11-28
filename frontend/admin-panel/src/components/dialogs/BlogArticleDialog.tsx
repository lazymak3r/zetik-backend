import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  TextField,
  ThemeProvider,
  Typography,
  createTheme,
} from '@mui/material';
import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../../store';
import {
  BlogArticleTagEnum,
  clearError,
  clearSelectedArticle,
  createArticle,
  fetchArticleById,
  getTagLabel,
  updateArticle,
} from '../../store/slices/blogSlice';
import { BlogArticleContentTypeEnum, getContentTypeLabel } from '../../types/blog.types';
import CoverSelector from '../CoverSelector';
import HtmlEditor from '../HtmlEditor';

interface BlogArticleDialogProps {
  open: boolean;
  onClose: () => void;
  articleId: number | null;
}

interface FormData {
  title: string;
  slug: string;
  content: string;
  subTitle: string;
  cover: string;
  tags: BlogArticleTagEnum[];
  endsAt: string;
  isPublished: boolean;
  contentType: BlogArticleContentTypeEnum;
}

const BlogArticleDialog: React.FC<BlogArticleDialogProps> = ({ open, onClose, articleId }) => {
  const dispatch = useDispatch<AppDispatch>();
  const { selectedArticle, loading, error } = useSelector((state: RootState) => state.blog);

  const [formData, setFormData] = useState<FormData>({
    title: '',
    slug: '',
    content: '',
    subTitle: '',
    cover: '',
    tags: [BlogArticleTagEnum.OTHER], // Default tag selected
    endsAt: '',
    isPublished: false,
    contentType: BlogArticleContentTypeEnum.BLOG, // Default to blog
  });

  const [tagError, setTagError] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Темная тема для изолированного preview
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

  // Sample content for demonstration
  const sampleContent = `<h2>Welcome to Online Casino Gaming</h2>

<p><strong>Discover the excitement</strong> of online casino gaming with our comprehensive guide. Whether you're a <em>beginner</em> or an <u>experienced player</u>, this article will help you navigate the world of digital gambling.</p>

<img src="https://images.unsplash.com/photo-1596838132731-3301c3fd4317?w=600&h=300&fit=crop&auto=format" alt="Casino Gaming" style="width: 100%; max-width: 600px; height: auto; border-radius: 8px; margin: 16px 0;" />

<h3>Popular Casino Games</h3>

<p>Here are the most popular casino games you can enjoy:</p>

<ul>
  <li><strong>Slot Machines</strong> - Easy to play with exciting themes</li>
  <li><strong>Blackjack</strong> - Classic card game requiring strategy</li>
  <li><strong>Roulette</strong> - Spin the wheel and test your luck</li>
  <li><strong>Poker</strong> - Skill-based game with multiple variants</li>
</ul>

<h3>Safety Tips</h3>

<ol>
  <li>Always play on <a href="https://example.com/licensed-casinos" target="_blank">licensed platforms</a></li>
  <li>Set a budget and stick to it</li>
  <li>Take regular breaks during gaming sessions</li>
  <li>Never chase your losses</li>
</ol>

<blockquote style="border-left: 4px solid #1976d2; padding-left: 16px; margin: 16px 0; font-style: italic; color: #666;">
"Responsible gambling is the key to enjoying casino games safely and sustainably."
</blockquote>

<p>For more information about <a href="https://example.com/responsible-gambling" target="_blank"><u>responsible gambling practices</u></a>, visit our dedicated section.</p>`;

  const isEditing = articleId !== null;

  // Function to get full image URL
  const getImageUrl = (path: string) => {
    if (!path) return '';
    if (path.startsWith('http')) return path; // Already full URL
    const baseUrl = process.env.REACT_APP_PUBLIC_STORAGE_BASE_URL || 'http://localhost:9000/zetik';
    return `${baseUrl}/${path}`;
  };

  // Function to generate slug from title
  const generateSlug = (title: string): string => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  useEffect(() => {
    if (open && articleId) {
      dispatch(fetchArticleById(articleId));
    }
  }, [open, articleId, dispatch]);

  useEffect(() => {
    if (selectedArticle && isEditing) {
      // Convert string labels from API to enum values for checkboxes
      const parsedTags: BlogArticleTagEnum[] = (selectedArticle.tags || []).map((label) => {
        const match = Object.values(BlogArticleTagEnum).find((e) => getTagLabel(e) === label);
        return match || BlogArticleTagEnum.OTHER;
      });
      setFormData({
        title: selectedArticle.title || '',
        slug: selectedArticle.slug || '',
        content: selectedArticle.content || '',
        subTitle: selectedArticle.subTitle || '',
        cover: selectedArticle.cover || '',
        tags: parsedTags,
        endsAt: selectedArticle.endsAt
          ? new Date(selectedArticle.endsAt).toISOString().slice(0, 16)
          : '',
        isPublished: selectedArticle.isPublished || false,
        contentType: selectedArticle.contentType || BlogArticleContentTypeEnum.BLOG,
      });
    }
  }, [selectedArticle, isEditing]);

  const handleInputChange =
    (field: keyof FormData) => (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      setFormData((prev) => {
        const newData = {
          ...prev,
          [field]: value,
        };

        // Auto-generate slug when title changes (only if not editing or slug is empty)
        if (field === 'title' && (!isEditing || !prev.slug)) {
          newData.slug = generateSlug(value);
        }

        return newData;
      });
    };

  const handleTagChange = (tag: BlogArticleTagEnum) => {
    setFormData((prev) => ({
      ...prev,
      tags: prev.tags.includes(tag) ? prev.tags.filter((t) => t !== tag) : [...prev.tags, tag],
    }));
  };

  const handleSubmit = async () => {
    if (
      !formData.title?.trim() ||
      !formData.content?.trim() ||
      !formData.cover?.trim() ||
      formData.tags.length === 0
    ) {
      return;
    }

    // Map API enum tags to human-readable DB values
    const mappedTags: string[] = formData.tags.map(getTagLabel);
    // Prepare data for submission (cast to any to bypass TS tag type mismatch)
    const submitData: any = {
      ...formData,
      tags: mappedTags,
      endsAt: formData.endsAt ? new Date(formData.endsAt) : undefined,
    };

    try {
      if (isEditing && articleId) {
        await dispatch(updateArticle({ id: articleId, data: submitData })).unwrap();
      } else {
        await dispatch(createArticle(submitData)).unwrap();
      }
      handleClose();
    } catch (err) {
      // Error handling is done in Redux
    }
  };

  const handleClose = () => {
    setFormData({
      title: '',
      slug: '',
      content: '',
      subTitle: '',
      cover: '',
      tags: [BlogArticleTagEnum.OTHER], // Default tag selected
      endsAt: '',
      isPublished: false,
      contentType: BlogArticleContentTypeEnum.BLOG, // Default to blog
    });
    dispatch(clearSelectedArticle());
    dispatch(clearError());
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth={false}
      fullWidth
      PaperProps={{
        sx: {
          width: '95vw',
          height: '95vh', // Increased to 95% of screen height
          maxWidth: 'none',
          maxHeight: 'none',
        },
      }}
    >
      <DialogContent sx={{ p: 3, pt: 1 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Box
          sx={{
            display: 'flex',
            height: { xs: 'auto', md: 'calc(90vh - 80px)' }, // Auto height on mobile, fixed on desktop
            gap: 3,
            flexDirection: { xs: 'column', md: 'row' },
          }}
        >
          {/* Left column - content editor only */}
          <Box
            sx={{
              flex: 1,
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
              height: { xs: '40vh', md: 'auto' }, // Fixed height on mobile to prevent overflow
              minHeight: { xs: '40vh', md: 0 },
            }}
          >
            {/* Main content editor */}
            <Box
              sx={{
                height: '100%',
                minHeight: { xs: '40vh', md: '80vh' },
                overflow: 'visible',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <HtmlEditor
                value={formData.content}
                onChange={(content) => setFormData((prev) => ({ ...prev, content }))}
                placeholder="Enter article content..."
                height="60vh"
                label="Article Content"
              />
            </Box>
          </Box>

          {/* Right column - all settings */}
          <Box
            sx={{
              width: { xs: '100%', md: 320 },
              minWidth: { xs: 'auto', md: 280 },
              maxHeight: { xs: '50vh', md: '70vh' }, // Limited height on mobile to prevent overflow
              overflowY: { xs: 'auto', md: 'auto' }, // Enable scroll on mobile when needed
              pr: { md: 1 },
              pt: 1, // Add top padding so Title is not clipped
              flexShrink: 0,
            }}
          >
            {/* Dialog title */}
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 700, color: 'primary.main' }}>
              {isEditing ? 'Edit Article' : 'Create New Article'}
            </Typography>

            {/* Title and Subtitle */}
            <Box sx={{ mb: 2 }}>
              <TextField
                fullWidth
                label="Title"
                value={formData.title}
                onChange={handleInputChange('title')}
                sx={{
                  mb: 1.5,
                  '& .MuiInputBase-root': {
                    minHeight: { xs: '48px', sm: '44px' }, // Larger on mobile
                    height: 'auto',
                  },
                  '& .MuiInputBase-input': {
                    py: { xs: 1.5, sm: 1.25 }, // More padding on mobile
                    fontSize: { xs: '16px', sm: '14px' }, // Prevents iOS zoom
                    lineHeight: 1.4,
                  },
                  '& .MuiInputLabel-root': {
                    fontSize: { xs: '16px', sm: '14px' },
                  },
                }}
                InputLabelProps={{
                  shrink: true,
                }}
              />
              <TextField
                fullWidth
                label="Slug (URL)"
                value={formData.slug}
                onChange={handleInputChange('slug')}
                helperText="Auto-generated from title, can be edited"
                sx={{
                  mb: 1.5,
                  '& .MuiInputBase-root': {
                    minHeight: { xs: '48px', sm: '44px' },
                    height: 'auto',
                  },
                  '& .MuiInputBase-input': {
                    py: { xs: 1.5, sm: 1.25 },
                    fontSize: { xs: '16px', sm: '14px' },
                    lineHeight: 1.4,
                  },
                  '& .MuiInputLabel-root': {
                    fontSize: { xs: '16px', sm: '14px' },
                  },
                }}
                InputLabelProps={{
                  shrink: true,
                }}
              />
              <TextField
                fullWidth
                label="Subtitle"
                value={formData.subTitle}
                onChange={handleInputChange('subTitle')}
                placeholder="Optional"
                sx={{
                  '& .MuiInputBase-root': {
                    minHeight: { xs: '48px', sm: '44px' }, // Larger on mobile
                    height: 'auto',
                  },
                  '& .MuiInputBase-input': {
                    py: { xs: 1.5, sm: 1.25 }, // More padding on mobile
                    fontSize: { xs: '16px', sm: '14px' }, // Prevents iOS zoom
                    lineHeight: 1.4,
                  },
                  '& .MuiInputLabel-root': {
                    fontSize: { xs: '16px', sm: '14px' },
                  },
                }}
                InputLabelProps={{
                  shrink: true,
                }}
              />
            </Box>

            {/* Content Type */}
            <Box sx={{ mb: 2 }}>
              <FormControl fullWidth>
                <InputLabel>Content Type</InputLabel>
                <Select
                  value={formData.contentType}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      contentType: e.target.value as BlogArticleContentTypeEnum,
                    }))
                  }
                  label="Content Type"
                  sx={{
                    '& .MuiInputBase-root': {
                      minHeight: { xs: '48px', sm: '44px' },
                    },
                  }}
                >
                  {Object.values(BlogArticleContentTypeEnum).map((type) => (
                    <MenuItem key={type} value={type}>
                      {getContentTypeLabel(type)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            {/* Tags */}
            <Box sx={{ mb: 2 }}>
              <Typography
                variant="subtitle1"
                sx={{ mb: 0.5, fontWeight: 600, fontSize: '0.95rem' }}
              >
                Article Tags (select at least one)
              </Typography>

              <Box
                sx={{
                  border: formData.tags.length === 0 ? '1px solid #d32f2f' : '1px solid #e0e0e0',
                  borderRadius: 1,
                  p: 0.5,
                  backgroundColor: '#fafafa',
                }}
              >
                {Object.values(BlogArticleTagEnum)
                  .filter((tag) => tag !== BlogArticleTagEnum.ALL)
                  .map((tag) => (
                    <FormControlLabel
                      key={tag}
                      control={
                        <Checkbox
                          size="small"
                          checked={formData.tags.includes(tag)}
                          onChange={() => handleTagChange(tag)}
                        />
                      }
                      label={getTagLabel(tag)}
                      sx={{
                        display: 'block',
                        m: 0,
                        py: 0.25,
                        '& .MuiFormControlLabel-label': {
                          fontSize: '0.8rem',
                          lineHeight: 1.2,
                        },
                        '& .MuiCheckbox-root': {
                          py: 0.25,
                        },
                      }}
                    />
                  ))}
              </Box>
              {formData.tags.length === 0 && (
                <Typography variant="caption" color="error" sx={{ mt: 0.5, fontSize: '0.75rem' }}>
                  Please select at least one tag
                </Typography>
              )}
            </Box>

            {/* Cover */}
            <CoverSelector
              value={formData.cover}
              onChange={(value) => setFormData((prev) => ({ ...prev, cover: value }))}
              required
              error={!formData.cover?.trim()}
              helperText={!formData.cover?.trim() ? 'Cover image is required' : ''}
            />

            {/* Cover Preview */}
            {formData.cover && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                  Preview
                </Typography>
                <Box
                  sx={{
                    width: '100%',
                    height: 120,
                    border: '1px solid',
                    borderColor: 'grey.300',
                    borderRadius: 1,
                    overflow: 'hidden',
                    position: 'relative',
                  }}
                >
                  <img
                    src={getImageUrl(formData.cover)}
                    alt="Cover preview"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    }}
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </Box>
                <Typography
                  variant="caption"
                  sx={{ mt: 0.5, display: 'block', color: 'text.secondary' }}
                >
                  {formData.cover}
                </Typography>
              </Box>
            )}

            {/* End Date */}
            <Box sx={{ mb: 1 }}>
              <TextField
                fullWidth
                label="End Date"
                type="datetime-local"
                value={formData.endsAt}
                onChange={handleInputChange('endsAt')}
                helperText="Expiration date (optional)"
                sx={{
                  '& .MuiInputBase-root': {
                    minHeight: { xs: '48px', sm: '40px' },
                  },
                  '& .MuiInputBase-input': {
                    py: { xs: 1.5, sm: 1 },
                    fontSize: { xs: '16px', sm: '14px' },
                  },
                }}
                InputLabelProps={{
                  shrink: true,
                }}
              />
            </Box>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          px: 3,
          py: 2,
          gap: 2,
        }}
      >
        {/* Left side - Publication Status */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <FormControlLabel
            control={
              <Switch
                checked={formData.isPublished}
                onChange={(e) => {
                  setFormData((prev) => ({ ...prev, isPublished: e.target.checked }));
                }}
                color="primary"
                size="medium"
              />
            }
            label={
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                {formData.isPublished ? '✅ Published' : '📝 Draft'}
              </Typography>
            }
            sx={{
              '& .MuiFormControlLabel-label': { ml: 0.5 },
            }}
          />
        </Box>

        {/* Center - Cache Notice */}
        <Alert
          severity="info"
          sx={{
            minWidth: 0,
            flex: 1,
            mx: 2,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            '& .MuiAlert-message': {
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            },
          }}
        >
          📋 The website uses 5-minute caching. Changes may take up to 5 minutes to appear on the
          client side.
        </Alert>

        {/* Right side - Action Buttons */}
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            onClick={() => setPreviewOpen(true)}
            disabled={!formData.title?.trim() || !formData.content?.trim()}
            variant="outlined"
          >
            Preview
          </Button>
          <Button onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={
              loading ||
              !formData.title?.trim() ||
              !formData.content?.trim() ||
              !formData.cover?.trim() ||
              formData.tags.length === 0
            }
          >
            {loading ? 'Saving...' : isEditing ? 'Update' : 'Create'}
          </Button>
        </Box>
      </DialogActions>

      {/* Preview Dialog - полностью изолированный */}
      <Dialog
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
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
                🔍 Preview
              </Typography>
              <Button onClick={() => setPreviewOpen(false)} sx={{ color: '#F2BC4B' }}>
                ✕ Close
              </Button>
            </Box>

            {/* Preview Content */}
            <Box sx={{ flex: 1, overflow: 'auto', backgroundColor: '#0a0a0a' }}>
              {/* Article Info Section - как на pubgclash.com */}
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
                {formData.endsAt && (
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
                    {new Date(formData.endsAt).toLocaleString('en-US', {
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
                  {formData.title || 'Article Title'}
                </Typography>

                {/* Subtitle */}
                {formData.subTitle && (
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
                    {formData.subTitle}
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
                  {formData.tags.map((tag) => (
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
                      {getTagLabel(tag)}
                    </Box>
                  ))}
                </Box>
              </Box>

              {/* Cover Image - Content Width */}
              {formData.cover && (
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
                      src={getImageUrl(formData.cover)}
                      alt={formData.title}
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

              {/* Article Content Section */}
              <Box
                sx={{
                  backgroundColor: '#0a0a0a',
                  minHeight: '60vh',
                  py: 4,
                }}
              >
                {/* Article Content Container */}
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
                      __html: formData.content || '<p>No content available</p>',
                    }}
                  />
                </Box>
              </Box>
            </Box>
          </Box>
        </ThemeProvider>
      </Dialog>
    </Dialog>
  );
};

export default BlogArticleDialog;
