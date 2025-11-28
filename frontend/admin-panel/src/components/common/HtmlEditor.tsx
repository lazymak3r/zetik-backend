import {
  FormatBold,
  FormatItalic,
  FormatListBulleted,
  FormatListNumbered,
  FormatUnderlined,
  Link,
} from '@mui/icons-material';
import { Box, FormControl, FormLabel, IconButton, Paper, Toolbar, Typography } from '@mui/material';
import React, { useCallback, useRef } from 'react';

interface HtmlEditorProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  error?: boolean;
  helperText?: string;
}

const HtmlEditor: React.FC<HtmlEditorProps> = ({
  value,
  onChange,
  label,
  error = false,
  helperText,
}) => {
  const editorRef = useRef<HTMLDivElement>(null);

  // Initialize content once
  React.useEffect(() => {
    if (editorRef.current && !editorRef.current.innerHTML) {
      editorRef.current.innerHTML = value || '';
    }
  }, [value]);

  const executeCommand = useCallback(
    (command: string, value?: string) => {
      document.execCommand(command, false, value);
      if (editorRef.current) {
        onChange(editorRef.current.innerHTML);
      }
    },
    [onChange],
  );

  const handleInput = useCallback(() => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  }, [onChange]);

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      e.preventDefault();
      const text = e.clipboardData.getData('text/plain');

      // Check if pasted content looks like HTML
      if (text.includes('<') && text.includes('>')) {
        // Insert as HTML instead of plain text
        document.execCommand('insertHTML', false, text);
      } else {
        // Insert as plain text
        document.execCommand('insertText', false, text);
      }
      handleInput();
    },
    [handleInput],
  );

  React.useEffect(() => {
    if (editorRef.current) {
      const currentContent = editorRef.current.innerHTML;
      if (currentContent !== value) {
        // Only update if content is truly different and not during user typing
        const isUserTyping = document.activeElement === editorRef.current;
        if (!isUserTyping) {
          editorRef.current.innerHTML = value || '';
        }
      }
    }
  }, [value]);

  return (
    <FormControl
      fullWidth
      error={error}
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'visible', // Ensure content is not clipped
      }}
    >
      {label && (
        <FormLabel
          component="legend"
          sx={{
            flexShrink: 0,
            mb: 1,
            lineHeight: 1.6,
            fontSize: { xs: '1rem', sm: '0.9rem' },
            fontWeight: 600,
            minHeight: { xs: '32px', sm: '28px' },
            height: 'auto',
            display: 'block',
            overflow: 'visible',
            whiteSpace: 'normal',
            textOverflow: 'clip',
            py: 0.5,
          }}
        >
          {label}
        </FormLabel>
      )}
      <Paper
        variant="outlined"
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          mt: 0, // Remove extra top margin
          minHeight: 0, // Important for proper flex
        }}
      >
        <Toolbar
          variant="dense"
          sx={{ minHeight: 48, borderBottom: 1, borderColor: 'divider', flexShrink: 0 }}
        >
          <IconButton size="small" onClick={() => executeCommand('bold')} title="Bold">
            <FormatBold />
          </IconButton>
          <IconButton size="small" onClick={() => executeCommand('italic')} title="Italic">
            <FormatItalic />
          </IconButton>
          <IconButton size="small" onClick={() => executeCommand('underline')} title="Underline">
            <FormatUnderlined />
          </IconButton>
          <Box sx={{ width: 8 }} />
          <IconButton
            size="small"
            onClick={() => executeCommand('insertUnorderedList')}
            title="Bullet List"
          >
            <FormatListBulleted />
          </IconButton>
          <IconButton
            size="small"
            onClick={() => executeCommand('insertOrderedList')}
            title="Numbered List"
          >
            <FormatListNumbered />
          </IconButton>
          <IconButton
            size="small"
            onClick={() => {
              const url = window.prompt('Enter URL:');
              if (url) executeCommand('createLink', url);
            }}
            title="Insert Link"
          >
            <Link />
          </IconButton>
          <Box sx={{ width: 8, borderLeft: 1, borderColor: 'divider', mx: 1 }} />
          <IconButton
            size="small"
            onClick={() => {
              const html = window.prompt('Enter HTML code:');
              if (html && editorRef.current) {
                // Insert HTML directly without escaping
                editorRef.current.innerHTML = html;
                onChange(html);
              }
            }}
            title="Insert Raw HTML"
          >
            <Typography variant="body2" sx={{ fontSize: '0.7rem', fontWeight: 'bold' }}>
              HTML
            </Typography>
          </IconButton>
        </Toolbar>
        <Box
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          onPaste={handlePaste}
          sx={{
            flex: 1,
            minHeight: 200,
            p: 2,
            outline: 'none',
            overflowY: 'auto',
            '&:focus': {
              backgroundColor: 'rgba(0, 0, 0, 0.02)',
            },
            '& h1, & h2, & h3, & h4, & h5, & h6': {
              margin: '0.5em 0',
            },
            '& p': {
              margin: '0.5em 0',
            },
            '& ul, & ol': {
              marginLeft: '1.5em',
            },
          }}
        />
      </Paper>
      {helperText && (
        <Typography
          variant="caption"
          color={error ? 'error' : 'textSecondary'}
          sx={{
            mt: 0.5,
            flexShrink: 0,
            lineHeight: 1.3,
            fontSize: '0.75rem',
          }}
        >
          {helperText}
        </Typography>
      )}
    </FormControl>
  );
};

export default HtmlEditor;
