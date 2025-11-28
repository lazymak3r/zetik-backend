import { Save } from '@mui/icons-material';
import {
  Box,
  Button,
  Card,
  CardContent,
  FormControlLabel,
  Grid,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import React from 'react';
import { SystemSettings } from '../../types/settings.types';

interface GeneralSettingsTabProps {
  settings: SystemSettings;
  onSettingChange: (key: keyof SystemSettings, value: any) => void;
  onVipRequirementChange: (level: string, value: number) => void;
  onSave: () => void;
}

const GeneralSettingsTab: React.FC<GeneralSettingsTabProps> = ({
  settings,
  onSettingChange,
  onVipRequirementChange,
  onSave,
}) => {
  return (
    <Grid container spacing={3}>
      <Grid size={{ xs: 12, md: 6 }}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              System Status
            </Typography>
            <Box sx={{ mt: 2 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.maintenanceMode}
                    onChange={(e) => onSettingChange('maintenanceMode', e.target.checked)}
                  />
                }
                label="Maintenance Mode"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.registrationEnabled}
                    onChange={(e) => onSettingChange('registrationEnabled', e.target.checked)}
                  />
                }
                label="Registration Enabled"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.withdrawalsEnabled}
                    onChange={(e) => onSettingChange('withdrawalsEnabled', e.target.checked)}
                  />
                }
                label="Withdrawals Enabled"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.depositsEnabled}
                    onChange={(e) => onSettingChange('depositsEnabled', e.target.checked)}
                  />
                }
                label="Deposits Enabled"
              />
            </Box>
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{ xs: 12, md: 6 }}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Withdrawal Settings
            </Typography>
            <Box sx={{ mt: 2 }}>
              <TextField
                fullWidth
                label="Minimum Withdrawal Amount"
                type="number"
                value={settings.minWithdrawAmount}
                onChange={(e) => onSettingChange('minWithdrawAmount', parseFloat(e.target.value))}
                sx={{ mb: 2 }}
              />
              <TextField
                fullWidth
                label="Maximum Withdrawal Amount"
                type="number"
                value={settings.maxWithdrawAmount}
                onChange={(e) => onSettingChange('maxWithdrawAmount', parseFloat(e.target.value))}
                sx={{ mb: 2 }}
              />
              <TextField
                fullWidth
                label="Withdrawal Fee %"
                type="number"
                value={settings.withdrawalFeePercent}
                onChange={(e) =>
                  onSettingChange('withdrawalFeePercent', parseFloat(e.target.value))
                }
              />
            </Box>
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{ xs: 12, md: 6 }}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Commission Settings
            </Typography>
            <Box sx={{ mt: 2 }}>
              <TextField
                fullWidth
                label="Affiliate Commission %"
                type="number"
                value={settings.affiliateCommissionPercent}
                onChange={(e) =>
                  onSettingChange('affiliateCommissionPercent', parseFloat(e.target.value))
                }
                sx={{ mb: 2 }}
              />
              <TextField
                fullWidth
                label="Rakeback %"
                type="number"
                value={settings.rakebackPercent}
                onChange={(e) => onSettingChange('rakebackPercent', parseFloat(e.target.value))}
              />
            </Box>
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{ xs: 12, md: 6 }}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              VIP Level Requirements
            </Typography>
            <Box sx={{ mt: 2 }}>
              {settings?.vipLevelRequirements &&
                Object.entries(settings.vipLevelRequirements).map(([level, requirement]) => (
                  <TextField
                    key={level}
                    fullWidth
                    label={`${level} (Wager Amount)`}
                    type="number"
                    value={requirement}
                    onChange={(e) => onVipRequirementChange(level, parseFloat(e.target.value))}
                    sx={{ mb: 2 }}
                  />
                ))}
            </Box>
          </CardContent>
        </Card>
      </Grid>

      <Grid size={12}>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button variant="contained" color="primary" startIcon={<Save />} onClick={onSave}>
            Save Settings
          </Button>
        </Box>
      </Grid>
    </Grid>
  );
};

export default GeneralSettingsTab;
