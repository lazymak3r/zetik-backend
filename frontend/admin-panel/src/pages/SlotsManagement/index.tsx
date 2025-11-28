import { Alert, Backdrop, Box, CircularProgress, Snackbar, Typography } from '@mui/material';
import React, { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import EditDescriptionDialog from './components/dialogs/EditDescriptionDialog';
import UploadGameImageDialog from './components/dialogs/UploadGameImageDialog';
import GamesTable from './components/GamesTable';
import ProviderHeader from './components/ProviderHeader';
import ProvidersList from './components/ProvidersList';
import { useProviders } from './hooks/useProviders';
import { useSlotsActions } from './hooks/useSlotsActions';
import { useSlotsData } from './hooks/useSlotsData';
import { ProviderGame } from './types';

const SlotsManagement: React.FC = () => {
  const navigate = useNavigate();

  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success');

  const showSnackbar = useCallback((message: string, severity: 'success' | 'error') => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  }, []);

  const handleSnackbarClose = () => {
    setSnackbarOpen(false);
  };

  const { providers, handleProviderEnabledChange: handleProviderEnabledChangeRaw } = useProviders();

  const handleProviderEnabledChange = useCallback(
    (provider: any, enabled: boolean) => {
      void handleProviderEnabledChangeRaw(provider, enabled, showSnackbar);
    },
    [handleProviderEnabledChangeRaw, showSnackbar],
  );

  const {
    loading,
    page,
    setPage,
    pageSize,
    setPageSize,
    folderPage,
    setFolderPage,
    images,
    gamesByCode,
    providerByCode,
    selectedProvider,
    selectedFolder,
    selectedFolderGamesCount,
    folders,
    totalPages,
    totalFolderPages,
    updateImages,
    filteredGames,
    filterCustomImage,
    setFilterCustomImage,
    filterCustomDescription,
    setFilterCustomDescription,
    searchQuery,
    setSearchQuery,
  } = useSlotsData(providers);

  const {
    imageDescriptionEdit,
    setImageDescriptionEdit,
    imageDescriptionText,
    setImageDescriptionText,
    handleSaveDescriptionEdit,
    handleOpenGameDescriptionEdit,
    handleGameImageUpload,
    handleDeleteDescription,
    handleDeleteGameImage,
  } = useSlotsActions(selectedFolder, gamesByCode, images, updateImages, setPage, showSnackbar);

  const [uploadDialogGame, setUploadDialogGame] = useState<ProviderGame | null>(null);

  const handleSelectFolder = (folder: string) => {
    void navigate(`/slots-management/${folder}`);
  };

  const handleBackNavigation = () => {
    void navigate('/slots-management');
  };

  const handleGameUploadClick = useCallback((game: ProviderGame) => {
    setUploadDialogGame(game);
  }, []);

  const handleGameUploadConfirm = useCallback(
    async (game: ProviderGame, file: File) => {
      await handleGameImageUpload(game, file);
      setUploadDialogGame(null);
    },
    [handleGameImageUpload],
  );

  const handleGameDescriptionEdit = useCallback(
    (game: ProviderGame) => {
      handleOpenGameDescriptionEdit(game);
    },
    [handleOpenGameDescriptionEdit],
  );

  return (
    <Box>
      <Backdrop
        open={loading}
        sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1 }}
        aria-live="polite"
      >
        <CircularProgress color="inherit" size={48} thickness={4} />
      </Backdrop>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Slots Management</Typography>
      </Box>

      {selectedFolder && (
        <ProviderHeader
          provider={selectedProvider}
          folder={selectedFolder}
          gamesCount={selectedFolderGamesCount || 0}
          onBack={handleBackNavigation}
        />
      )}

      {!selectedFolder && (
        <ProvidersList
          folders={folders}
          providerByCode={providerByCode}
          folderPage={folderPage}
          totalFolderPages={totalFolderPages}
          onFolderPageChange={setFolderPage}
          onFolderSelect={handleSelectFolder}
          onProviderEnabledChange={handleProviderEnabledChange}
        />
      )}

      {selectedFolder && (
        <GamesTable
          games={filteredGames}
          page={page}
          pageSize={pageSize}
          totalPages={totalPages}
          onPageChange={(page) => {
            setPage(page);
          }}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setPage(1);
          }}
          onUploadImage={handleGameUploadClick}
          onEditDescription={handleGameDescriptionEdit}
          onDeleteImage={(game) => {
            void handleDeleteGameImage(game);
          }}
          onDeleteDescription={(game) => {
            void handleDeleteDescription(game);
          }}
          filterCustomImage={filterCustomImage}
          filterCustomDescription={filterCustomDescription}
          onFilterCustomImageChange={setFilterCustomImage}
          onFilterCustomDescriptionChange={setFilterCustomDescription}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
      )}

      <UploadGameImageDialog
        open={!!uploadDialogGame}
        onClose={() => setUploadDialogGame(null)}
        onConfirm={(game, file) => void handleGameUploadConfirm(game, file)}
        game={uploadDialogGame}
        loading={loading}
      />

      <EditDescriptionDialog
        open={!!imageDescriptionEdit}
        onClose={() => setImageDescriptionEdit(null)}
        onSave={() => void handleSaveDescriptionEdit()}
        description={imageDescriptionText}
        onDescriptionChange={setImageDescriptionText}
        loading={loading}
        hasDescription={!!imageDescriptionEdit?.description}
      />

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={5000}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        onClose={handleSnackbarClose}
      >
        <Alert sx={{ width: '100%' }} severity={snackbarSeverity} onClose={handleSnackbarClose}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default SlotsManagement;
