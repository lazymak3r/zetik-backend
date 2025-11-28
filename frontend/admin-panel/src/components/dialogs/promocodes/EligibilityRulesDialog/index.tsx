import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Typography,
} from '@mui/material';
import React from 'react';
import { IEligibilityRules } from '../../../../types/promocode.types';
import { getCountryFlag } from '../../../../utils';
import { COUNTRIES_LIST, KYC_LEVEL_OPTIONS } from '../constants';

interface EligibilityRulesDialogProps {
  open: boolean;
  onClose: () => void;
  eligibilityRules: IEligibilityRules;
  promocodeCode: string;
}

const EligibilityRulesDialogComponent: React.FC<EligibilityRulesDialogProps> = ({
  open,
  onClose,
  eligibilityRules,
  promocodeCode,
}) => {
  const getCountryName = (code: string) => {
    const country = COUNTRIES_LIST.find((c) => c.code === code);
    return country ? `${getCountryFlag(code)} ${country.name}` : code;
  };

  const getKycLevelName = (level: string) => {
    const option = KYC_LEVEL_OPTIONS.find((opt) => opt.value === level);
    return option ? option.label : level;
  };

  const hasAnyRules = () => {
    return (
      eligibilityRules.minRank !== undefined ||
      eligibilityRules.requireKyc ||
      eligibilityRules.minKycLevel ||
      eligibilityRules.allowedCountries?.length ||
      eligibilityRules.excludedCountries?.length ||
      eligibilityRules.referralCodes?.length ||
      eligibilityRules.perUserLimit !== undefined ||
      eligibilityRules.onePerDevice ||
      eligibilityRules.onePerIp ||
      true // perUserLimit is always enabled
    );
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Eligibility Rules - {promocodeCode}</DialogTitle>
      <DialogContent>
        {!hasAnyRules() ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="body1" color="text.secondary">
              No eligibility rules configured for this promocode.
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              This promocode can be claimed by any user.
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {eligibilityRules.minRank !== undefined && (
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
                  Minimum VIP Rank
                </Typography>
                <Typography variant="body1">Rank {eligibilityRules.minRank}</Typography>
              </Box>
            )}

            {(eligibilityRules.requireKyc || eligibilityRules.minKycLevel) && (
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
                  KYC Requirements
                </Typography>
                <Typography variant="body1">
                  {getKycLevelName(eligibilityRules.minKycLevel || 'any')}
                </Typography>
              </Box>
            )}

            {(eligibilityRules.allowedCountries?.length ||
              eligibilityRules.excludedCountries?.length) && (
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
                  Country Restrictions
                </Typography>
                {eligibilityRules.allowedCountries?.length && (
                  <Box sx={{ mb: 1 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      Allowed Countries:
                    </Typography>
                    <Typography variant="body1">
                      {eligibilityRules.allowedCountries
                        .map((code) => getCountryName(code))
                        .join(', ')}
                    </Typography>
                  </Box>
                )}
                {eligibilityRules.excludedCountries?.length && (
                  <Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      Excluded Countries:
                    </Typography>
                    <Typography variant="body1">
                      {eligibilityRules.excludedCountries
                        .map((code) => getCountryName(code))
                        .join(', ')}
                    </Typography>
                  </Box>
                )}
              </Box>
            )}

            {eligibilityRules.referralCodes?.length && (
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
                  Referral Codes
                </Typography>
                <Typography variant="body1">{eligibilityRules.referralCodes.join(', ')}</Typography>
              </Box>
            )}

            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
                Per User Limit
              </Typography>
              <Typography variant="body1">
                {eligibilityRules.perUserLimit || 1} claim
                {(eligibilityRules.perUserLimit || 1) > 1 ? 's' : ''} per user
              </Typography>
            </Box>

            {eligibilityRules.accountCreatedBefore && (
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
                  Account Age Restriction
                </Typography>
                <Typography variant="body1">
                  Account created before{' '}
                  {new Date(eligibilityRules.accountCreatedBefore).toLocaleDateString()}
                </Typography>
              </Box>
            )}

            {(eligibilityRules.onePerDevice || eligibilityRules.onePerIp) && (
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
                  Anti-fraud Protection
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {eligibilityRules.onePerDevice && (
                    <FormControlLabel
                      control={<Checkbox checked={true} disabled />}
                      label="One claim per device"
                    />
                  )}
                  {eligibilityRules.onePerIp && (
                    <FormControlLabel
                      control={<Checkbox checked={true} disabled />}
                      label="One claim per IP address"
                    />
                  )}
                </Box>
              </Box>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="outlined">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export const EligibilityRulesDialog = React.memo(EligibilityRulesDialogComponent);
