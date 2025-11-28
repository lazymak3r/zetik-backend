import {
  Autocomplete,
  Box,
  Checkbox,
  Chip,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import React from 'react';
import { IEligibilityRules } from '../../../../types/promocode.types';
import { getCountryFlag } from '../../../../utils';
import { COUNTRIES_LIST, KYC_LEVEL_OPTIONS } from '../constants';

export type ToggleKeys = {
  minRank: boolean;
  requireKyc: boolean;
  countryRestriction: boolean;
  referralCodes: boolean;
  accountCreatedBefore: boolean;
};

interface EligibilityRulesProps {
  eligibilityRules: IEligibilityRules;
  toggles: ToggleKeys;
  vipTiers: Array<{ level: number; name: string }>;
  onEligibilityChange: (field: keyof IEligibilityRules, value: any) => void;
  onToggleChange: (
    toggleName: keyof ToggleKeys,
  ) => (event: React.ChangeEvent<HTMLInputElement>) => void;
}

export const EligibilityRules: React.FC<EligibilityRulesProps> = ({
  eligibilityRules,
  toggles,
  vipTiers,
  onEligibilityChange,
  onToggleChange,
}) => {
  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Eligibility Rules
      </Typography>
      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle1" sx={{ mb: 1 }}>
          Per User Limit
        </Typography>
        <TextField
          fullWidth
          label="Claims per User"
          type="number"
          value={eligibilityRules.perUserLimit || 1}
          onChange={(e) => onEligibilityChange('perUserLimit', parseInt(e.target.value) || 1)}
          helperText="Maximum number of claims per user (always enabled)"
          inputProps={{ min: 1, max: 100 }}
        />
      </Box>

      <Box sx={{ mb: 2 }}>
        <FormControlLabel
          control={<Switch checked={toggles.minRank} onChange={onToggleChange('minRank')} />}
          label="Minimum VIP Rank"
        />
        {toggles.minRank && (
          <Box sx={{ mt: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Minimum Rank</InputLabel>
              <Select
                value={eligibilityRules.minRank || ''}
                onChange={(e) => onEligibilityChange('minRank', e.target.value)}
                label="Minimum Rank"
              >
                <MenuItem value={0}>Unranked (0)</MenuItem>
                {vipTiers.map((tier) => (
                  <MenuItem key={tier.level} value={tier.level}>
                    {tier.level} - {tier.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        )}
      </Box>

      <Box sx={{ mb: 2 }}>
        <FormControlLabel
          control={<Switch checked={toggles.requireKyc} onChange={onToggleChange('requireKyc')} />}
          label="KYC Requirements"
        />
        {toggles.requireKyc && (
          <Box sx={{ mt: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Minimum KYC Level</InputLabel>
              <Select
                value={eligibilityRules.minKycLevel || 'any'}
                onChange={(e) => {
                  const value = e.target.value;
                  onEligibilityChange('minKycLevel', value);
                  onEligibilityChange('requireKyc', true);
                }}
                label="Minimum KYC Level"
              >
                {KYC_LEVEL_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        )}
      </Box>

      <Box sx={{ mb: 2 }}>
        <FormControlLabel
          control={
            <Switch
              checked={toggles.countryRestriction}
              onChange={onToggleChange('countryRestriction')}
            />
          }
          label="Country Restrictions"
        />
        {toggles.countryRestriction && (
          <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Autocomplete
              multiple
              options={COUNTRIES_LIST}
              getOptionLabel={(option) =>
                `${getCountryFlag(option.code)} ${option.code} - ${option.name}`
              }
              value={COUNTRIES_LIST.filter((country) =>
                eligibilityRules.allowedCountries?.includes(country.code),
              )}
              onChange={(_, newValue) => {
                const codes = newValue.map((c) => c.code);
                onEligibilityChange('allowedCountries', codes.length > 0 ? codes : undefined);

                if (eligibilityRules.excludedCountries) {
                  const updatedExcluded = eligibilityRules.excludedCountries.filter(
                    (code) => !codes.includes(code as any),
                  );
                  onEligibilityChange(
                    'excludedCountries',
                    updatedExcluded.length > 0 ? updatedExcluded : undefined,
                  );
                }
              }}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => (
                  <Chip
                    variant="outlined"
                    label={`${getCountryFlag(option.code)} ${option.code}`}
                    {...getTagProps({ index })}
                    key={option.code}
                  />
                ))
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Allowed Countries"
                  placeholder="Choose allowed countries..."
                />
              )}
            />

            <Autocomplete
              multiple
              options={COUNTRIES_LIST}
              getOptionLabel={(option) =>
                `${getCountryFlag(option.code)} ${option.code} - ${option.name}`
              }
              value={COUNTRIES_LIST.filter((country) =>
                eligibilityRules.excludedCountries?.includes(country.code),
              )}
              onChange={(_, newValue) => {
                const codes = newValue.map((c) => c.code);
                onEligibilityChange('excludedCountries', codes.length > 0 ? codes : undefined);

                if (eligibilityRules.allowedCountries) {
                  const updatedAllowed = eligibilityRules.allowedCountries.filter(
                    (code) => !codes.includes(code as any),
                  );
                  onEligibilityChange(
                    'allowedCountries',
                    updatedAllowed.length > 0 ? updatedAllowed : undefined,
                  );
                }
              }}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => (
                  <Chip
                    variant="outlined"
                    label={`${getCountryFlag(option.code)} ${option.code}`}
                    {...getTagProps({ index })}
                    key={option.code}
                  />
                ))
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Excluded Countries"
                  placeholder="Choose excluded countries..."
                />
              )}
            />
          </Box>
        )}
      </Box>

      <Box sx={{ mb: 2 }}>
        <FormControlLabel
          control={
            <Switch checked={toggles.referralCodes} onChange={onToggleChange('referralCodes')} />
          }
          label="Referral Codes"
        />
        {toggles.referralCodes && (
          <Box sx={{ mt: 2 }}>
            <TextField
              fullWidth
              label="Referral Codes"
              value={eligibilityRules.referralCodes?.join(', ') || ''}
              onChange={(e) => {
                const codes = e.target.value
                  .split(',')
                  .map((code) => code.trim())
                  .filter(Boolean);
                onEligibilityChange('referralCodes', codes.length > 0 ? codes : undefined);
              }}
              helperText="Enter referral codes separated by commas (e.g., FACEBOOK, TWITTER)"
              placeholder="FACEBOOK, TWITTER, GOOGLE"
            />
          </Box>
        )}
      </Box>
      <Box sx={{ mb: 2 }}>
        <FormControlLabel
          control={
            <Switch
              checked={toggles.accountCreatedBefore}
              onChange={onToggleChange('accountCreatedBefore')}
            />
          }
          label="Account Age Restriction"
        />
        {toggles.accountCreatedBefore && (
          <Box sx={{ mt: 2 }}>
            <TextField
              fullWidth
              label="Account Created Before"
              type="date"
              value={
                eligibilityRules.accountCreatedBefore
                  ? new Date(eligibilityRules.accountCreatedBefore).toISOString().slice(0, 10)
                  : ''
              }
              onChange={(e) => onEligibilityChange('accountCreatedBefore', e.target.value)}
              InputLabelProps={{ shrink: true }}
              helperText="Only accounts created before this date will be eligible"
            />
          </Box>
        )}
      </Box>

      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle1" sx={{ mb: 2 }}>
          Anti-fraud Protection
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <FormControlLabel
            control={
              <Checkbox
                checked={eligibilityRules.onePerDevice || false}
                onChange={(e) => onEligibilityChange('onePerDevice', e.target.checked)}
              />
            }
            label="One claim per device"
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={eligibilityRules.onePerIp || false}
                onChange={(e) => onEligibilityChange('onePerIp', e.target.checked)}
              />
            }
            label="One claim per IP address"
          />
        </Box>
      </Box>
    </Box>
  );
};
