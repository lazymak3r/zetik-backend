import { Alert, Box, Tab, Tabs, Typography } from '@mui/material';
import React, { useEffect, useState } from 'react';
import TabPanel from '../../components/common/TabPanel';
import AdminUserDialog from './components/dialogs/AdminUserDialog';
import ApiKeyDialog from './components/dialogs/ApiKeyDialog';
import ApiKeyGeneratedDialog from './components/dialogs/ApiKeyGeneratedDialog';
import AdminUsersTab from './components/tabs/AdminUsersTab';
import ApiKeysTab from './components/tabs/ApiKeysTab';
import GeneralSettingsTab from './components/tabs/GeneralSettingsTab';
import { useAdminUsers } from './hooks/useAdminUsers';
import { useApiKeys } from './hooks/useApiKeys';
import { useSettingsData } from './hooks/useSettingsData';

const Settings: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);

  const settingsData = useSettingsData();
  const adminUsers = useAdminUsers();
  const apiKeys = useApiKeys();

  useEffect(() => {
    void adminUsers.fetchAdminUsers();
    void apiKeys.fetchApiKeys();
  }, []);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleAdminFormChange = (field: 'name' | 'email' | 'password' | 'role', value: string) => {
    adminUsers.setAdminForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleApiKeyFormChange = (field: 'name' | 'permissions', value: string | string[]) => {
    apiKeys.setApiKeyForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleAssignToExistingUserChange = (value: boolean) => {
    adminUsers.setAssignToExistingUser(value);
    if (value) {
      adminUsers.setAdminForm((prev) => ({ ...prev, role: 'moderator' }));
    } else {
      adminUsers.setSelectedUser(null);
      adminUsers.userSearch.resetUserSearch();
      adminUsers.setAdminForm((prev) => ({ ...prev, role: 'admin' }));
    }
  };

  const handleCloseAdminDialog = () => {
    adminUsers.setAdminDialogOpen(false);
    adminUsers.resetAdminForm();
  };

  if (settingsData.loading || !settingsData.settings) {
    return <Typography>Loading...</Typography>;
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        System Settings
      </Typography>

      {settingsData.saveMessage && (
        <Alert
          severity={settingsData.saveMessage.includes('Failed') ? 'error' : 'success'}
          sx={{ mb: 2 }}
        >
          {settingsData.saveMessage}
        </Alert>
      )}

      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tabValue} onChange={handleTabChange}>
          <Tab label="General Settings" />
          <Tab label="Admin Users" />
          <Tab label="API Keys" />
        </Tabs>
      </Box>

      <TabPanel value={tabValue} index={0}>
        <GeneralSettingsTab
          settings={settingsData.settings}
          onSettingChange={settingsData.handleSettingChange}
          onVipRequirementChange={settingsData.handleVipRequirementChange}
          onSave={() => {
            void settingsData.saveSettings();
          }}
        />
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        <AdminUsersTab
          adminUsers={adminUsers.adminUsers}
          isSuperAdmin={adminUsers.isSuperAdmin}
          onAddAdmin={adminUsers.handleOpenAdminDialog}
          onEditAdmin={adminUsers.handleEditAdmin}
          onDeleteAdmin={(id) => {
            void adminUsers.handleDeleteAdmin(id);
          }}
          onRemoveRole={(admin) => {
            void adminUsers.handleRemoveRole(admin);
          }}
        />
      </TabPanel>

      <TabPanel value={tabValue} index={2}>
        <ApiKeysTab
          apiKeys={apiKeys.apiKeys}
          onGenerateApiKey={apiKeys.handleOpenApiKeyDialog}
          onEditApiKey={apiKeys.handleEditApiKey}
          onDeleteApiKey={(id, name) => {
            void apiKeys.handleDeleteApiKey(id, name);
          }}
          onToggleApiKey={(id, isActive) => {
            void apiKeys.handleToggleApiKey(id, isActive);
          }}
        />
      </TabPanel>

      <AdminUserDialog
        open={adminUsers.adminDialogOpen}
        selectedAdmin={adminUsers.selectedAdmin}
        isSuperAdmin={adminUsers.isSuperAdmin}
        assignToExistingUser={adminUsers.assignToExistingUser}
        onAssignToExistingUserChange={handleAssignToExistingUserChange}
        selectedUser={adminUsers.selectedUser}
        userSearchQuery={adminUsers.userSearch.userSearchQuery}
        userSearchResults={adminUsers.userSearch.userSearchResults}
        userCurrentRole={adminUsers.userSearch.userCurrentRole}
        adminForm={adminUsers.adminForm}
        emailCheckResult={adminUsers.emailCheckResult}
        isCheckingEmail={adminUsers.isCheckingEmail}
        onUserSearchInputChange={adminUsers.userSearch.handleUserSearchInputChange}
        onUserSelect={(user) => {
          void adminUsers.handleUserSelect(user);
        }}
        onAdminFormChange={handleAdminFormChange}
        onClose={handleCloseAdminDialog}
        onSave={() => {
          void adminUsers.handleSaveAdmin();
        }}
      />

      <ApiKeyDialog
        open={apiKeys.apiKeyDialogOpen}
        selectedApiKey={apiKeys.selectedApiKey}
        apiKeyForm={apiKeys.apiKeyForm}
        onClose={() => apiKeys.setApiKeyDialogOpen(false)}
        onFormChange={handleApiKeyFormChange}
        onSave={() => {
          void apiKeys.handleSaveApiKey();
        }}
      />

      <ApiKeyGeneratedDialog
        open={!!apiKeys.generatedApiKey}
        apiKey={apiKeys.generatedApiKey}
        onClose={() => apiKeys.setGeneratedApiKey(null)}
      />
    </Box>
  );
};

export default Settings;
