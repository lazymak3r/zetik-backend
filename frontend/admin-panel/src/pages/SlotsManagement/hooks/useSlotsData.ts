import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams } from 'react-router-dom';
import { AppDispatch, RootState } from '../../../store';
import {
  selectActionLoading,
  selectGamesByDeveloper,
  selectImagesByDirectory,
  selectProviderByCode,
} from '../../../store/slots/selectors';
import { fetchGamesByDeveloper, fetchSlotImages } from '../../../store/slots/thunks';
import { Developer, ImageItem, ProviderGame, SlotImageApiResponse } from '../types';
import { getGameCodeWithoutProvider } from '../utils/getGameCodeWithoutProvider';

export const useSlotsData = (providers: Developer[]) => {
  const dispatch = useDispatch<AppDispatch>();
  const { folder: providerCode } = useParams<{ folder?: string }>();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [folderPage, setFolderPage] = useState(1);
  const [filterCustomImage, setFilterCustomImage] = useState(false);
  const [filterCustomDescription, setFilterCustomDescription] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const providerByCode = useSelector(selectProviderByCode);
  const selectedProvider = providerByCode[providerCode || ''];
  const selectedFolder = selectedProvider?.code;
  const selectedFolderGamesCount = selectedProvider?.gamesCount;

  const rawImages = useSelector((state: RootState) => {
    const images = selectedFolder ? selectImagesByDirectory(state, selectedFolder) : [];
    return Array.isArray(images) ? images : [];
  });
  const rawGames = useSelector((state: RootState) =>
    selectedProvider ? selectGamesByDeveloper(state, selectedProvider.name) : [],
  );
  const actionLoading = useSelector(selectActionLoading);

  const gamesByCodeMap = useMemo(() => {
    const map: Record<string, ProviderGame> = {};
    for (const game of rawGames) map[game.code] = game;
    return map;
  }, [rawGames]);

  const mapSlotImageToImageItem = useCallback(
    (item: SlotImageApiResponse, gamesMap: Record<string, ProviderGame>): ImageItem => {
      const format = item.mimeType?.split('/')?.pop() ?? item.mimeType;
      const fileNameWithoutExt = item.fileName.replace(/\.[^/.]+$/, '').toLowerCase();
      const game = Object.values(gamesMap).find((g) => {
        const gameCodeWithoutProvider = getGameCodeWithoutProvider(g.code, selectedFolder);
        return gameCodeWithoutProvider.toLowerCase() === fileNameWithoutExt;
      });

      return {
        id: item.id,
        key: item.key,
        src: item.url,
        name: item.fileName,
        sizeBytes: item.sizeBytes,
        format,
        createdAt: item.createdAt,
        folder: item.directory,
        description: game?.description ?? null,
        gameCode: game?.code,
      };
    },
    [selectedFolder],
  );

  const images = useMemo(() => {
    if (!Array.isArray(rawImages)) return [];
    return rawImages.map((item) => mapSlotImageToImageItem(item, gamesByCodeMap));
  }, [rawImages, mapSlotImageToImageItem, gamesByCodeMap]);

  const games = useMemo(() => rawGames, [rawGames]);

  const folderToImages = useMemo(() => {
    const map: Record<string, ImageItem[]> = {};
    for (const img of images) {
      if (!map[img.folder]) map[img.folder] = [];
      map[img.folder].push(img);
    }
    return map;
  }, [images]);

  const currentFolderImages = useMemo(() => {
    if (!selectedFolder) return [];
    return folderToImages[selectedFolder] || [];
  }, [folderToImages, selectedFolder]);

  const gameCodeToImage = useMemo(() => {
    const map: Record<string, ImageItem> = {};
    for (const img of images) {
      if (img.gameCode) {
        const gameCodeWithoutProvider = getGameCodeWithoutProvider(img.gameCode, selectedFolder);
        const gameCodeLower = gameCodeWithoutProvider.toLowerCase();
        if (!map[gameCodeLower]) {
          map[gameCodeLower] = img;
        }
      }
    }
    return map;
  }, [images, selectedFolder]);

  const getGameImage = useCallback(
    (gameCode: string): ImageItem | null => {
      const gameCodeWithoutProvider = getGameCodeWithoutProvider(gameCode, selectedFolder);
      return gameCodeToImage[gameCodeWithoutProvider.toLowerCase()] || null;
    },
    [gameCodeToImage, selectedFolder],
  );

  const gamesWithImages = useMemo(() => {
    return games.map((game) => {
      const image = getGameImage(game.code);
      const hasCustomImage = !!image;
      const hasCustomDescription = !!(game.description && game.description.trim() !== '');

      return {
        ...game,
        imageUrl: image?.src || null,
        hasCustomImage,
        hasCustomDescription,
      };
    });
  }, [games, getGameImage]);

  const filteredGames = useMemo(() => {
    let filtered = gamesWithImages;

    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      filtered = filtered.filter((game) => game.name.toLowerCase().includes(query));
    }

    if (filterCustomImage) {
      filtered = filtered.filter((game) => game.hasCustomImage);
    }

    if (filterCustomDescription) {
      filtered = filtered.filter((game) => game.hasCustomDescription);
    }

    return filtered;
  }, [gamesWithImages, searchQuery, filterCustomImage, filterCustomDescription]);

  const fetchSlotImagesCallback = useCallback(
    async (folder: string): Promise<SlotImageApiResponse[]> => {
      const result = await dispatch(fetchSlotImages(folder)).unwrap();
      return result.images;
    },
    [dispatch],
  );

  const updateImages = useCallback((): void => {
    if (selectedFolder) {
      void dispatch(fetchSlotImages(selectedFolder));
    }
  }, [dispatch, selectedFolder]);

  const developerCodes = useMemo(() => providers.map((d) => d.code), [providers]);

  const folderList = useMemo(() => {
    const fromPreset = developerCodes;
    const fromImages = Object.keys(folderToImages);
    return Array.from(new Set([...fromPreset, ...fromImages]));
  }, [developerCodes, folderToImages]);

  const totalFolderPages = useMemo(
    () => Math.max(1, Math.ceil(folderList.length / 12)),
    [folderList.length],
  );

  const folders = useMemo(() => {
    const start = (folderPage - 1) * 12;
    return folderList.slice(start, start + 12);
  }, [folderList, folderPage]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil((selectedFolder ? filteredGames.length : 0) / pageSize)),
    [filteredGames.length, pageSize, selectedFolder],
  );

  useEffect(() => {
    if (!selectedProvider) {
      return;
    }

    void dispatch(fetchGamesByDeveloper(selectedProvider.name));
  }, [selectedProvider, dispatch]);

  useEffect(() => {
    if (selectedFolder) {
      void dispatch(fetchSlotImages(selectedFolder));
    }
  }, [selectedFolder, dispatch]);

  useEffect(() => {
    setPage(1);
  }, [selectedFolder]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [totalPages, page]);

  useEffect(() => {
    if (folderPage > totalFolderPages) setFolderPage(totalFolderPages);
  }, [totalFolderPages, folderPage]);

  return {
    loading: actionLoading,
    setLoading: () => {},
    page,
    setPage,
    pageSize,
    setPageSize,
    folderPage,
    setFolderPage,
    images,
    setImages: () => {},
    games,
    setGames: () => {},
    gamesByCode: gamesByCodeMap,
    providerByCode,
    selectedProvider,
    selectedFolder,
    selectedFolderGamesCount,
    currentFolderImages,
    folders,
    totalPages,
    totalFolderPages,
    fetchSlotImages: fetchSlotImagesCallback,
    updateImages,
    mapSlotImageToImageItem,
    getGameImage,
    filteredGames,
    filterCustomImage,
    setFilterCustomImage,
    filterCustomDescription,
    setFilterCustomDescription,
    searchQuery,
    setSearchQuery,
  };
};
