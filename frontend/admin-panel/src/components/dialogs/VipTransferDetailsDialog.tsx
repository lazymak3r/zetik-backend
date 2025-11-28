import CancelIcon from '@mui/icons-material/Cancel';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../../store';
import { VipTransferSubmission, updateNote, updateTag } from '../../store/slices/vipTransfersSlice';

interface VipTransferDetailsDialogProps {
  open: boolean;
  submission: VipTransferSubmission | null;
  onClose: () => void;
  onUpdate: () => void;
}

const VipTransferDetailsDialog: React.FC<VipTransferDetailsDialogProps> = ({
  open,
  submission,
  onClose,
  onUpdate,
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const { vipTiers } = useSelector((state: RootState) => state.bonus);

  const [selectedTag, setSelectedTag] = useState('');
  const [selectedVipLevel, setSelectedVipLevel] = useState<number | ''>('');
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [noteText, setNoteText] = useState('');

  useEffect(() => {
    if (submission) {
      setSelectedTag(submission.tag || '');
      setSelectedVipLevel('');
      setNoteText(submission.customNote || '');
      setIsEditingNote(false);
    }
  }, [submission]);

  const handleUpdateTag = async () => {
    if (submission && selectedTag) {
      await dispatch(
        updateTag({
          id: submission.id,
          tag: selectedTag,
          vipLevel:
            selectedTag === 'Approved' && selectedVipLevel !== ''
              ? Number(selectedVipLevel)
              : undefined,
        }),
      );
      setSelectedTag('');
      setSelectedVipLevel('');
      onClose();
      onUpdate();
    }
  };

  const handleSaveNote = async () => {
    if (submission) {
      await dispatch(
        updateNote({
          id: submission.id,
          customNote: noteText.trim() || undefined,
        }),
      );
      setIsEditingNote(false);
      onUpdate();
    }
  };

  const handleCancelNote = () => {
    setNoteText(submission?.customNote || '');
    setIsEditingNote(false);
  };

  if (!submission) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>VIP Transfer Submission Details</DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Submission ID: {submission.id}
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            User: {submission.user?.username || 'N/A'} ({submission.user?.email || 'N/A'})
          </Typography>
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2">
              <strong>Name:</strong> {submission.name}
            </Typography>
            <Typography variant="body2">
              <strong>Country:</strong> {submission.country}
            </Typography>
            <Typography variant="body2">
              <strong>Contact Method:</strong> {submission.contactMethod}
            </Typography>
            <Typography variant="body2">
              <strong>Contact Username:</strong> {submission.contactUsername}
            </Typography>
            <Typography variant="body2">
              <strong>Casino:</strong> {submission.casino}
            </Typography>
            <Typography variant="body2">
              <strong>Casino Username:</strong> {submission.casinoUsername}
            </Typography>
            <Typography variant="body2">
              <strong>Total Wager:</strong> ${parseFloat(submission.totalWager).toLocaleString()}
            </Typography>
            <Typography variant="body2">
              <strong>Rank:</strong> {submission.rank}
            </Typography>
            {submission.howDidYouHear && (
              <Typography variant="body2">
                <strong>How did you hear about us:</strong> {submission.howDidYouHear}
              </Typography>
            )}
            <Box sx={{ mt: 2, mb: 2 }}>
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Tag</InputLabel>
                <Select
                  value={selectedTag}
                  onChange={(e) => setSelectedTag(e.target.value)}
                  label="Tag"
                >
                  <MenuItem value="New">New</MenuItem>
                  <MenuItem value="Pending">Pending</MenuItem>
                  <MenuItem value="Approved">Approved</MenuItem>
                  <MenuItem value="Rejected">Rejected</MenuItem>
                </Select>
              </FormControl>
              {selectedTag === 'Approved' && (
                <FormControl fullWidth>
                  <InputLabel>VIP Level</InputLabel>
                  <Select
                    value={selectedVipLevel}
                    onChange={(e) => setSelectedVipLevel(e.target.value as number | '')}
                    label="VIP Level"
                  >
                    {vipTiers.map((tier: any) => (
                      <MenuItem key={tier.level} value={tier.level}>
                        {tier.level} - {tier.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            </Box>
            <Box sx={{ mt: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Typography variant="subtitle2">
                  <strong>Custom Note:</strong>
                </Typography>
                {!isEditingNote && (
                  <IconButton
                    size="small"
                    onClick={() => setIsEditingNote(true)}
                    sx={{ ml: 1 }}
                    aria-label="edit note"
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                )}
              </Box>
              {isEditingNote ? (
                <Box>
                  <TextField
                    fullWidth
                    multiline
                    rows={4}
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="Add a note..."
                    variant="outlined"
                    inputProps={{ maxLength: 1000 }}
                    helperText={`${noteText.length}/1000 characters`}
                  />
                  <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                    <Button
                      size="small"
                      variant="contained"
                      startIcon={<SaveIcon />}
                      onClick={() => void handleSaveNote()}
                    >
                      Save
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<CancelIcon />}
                      onClick={handleCancelNote}
                    >
                      Cancel
                    </Button>
                  </Box>
                </Box>
              ) : (
                <Box>
                  {submission.customNote ? (
                    <>
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mb: 0.5 }}>
                        {submission.customNote}
                      </Typography>
                      {submission.taggedByAdmin && submission.taggedAt && (
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ display: 'block' }}
                        >
                          added by <strong>{submission.taggedByAdmin.name}</strong> on{' '}
                          {new Date(submission.taggedAt).toLocaleString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </Typography>
                      )}
                    </>
                  ) : (
                    <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                      No note added yet
                    </Typography>
                  )}
                </Box>
              )}
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              <strong>Submitted:</strong>{' '}
              {new Date(submission.createdAt).toLocaleString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Typography>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        <Button
          onClick={() => void handleUpdateTag()}
          variant="contained"
          disabled={!selectedTag || (selectedTag === 'Approved' && selectedVipLevel === '')}
        >
          Update
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default VipTransferDetailsDialog;
