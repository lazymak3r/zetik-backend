export const formatNumber = (value: string | number | null | undefined): string => {
  if (value === null || value === undefined) {
    return '0';
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '' || isNaN(parseFloat(trimmed))) {
      return '0';
    }
    return trimmed.replace(/\.0+$/, '').replace(/(\.\d*?[1-9])0+$/, '$1');
  }

  if (typeof value === 'number') {
    if (isNaN(value)) {
      return '0';
    }
    const str = value.toString();
    return str.replace(/\.0+$/, '').replace(/(\.\d*?[1-9])0+$/, '$1');
  }

  return '0';
};
