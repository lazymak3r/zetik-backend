import {
  Alert,
  Box,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  SelectChangeEvent,
  TextField,
  Typography,
} from '@mui/material';
import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../../../../store';
import { fetchAssets } from '../../../../store/payments';
import { ICreatePromocode } from '../../../../types/promocode.types';

interface PromocodeFormProps {
  formData: ICreatePromocode;
  errors: Record<string, string>;
  onInputChange: (
    field: keyof ICreatePromocode,
  ) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | SelectChangeEvent<string>,
  ) => void;
}

export const PromocodeForm: React.FC<PromocodeFormProps> = ({
  formData,
  errors,
  onInputChange,
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const { assets } = useSelector((state: RootState) => state.payments);

  const totalValue = formData.valuePerClaim * formData.totalClaims;

  useEffect(() => {
    void dispatch(fetchAssets());
  }, [dispatch]);

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Basic Information
      </Typography>

      <TextField
        fullWidth
        margin="normal"
        label="Promocode"
        value={formData.code}
        onChange={onInputChange('code')}
        error={!!errors.code}
        helperText={errors.code}
        placeholder="Enter promocode"
      />

      <Grid container spacing={2} sx={{ mt: 1 }}>
        <Grid size={{ xs: 6 }}>
          <TextField
            fullWidth
            label="Value per Claim"
            type="number"
            value={formData.valuePerClaim ?? ''}
            onChange={onInputChange('valuePerClaim')}
            error={!!errors.valuePerClaim}
            helperText={errors.valuePerClaim}
            inputProps={{
              step: '0.00000001',
            }}
          />
        </Grid>
        <Grid size={{ xs: 6 }}>
          <TextField
            fullWidth
            label="Total Claims"
            type="number"
            value={formData.totalClaims ?? ''}
            onChange={onInputChange('totalClaims')}
            error={!!errors.totalClaims}
            helperText={errors.totalClaims}
            inputProps={{ min: 1 }}
          />
        </Grid>
      </Grid>

      <FormControl fullWidth margin="normal">
        <InputLabel>Asset</InputLabel>
        <Select value={formData.asset} onChange={onInputChange('asset')} label="Asset">
          {assets
            .filter((asset) => asset.status === 'ACTIVE')
            .map((asset) => (
              <MenuItem key={asset.symbol} value={asset.symbol}>
                {asset.symbol}
              </MenuItem>
            ))}
        </Select>
      </FormControl>

      <Grid container spacing={2} sx={{ mt: 1 }}>
        <Grid size={{ xs: 6 }}>
          <TextField
            fullWidth
            label="Start Date"
            type="date"
            value={formData.startsAt ? new Date(formData.startsAt).toISOString().slice(0, 10) : ''}
            onChange={onInputChange('startsAt')}
            error={!!errors.startsAt}
            helperText={errors.startsAt}
            InputLabelProps={{ shrink: true }}
          />
        </Grid>
        <Grid size={{ xs: 6 }}>
          <TextField
            fullWidth
            label="End Date"
            type="date"
            value={formData.endsAt ? new Date(formData.endsAt).toISOString().slice(0, 10) : ''}
            onChange={onInputChange('endsAt')}
            error={!!errors.endsAt}
            helperText={errors.endsAt}
            InputLabelProps={{ shrink: true }}
          />
        </Grid>
      </Grid>

      <TextField
        fullWidth
        margin="normal"
        label="Internal Note"
        multiline
        rows={3}
        value={formData.note}
        onChange={onInputChange('note')}
        helperText="Optional note for other admins"
      />

      {totalValue > 0 && (
        <Alert severity="info" sx={{ mt: 2 }}>
          <Typography variant="body2">
            <strong>Total Value:</strong> {totalValue.toLocaleString()} {formData.asset}
            <br />
            <strong>Note:</strong> This amount will be deducted from your admin balance
          </Typography>
        </Alert>
      )}
    </Box>
  );
};
