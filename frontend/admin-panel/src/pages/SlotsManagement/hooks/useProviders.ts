import { useCallback, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch } from '../../../store';
import { selectProviders, selectProvidersLoading } from '../../../store/slots/selectors';
import { fetchProviders, updateProviderEnabled } from '../../../store/slots/thunks';
import { Developer } from '../types';

export const useProviders = () => {
  const dispatch = useDispatch<AppDispatch>();
  const providers = useSelector(selectProviders);
  const loading = useSelector(selectProvidersLoading);

  useEffect(() => {
    void dispatch(fetchProviders());
  }, [dispatch]);

  const handleProviderEnabledChange = useCallback(
    async (
      provider: Developer,
      enabled: boolean,
      showSnackbar: (message: string, severity: 'success' | 'error') => void,
    ) => {
      if (provider.code === 'zetik' && !enabled) {
        showSnackbar('Cannot disable Zetik games.', 'error');
        return;
      }

      try {
        await dispatch(updateProviderEnabled({ name: provider.name, enabled })).unwrap();
        showSnackbar(`Provider ${enabled ? 'enabled' : 'disabled'} successfully!`, 'success');
      } catch (error: any) {
        const errorMessage = error?.message || 'Failed to update provider status.';
        showSnackbar(errorMessage, 'error');
      }
    },
    [dispatch],
  );

  return {
    providers,
    loading,
    handleProviderEnabledChange,
  };
};
