import { useCallback, useState } from 'react';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '../../../store';
import {
  deleteSlotImage,
  fetchSlotImages,
  updateGameDescription,
  uploadSlotImages,
} from '../../../store/slots/thunks';
import { ALLOWED_IMAGE_TYPES } from '../consts';
import { ImageItem, ProviderGame } from '../types';
import { getGameCodeWithoutProvider } from '../utils/getGameCodeWithoutProvider';

export const useSlotsActions = (
  selectedFolder: string | undefined,
  gamesByCode: Record<string, ProviderGame>,
  images: ImageItem[],
  updateImages: () => void,
  setPage: (page: number) => void,
  showSnackbar: (message: string, severity: 'success' | 'error') => void,
) => {
  const dispatch = useDispatch<AppDispatch>();

  const [imagePreview, setImagePreview] = useState<ImageItem | null>(null);
  const [imageDelete, setImageDelete] = useState<ImageItem | null>(null);
  const [imageDescriptionEdit, setImageDescriptionEdit] = useState<ImageItem | null>(null);
  const [imageDescriptionText, setImageDescriptionText] = useState('');
  const [uploadConfirmation, setUploadConfirmation] = useState<{
    files: File[];
    input: HTMLInputElement;
  } | null>(null);
  const [gameImageUpload, setGameImageUpload] = useState<{
    game: ProviderGame;
    file: File;
  } | null>(null);

  const handleImagesSelection = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const input = event.currentTarget;
      const files = input.files;
      if (!files || files.length === 0) return;

      if (!selectedFolder) {
        input.value = '';
        return;
      }

      const validFiles = Array.from(files).filter((file) =>
        ALLOWED_IMAGE_TYPES.includes(file.type),
      );

      if (!validFiles.length) {
        showSnackbar('No valid image files selected.', 'error');
        input.value = '';
        return;
      }

      setUploadConfirmation({ files: validFiles, input });
    },
    [selectedFolder, showSnackbar],
  );

  const handleConfirmUpload = useCallback(async () => {
    if (!uploadConfirmation || !selectedFolder) {
      return;
    }

    const { files, input } = uploadConfirmation;
    const formData = new FormData();
    formData.append('directory', selectedFolder);
    files.forEach((file) => formData.append('files', file));

    setUploadConfirmation(null);

    try {
      await dispatch(uploadSlotImages({ formData, directory: selectedFolder })).unwrap();
      showSnackbar('Images uploaded successfully!', 'success');
      setPage(1);
      await dispatch(fetchSlotImages(selectedFolder));
    } catch (error: any) {
      const errorMessage = error?.message || 'Failed to upload images.';
      showSnackbar(errorMessage, 'error');
    } finally {
      input.value = '';
    }
  }, [uploadConfirmation, selectedFolder, dispatch, showSnackbar, setPage]);

  const handleCancelUpload = useCallback(() => {
    if (uploadConfirmation) {
      uploadConfirmation.input.value = '';
    }
    setUploadConfirmation(null);
  }, [uploadConfirmation]);

  const handleImageDelete = useCallback(async () => {
    if (!imageDelete || !selectedFolder) return;

    try {
      await dispatch(deleteSlotImage({ key: imageDelete.key, directory: selectedFolder })).unwrap();
      setImageDelete(null);
      showSnackbar('Image deleted successfully!', 'success');
      await dispatch(fetchSlotImages(selectedFolder));
    } catch (error: any) {
      const errorMessage = error?.message || 'Failed to delete image.';
      showSnackbar(errorMessage, 'error');
    }
  }, [imageDelete, selectedFolder, dispatch, showSnackbar]);

  const handleOpenDescriptionEdit = useCallback((item: ImageItem) => {
    setImageDescriptionEdit(item);
    setImageDescriptionText(item.description ?? '');
  }, []);

  const handleSaveDescriptionEdit = useCallback(async () => {
    if (!imageDescriptionEdit || !imageDescriptionEdit.gameCode) return;

    const description = imageDescriptionText.trim() || null;

    try {
      await dispatch(
        updateGameDescription({ code: imageDescriptionEdit.gameCode, description }),
      ).unwrap();
      setImageDescriptionEdit(null);
      showSnackbar('Description updated successfully!', 'success');
      if (selectedFolder) {
        await dispatch(fetchSlotImages(selectedFolder));
      }
    } catch (error: any) {
      const errorMessage = error?.message || 'Failed to update description.';
      showSnackbar(errorMessage, 'error');
    }
  }, [imageDescriptionEdit, imageDescriptionText, dispatch, showSnackbar, selectedFolder]);

  const handleGameImageUpload = useCallback(
    async (game: ProviderGame, file: File) => {
      if (!selectedFolder) {
        showSnackbar('No provider selected.', 'error');
        return;
      }

      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        showSnackbar('Invalid image type. Only JPEG, PNG, WebP, and AVIF are allowed.', 'error');
        return;
      }

      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        showSnackbar('File size too large. Maximum size is 5MB.', 'error');
        return;
      }

      setGameImageUpload(null);

      try {
        const formData = new FormData();
        formData.append('directory', selectedFolder);

        const fileExtension = file.name.split('.').pop() || 'png';
        const gameCodeWithoutProvider = getGameCodeWithoutProvider(game.code, selectedFolder);
        const renamedFile = new File([file], `${gameCodeWithoutProvider}.${fileExtension}`, {
          type: file.type,
        });
        formData.append('files', renamedFile);

        await dispatch(uploadSlotImages({ formData, directory: selectedFolder })).unwrap();
        showSnackbar('Image uploaded successfully!', 'success');
        setPage(1);
        await dispatch(fetchSlotImages(selectedFolder));
      } catch (error: any) {
        const errorMessage = error?.message || 'Failed to upload image.';
        showSnackbar(errorMessage, 'error');
      }
    },
    [selectedFolder, dispatch, showSnackbar, setPage],
  );

  const handleOpenGameDescriptionEdit = useCallback(
    (game: ProviderGame) => {
      const imageItem: ImageItem = {
        id: '',
        key: '',
        src: '',
        name: '',
        sizeBytes: 0,
        format: '',
        createdAt: '',
        folder: selectedFolder || '',
        description: game.description ?? null,
        gameCode: game.code,
      };
      setImageDescriptionEdit(imageItem);
      setImageDescriptionText(game.description ?? '');
    },
    [selectedFolder],
  );

  const handleDeleteDescription = useCallback(
    async (game: ProviderGame) => {
      if (!game.code) return;

      try {
        await dispatch(updateGameDescription({ code: game.code, description: null })).unwrap();
        showSnackbar('Description deleted successfully!', 'success');
        if (selectedFolder) {
          await dispatch(fetchSlotImages(selectedFolder));
        }
      } catch (error: any) {
        const errorMessage = error?.message || 'Failed to delete description.';
        showSnackbar(errorMessage, 'error');
      }
    },
    [dispatch, showSnackbar, selectedFolder],
  );

  const handleDeleteGameImage = useCallback(
    async (game: ProviderGame) => {
      if (!selectedFolder) {
        showSnackbar('No provider selected.', 'error');
        return;
      }

      const gameCodeWithoutProvider = getGameCodeWithoutProvider(game.code, selectedFolder);
      const imageItem = images.find((img) => {
        const imgCodeWithoutProvider = getGameCodeWithoutProvider(
          img.gameCode || '',
          selectedFolder,
        );
        return (
          imgCodeWithoutProvider.toLowerCase() === gameCodeWithoutProvider.toLowerCase() &&
          img.folder === selectedFolder
        );
      });

      if (!imageItem || !imageItem.key) {
        showSnackbar('Image not found for this game.', 'error');
        return;
      }

      try {
        await dispatch(deleteSlotImage({ key: imageItem.key, directory: selectedFolder })).unwrap();
        showSnackbar('Image deleted successfully!', 'success');
        setPage(1);
        await dispatch(fetchSlotImages(selectedFolder));
      } catch (error: any) {
        const errorMessage = error?.message || 'Failed to delete image.';
        showSnackbar(errorMessage, 'error');
      }
    },
    [selectedFolder, images, dispatch, showSnackbar, setPage],
  );

  return {
    imagePreview,
    setImagePreview,
    imageDelete,
    setImageDelete,
    imageDescriptionEdit,
    setImageDescriptionEdit,
    imageDescriptionText,
    setImageDescriptionText,
    uploadConfirmation,
    handleImagesSelection,
    handleConfirmUpload,
    handleCancelUpload,
    handleImageDelete,
    handleOpenDescriptionEdit,
    handleSaveDescriptionEdit,
    gameImageUpload,
    setGameImageUpload,
    handleGameImageUpload,
    handleOpenGameDescriptionEdit,
    handleDeleteDescription,
    handleDeleteGameImage,
  };
};
