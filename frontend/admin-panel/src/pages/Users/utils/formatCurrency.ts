export const formatCurrency = (value: string | number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(typeof value === 'string' ? parseFloat(value) : value);
};
