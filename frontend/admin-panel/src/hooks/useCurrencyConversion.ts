import { useCallback, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch } from '../store';
import {
  fetchCurrencyRates,
  selectCurrencyRates,
  selectPaymentsError,
  selectPaymentsLoading,
} from '../store/payments';
import { formatNumber } from '../utils';

export const useCurrencyConversion = () => {
  const dispatch = useDispatch<AppDispatch>();
  const currencyRates = useSelector(selectCurrencyRates);
  const isLoading = useSelector(selectPaymentsLoading);
  const error = useSelector(selectPaymentsError);

  useEffect(() => {
    if (!currencyRates && !isLoading) {
      void dispatch(fetchCurrencyRates());
    }
  }, [dispatch, currencyRates, isLoading]);

  const availableCurrencies = useMemo(() => {
    if (!currencyRates?.rates) {
      return [];
    }
    return Object.keys(currencyRates.rates)
      .filter((symbol) => symbol !== 'USD')
      .sort();
  }, [currencyRates]);

  const convertToAsset = useCallback(
    (usdAmount: string, asset: string): string | null => {
      if (!usdAmount || asset === 'USD') {
        return usdAmount;
      }

      if (!currencyRates?.rates || !currencyRates.rates[asset]) {
        return null;
      }

      const usdValue = parseFloat(usdAmount);
      if (isNaN(usdValue)) {
        return null;
      }

      const rate = currencyRates.rates[asset];
      const convertedValue = usdValue / rate;
      return convertedValue.toFixed(2);
    },
    [currencyRates],
  );

  const formatConvertedValue = useCallback(
    (usdValue: string | undefined, selectedAsset: string): { value: string; asset: string } => {
      if (!usdValue) {
        return { value: '0', asset: selectedAsset };
      }

      if (selectedAsset === 'USD') {
        return { value: formatNumber(usdValue), asset: 'USD' };
      }

      const converted = convertToAsset(usdValue, selectedAsset);
      if (converted === null) {
        return { value: formatNumber(usdValue), asset: 'USD' };
      }

      return { value: formatNumber(converted), asset: selectedAsset };
    },
    [convertToAsset],
  );

  return {
    convertToAsset,
    formatConvertedValue,
    availableCurrencies,
    currencyRates,
    isLoading,
    error,
  };
};
