import { useState } from 'react';
import { api } from '../../../config/api';
import { ApiKey } from '../types/settings.types';

export const useApiKeys = () => {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [apiKeyDialogOpen, setApiKeyDialogOpen] = useState(false);
  const [selectedApiKey, setSelectedApiKey] = useState<ApiKey | null>(null);
  const [generatedApiKey, setGeneratedApiKey] = useState<string | null>(null);
  const [apiKeyForm, setApiKeyForm] = useState({
    name: '',
    permissions: [] as string[],
  });

  const fetchApiKeys = async () => {
    try {
      const response = await api.get('/settings/api-keys');
      setApiKeys(response.data);
    } catch (error) {
      console.error('Failed to fetch API keys:', error);
    }
  };

  const handleEditApiKey = (apiKey: ApiKey) => {
    setSelectedApiKey(apiKey);
    setApiKeyForm({
      name: apiKey.name,
      permissions: apiKey.permissions,
    });
    setApiKeyDialogOpen(true);
  };

  const handleDeleteApiKey = async (apiKeyId: string, apiKeyName: string) => {
    if (window.confirm(`Are you sure you want to delete this API key "${apiKeyName}"?`)) {
      try {
        await api.delete(`/settings/api-keys/${apiKeyId}`);
        void fetchApiKeys();
      } catch (error) {
        console.error('Failed to delete API key:', error);
      }
    }
  };

  const handleSaveApiKey = async () => {
    try {
      if (selectedApiKey) {
        await api.put(`/settings/api-keys/${selectedApiKey.id}`, apiKeyForm);
        setApiKeyDialogOpen(false);
      } else {
        const response = await api.post('/settings/api-keys', apiKeyForm);
        setGeneratedApiKey(response.data.key);
        setApiKeyDialogOpen(false);
      }
      void fetchApiKeys();
      setApiKeyForm({ name: '', permissions: [] });
      setSelectedApiKey(null);
    } catch (error) {
      console.error('Failed to save API key:', error);
    }
  };

  const handleToggleApiKey = async (apiKeyId: string, isActive: boolean) => {
    try {
      await api.patch(`/settings/api-keys/${apiKeyId}`, { isActive });
      void fetchApiKeys();
    } catch (error) {
      console.error('Failed to toggle API key:', error);
    }
  };

  const handleOpenApiKeyDialog = () => {
    setSelectedApiKey(null);
    setApiKeyForm({ name: '', permissions: [] });
    setApiKeyDialogOpen(true);
  };

  return {
    apiKeys,
    apiKeyDialogOpen,
    setApiKeyDialogOpen,
    selectedApiKey,
    setSelectedApiKey,
    generatedApiKey,
    setGeneratedApiKey,
    apiKeyForm,
    setApiKeyForm,
    fetchApiKeys,
    handleEditApiKey,
    handleDeleteApiKey,
    handleSaveApiKey,
    handleToggleApiKey,
    handleOpenApiKeyDialog,
  };
};
