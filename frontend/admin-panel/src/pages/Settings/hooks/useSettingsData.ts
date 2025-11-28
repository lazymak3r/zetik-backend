import { useEffect, useState } from 'react';
import { api } from '../../../config/api';
import { SystemSettings } from '../types/settings.types';

const defaultSettings: SystemSettings = {
  maintenanceMode: false,
  registrationEnabled: true,
  withdrawalsEnabled: true,
  depositsEnabled: true,
  minWithdrawAmount: 0,
  maxWithdrawAmount: 0,
  withdrawalFeePercent: 0,
  affiliateCommissionPercent: 0,
  rakebackPercent: 0,
  vipLevelRequirements: {
    'VIP 1': 0,
    'VIP 2': 1000,
    'VIP 3': 5000,
    'VIP 4': 10000,
    'VIP 5': 50000,
  },
};

export const useSettingsData = () => {
  const [settings, setSettings] = useState<SystemSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saveMessage, setSaveMessage] = useState('');

  useEffect(() => {
    void fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await api.get('/settings/general');
      setSettings(response.data);
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSettingChange = (key: keyof SystemSettings, value: any) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleVipRequirementChange = (level: string, value: number) => {
    setSettings((prev) => ({
      ...prev,
      vipLevelRequirements: {
        ...prev.vipLevelRequirements,
        [level]: value,
      },
    }));
  };

  const saveSettings = async () => {
    try {
      await api.put('/settings', settings);
      setSaveMessage('Settings saved successfully');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (error) {
      console.error('Failed to save settings:', error);
      setSaveMessage('Failed to save settings');
      setTimeout(() => setSaveMessage(''), 3000);
    }
  };

  return {
    settings,
    loading,
    saveMessage,
    fetchSettings,
    handleSettingChange,
    handleVipRequirementChange,
    saveSettings,
  };
};
