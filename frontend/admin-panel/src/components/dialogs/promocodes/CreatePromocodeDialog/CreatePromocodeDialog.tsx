import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  SelectChangeEvent,
} from '@mui/material';
import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../../../../store';
import { clearError } from '../../../../store/promocodes/slice';
import { createPromocode } from '../../../../store/promocodes/thunks';
import { fetchVipTiers } from '../../../../store/slices/bonusSlice';
import { ICreatePromocode, IEligibilityRules } from '../../../../types/promocode.types';
import { EligibilityRules, ToggleKeys } from './EligibilityRules';
import { PromocodeForm } from './PromocodeForm';

interface CreatePromocodeDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const CreatePromocodeDialogComponent: React.FC<CreatePromocodeDialogProps> = ({
  open,
  onClose,
  onSuccess,
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const { loading, error } = useSelector((state: RootState) => state.promocodes);
  const { vipTiers } = useSelector((state: RootState) => state.bonus);

  const [formData, setFormData] = useState<ICreatePromocode>({
    code: '',
    valuePerClaim: 0,
    totalClaims: 1,
    asset: 'BTC',
    startsAt: '',
    endsAt: '',
    note: '',
    eligibilityRules: {
      perUserLimit: 1,
    },
  });

  const [toggles, setToggles] = useState<ToggleKeys>({
    minRank: false,
    requireKyc: false,
    countryRestriction: false,
    referralCodes: false,
    accountCreatedBefore: false,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      void dispatch(fetchVipTiers());
    }
  }, [dispatch, open]);

  useEffect(() => {
    if (!open) {
      setFormData({
        code: '',
        valuePerClaim: 0,
        totalClaims: 1,
        asset: 'BTC',
        startsAt: '',
        endsAt: '',
        note: '',
        eligibilityRules: {
          perUserLimit: 1,
        },
      });
      setToggles({
        minRank: false,
        requireKyc: false,
        countryRestriction: false,
        referralCodes: false,
        accountCreatedBefore: false,
      });
      setErrors({});
      dispatch(clearError());
    }
  }, [open, dispatch]);

  const handleInputChange =
    (field: keyof ICreatePromocode) =>
    (
      event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | SelectChangeEvent<string>,
    ) => {
      let value: string | number = event.target.value;

      if (field === 'valuePerClaim' || field === 'totalClaims') {
        value = value === '' ? 0 : Number(value);
      }

      if (field === 'startsAt' || field === 'endsAt') {
        if (value) {
          const date = new Date(value);
          if (field === 'startsAt') {
            date.setHours(0, 0, 0, 0);
          } else {
            date.setHours(23, 59, 59, 999);
          }
          value = date.toISOString();
        }
      }

      setFormData((prev) => ({ ...prev, [field]: value }));

      if (errors[field]) {
        setErrors((prev) => ({ ...prev, [field]: '' }));
      }
    };

  const handleEligibilityChange = (field: keyof IEligibilityRules, value: any) => {
    if (field === 'accountCreatedBefore' && value) {
      const date = new Date(value);
      date.setHours(23, 59, 59, 999);
      value = date.toISOString();
    }

    setFormData((prev) => ({
      ...prev,
      eligibilityRules: {
        ...prev.eligibilityRules,
        [field]: value,
      },
    }));
  };

  const handleToggleChange =
    (toggleName: keyof ToggleKeys) => (event: React.ChangeEvent<HTMLInputElement>) => {
      const isEnabled = event.target.checked;
      setToggles((prev) => ({ ...prev, [toggleName]: isEnabled }));

      if (!isEnabled) {
        const fieldMap: Record<keyof ToggleKeys, keyof IEligibilityRules | null> = {
          minRank: 'minRank',
          requireKyc: 'requireKyc',
          countryRestriction: null,
          referralCodes: 'referralCodes',
          accountCreatedBefore: 'accountCreatedBefore',
        };

        const field = fieldMap[toggleName];
        if (field) {
          handleEligibilityChange(field, undefined);
        } else if (toggleName === 'countryRestriction') {
          handleEligibilityChange('allowedCountries', undefined);
          handleEligibilityChange('excludedCountries', undefined);
        }
      }
    };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.code.trim()) {
      newErrors.code = 'Promocode is required';
    }

    if (formData.valuePerClaim <= 0) {
      newErrors.valuePerClaim = 'Value per claim must be greater than 0';
    }

    if (formData.totalClaims <= 0) {
      newErrors.totalClaims = 'Total claims must be greater than 0';
    }

    if (!formData.startsAt) {
      newErrors.startsAt = 'Start date is required';
    }
    if (!formData.endsAt) {
      newErrors.endsAt = 'End date is required';
    }
    if (formData.startsAt && formData.endsAt && formData.startsAt >= formData.endsAt) {
      newErrors.endsAt = 'End date must be after start date';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      await dispatch(createPromocode(formData)).unwrap();

      onSuccess();
      onClose();
    } catch {
      // Handled in the Redux
    }
  };

  const handleClose = () => {
    if (!loading) {
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="lg" fullWidth>
      <DialogTitle>Create Promocode</DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 2 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => dispatch(clearError())}>
              {error}
            </Alert>
          )}

          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 6 }}>
              <PromocodeForm
                formData={formData}
                errors={errors}
                onInputChange={handleInputChange}
              />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <EligibilityRules
                eligibilityRules={formData.eligibilityRules}
                toggles={toggles}
                vipTiers={vipTiers}
                onEligibilityChange={handleEligibilityChange}
                onToggleChange={handleToggleChange}
              />
            </Grid>
          </Grid>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button onClick={() => void handleSubmit()} variant="contained" disabled={loading}>
          {loading ? 'Creating...' : 'Create Promocode'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export const CreatePromocodeDialog = React.memo(CreatePromocodeDialogComponent);
