import { Check as CheckIcon, Close as CloseIcon } from '@mui/icons-material';
import { Box, IconButton, InputAdornment, TextField, Typography } from '@mui/material';
import { memo, useCallback, useState } from 'react';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '../../store';
import { fetchPromocodes, updatePromocode } from '../../store/promocodes/thunks';
import { IPromocodeAdminResponse } from '../../types/promocode.types';

type NoteCellProps = {
  promocodeId: IPromocodeAdminResponse['id'];
  note: IPromocodeAdminResponse['note'];
};

const NoteCellComponent = ({ promocodeId, note }: NoteCellProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editingNotesValue, setEditingNotesValue] = useState<string>('');

  const dispatch = useDispatch<AppDispatch>();

  const handleStartEditNotes = useCallback(() => {
    setIsEditing(true);
    setEditingNotesValue(note || '');
  }, []);

  const handleCancelEditNotes = useCallback(() => {
    setIsEditing(false);
    setEditingNotesValue('');
  }, []);

  const handleSaveNotes = useCallback(async () => {
    await dispatch(
      updatePromocode({
        id: promocodeId,
        dto: { note: editingNotesValue.trim() || undefined },
      }),
    );

    setIsEditing(false);
    setEditingNotesValue('');

    dispatch(fetchPromocodes({}));
  }, [dispatch, editingNotesValue]);

  if (isEditing) {
    return (
      <TextField
        fullWidth
        multiline
        rows={2}
        value={editingNotesValue}
        onChange={(e) => setEditingNotesValue(e.target.value)}
        variant="outlined"
        size="small"
        placeholder="Enter notes..."
        InputProps={{
          endAdornment: (
            <InputAdornment position="end">
              <IconButton size="small" onClick={handleSaveNotes} title="Save" color="primary">
                <CheckIcon />
              </IconButton>
              <IconButton size="small" onClick={handleCancelEditNotes} title="Cancel">
                <CloseIcon />
              </IconButton>
            </InputAdornment>
          ),
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && e.ctrlKey) {
            handleSaveNotes();
          } else if (e.key === 'Escape') {
            handleCancelEditNotes();
          }
        }}
        autoFocus
      />
    );
  }

  return (
    <Box
      onDoubleClick={handleStartEditNotes}
      sx={{
        cursor: 'pointer',
        minHeight: '40px',
        display: 'flex',
        alignItems: 'center',
        padding: '8px',
        borderRadius: '4px',
        '&:hover': {
          backgroundColor: 'action.hover',
        },
      }}
      title="Double-click to edit notes"
    >
      <Typography
        variant="body2"
        sx={{
          color: note ? 'text.primary' : 'text.secondary',
          fontStyle: note ? 'normal' : 'italic',
        }}
      >
        {note || 'No notes - double-click to add'}
      </Typography>
    </Box>
  );
};

export const NoteCell = memo(NoteCellComponent);
