import {
  FormatBold,
  FormatItalic,
  FormatListBulleted,
  FormatListNumbered,
  FormatQuote,
  FormatUnderlined,
  Html,
  Image,
  Link,
  Title,
  ViewModule,
} from '@mui/icons-material';
import {
  Box,
  Divider,
  IconButton,
  Paper,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import React, { useCallback, useEffect, useRef, useState } from 'react';

interface HtmlEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  height?: string;
  label?: string;
}

const HtmlEditor: React.FC<HtmlEditorProps> = ({
  value,
  onChange,
  placeholder = 'Enter content...',
  height = '400px',
  label = 'Content',
}) => {
  const [viewMode, setViewMode] = useState<'rich' | 'html'>('rich');
  const editorRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLDivElement>(null);
  // Track focus to avoid resetting content while editing
  const [isFocused, setIsFocused] = useState(false);
  // Update innerHTML only when value changes and editor is not focused
  useEffect(() => {
    if (editorRef.current && !isFocused) {
      editorRef.current.innerHTML = value;
    }
  }, [value, isFocused]);
  // Update innerHTML when switching back to rich view to reflect any HTML edits
  useEffect(() => {
    if (viewMode === 'rich' && editorRef.current) {
      editorRef.current.innerHTML = value;
    }
  }, [viewMode]);
  // Handle paste: insert HTML if available, else insert plain text as HTML
  const handlePaste = useCallback((event: React.ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault();
    const html = event.clipboardData.getData('text/html');
    const text = event.clipboardData.getData('text/plain');
    if (html) {
      document.execCommand('insertHTML', false, html);
    } else if (text) {
      document.execCommand('insertHTML', false, text);
    }
  }, []);

  const execCommand = useCallback(
    (command: string, value?: string) => {
      document.execCommand(command, false, value);
      if (editorRef.current) {
        const content = editorRef.current.innerHTML;
        onChange(content);
      }
    },
    [onChange],
  );

  const handleFormat = useCallback(
    (command: string, value?: string) => {
      if (editorRef.current) {
        editorRef.current.focus();
        execCommand(command, value);
      }
    },
    [execCommand],
  );

  const insertLink = useCallback(() => {
    const url = prompt('Enter URL:');
    if (url) {
      handleFormat('createLink', url);
    }
  }, [handleFormat]);

  const insertImage = useCallback(() => {
    const url = prompt('Enter image URL:');
    if (url) {
      handleFormat('insertImage', url);
    }
  }, [handleFormat]);

  const insertHeading = useCallback(() => {
    handleFormat('formatBlock', '<H2>');
  }, [handleFormat]);

  const insertQuote = useCallback(() => {
    handleFormat('formatBlock', '<BLOCKQUOTE>');
  }, [handleFormat]);

  const handleContentChange = useCallback(() => {
    if (editorRef.current) {
      const content = editorRef.current.innerHTML;
      onChange(content);
    }
  }, [onChange]);

  const handleTextareaChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange(event.target.value);
    },
    [onChange],
  );

  const handleViewModeChange = useCallback(
    (_: React.MouseEvent<HTMLElement>, newMode: 'rich' | 'html' | null) => {
      if (newMode !== null) {
        setViewMode(newMode);
      }
    },
    [],
  );

  return (
    <Box sx={{ width: '100%' }}>
      <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
        {label}
      </Typography>

      {/* Toolbar */}
      <Paper
        elevation={0}
        sx={{
          p: 1,
          border: '1px solid #e0e0e0',
          borderBottom: 'none',
          borderRadius: '4px 4px 0 0',
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          flexWrap: 'wrap',
          backgroundColor: '#f8f9fa',
        }}
      >
        {/* View Mode Toggle */}
        <ToggleButtonGroup value={viewMode} exclusive onChange={handleViewModeChange} size="small">
          <ToggleButton value="rich">
            <Tooltip title="Rich Text">
              <ViewModule />
            </Tooltip>
          </ToggleButton>
          <ToggleButton value="html">
            <Tooltip title="HTML Source">
              <Html />
            </Tooltip>
          </ToggleButton>
        </ToggleButtonGroup>

        <Divider orientation="vertical" flexItem />

        {viewMode === 'rich' && (
          <>
            {/* Basic Formatting */}
            <Tooltip title="Bold">
              <IconButton size="small" onClick={() => handleFormat('bold')}>
                <FormatBold />
              </IconButton>
            </Tooltip>
            <Tooltip title="Italic">
              <IconButton size="small" onClick={() => handleFormat('italic')}>
                <FormatItalic />
              </IconButton>
            </Tooltip>
            <Tooltip title="Underline">
              <IconButton size="small" onClick={() => handleFormat('underline')}>
                <FormatUnderlined />
              </IconButton>
            </Tooltip>

            <Divider orientation="vertical" flexItem />

            {/* Heading and Quote */}
            <Tooltip title="Heading">
              <IconButton size="small" onClick={insertHeading}>
                <Title />
              </IconButton>
            </Tooltip>
            <Tooltip title="Quote">
              <IconButton size="small" onClick={insertQuote}>
                <FormatQuote />
              </IconButton>
            </Tooltip>

            <Divider orientation="vertical" flexItem />

            {/* Lists */}
            <Tooltip title="Bullet List">
              <IconButton size="small" onClick={() => handleFormat('insertUnorderedList')}>
                <FormatListBulleted />
              </IconButton>
            </Tooltip>
            <Tooltip title="Numbered List">
              <IconButton size="small" onClick={() => handleFormat('insertOrderedList')}>
                <FormatListNumbered />
              </IconButton>
            </Tooltip>

            <Divider orientation="vertical" flexItem />

            {/* Media */}
            <Tooltip title="Insert Link">
              <IconButton size="small" onClick={insertLink}>
                <Link />
              </IconButton>
            </Tooltip>
            <Tooltip title="Insert Image">
              <IconButton size="small" onClick={insertImage}>
                <Image />
              </IconButton>
            </Tooltip>
          </>
        )}
      </Paper>

      {/* Editor */}
      <Box sx={{ position: 'relative' }}>
        {viewMode === 'rich' ? (
          <Box
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={handleContentChange}
            onPaste={handlePaste}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            // content is managed via innerHTML in effect
            sx={{
              minHeight: height,
              maxHeight: '600px',
              overflow: 'auto',
              border: '1px solid #e0e0e0',
              borderRadius: '0 0 4px 4px',
              p: 2,
              backgroundColor: '#ffffff',
              fontFamily: '"Inter", "Roboto", sans-serif',
              fontSize: '14px',
              lineHeight: 1.6,
              '&:focus': {
                outline: '2px solid #1976d2',
                outlineOffset: '-2px',
              },
              '& h1, & h2, & h3, & h4, & h5, & h6': {
                margin: '16px 0 8px 0',
                fontWeight: 'bold',
              },
              '& h2': {
                fontSize: '1.5rem',
                color: '#333',
              },
              '& h3': {
                fontSize: '1.25rem',
                color: '#333',
              },
              '& p': {
                margin: '8px 0',
                lineHeight: 1.6,
              },
              '& blockquote': {
                borderLeft: '4px solid #ddd',
                paddingLeft: '16px',
                margin: '16px 0',
                fontStyle: 'italic',
                color: '#666',
              },
              '& ul, & ol': {
                paddingLeft: '24px',
                margin: '8px 0',
              },
              '& li': {
                margin: '4px 0',
              },
              '& a': {
                color: '#1976d2',
                textDecoration: 'underline',
              },
              '& img': {
                maxWidth: '100%',
                height: 'auto',
                borderRadius: '4px',
                margin: '8px 0',
              },
            }}
          ></Box>
        ) : (
          <TextField
            ref={textareaRef}
            multiline
            value={value}
            onChange={handleTextareaChange}
            placeholder={placeholder}
            sx={{
              width: '100%',
              '& .MuiInputBase-root': {
                borderRadius: '0 0 4px 4px',
                backgroundColor: '#ffffff',
              },
              '& .MuiInputBase-input': {
                minHeight: height + ' !important',
                maxHeight: '600px !important',
                overflow: 'auto !important',
                fontFamily: 'monospace',
                fontSize: '14px',
                lineHeight: 1.5,
              },
            }}
            InputProps={{
              sx: {
                border: '1px solid #e0e0e0',
                borderTop: 'none',
                '&:hover': {
                  borderColor: '#b0b0b0',
                },
                '&.Mui-focused': {
                  borderColor: '#1976d2',
                },
              },
            }}
          />
        )}
      </Box>

      {/* Helper Text */}
      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
        {viewMode === 'rich'
          ? 'Use the toolbar buttons to format your content. Switch to HTML mode to edit source code.'
          : 'Edit HTML source directly. Switch to Rich Text mode for visual editing.'}
      </Typography>
    </Box>
  );
};

export default HtmlEditor;
