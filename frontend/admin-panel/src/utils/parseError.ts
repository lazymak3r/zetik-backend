export function parseErrorMessage(error: any): string {
  if (!error) {
    return 'Unknown error';
  }

  const message =
    error?.message || error?.response?.data?.message || error?.error || 'Unknown error';

  if (typeof message === 'string') {
    try {
      const parsed = JSON.parse(message);

      if (parsed && typeof parsed === 'object') {
        if (parsed.message) {
          if (typeof parsed.message === 'string') {
            return parsed.message;
          }
          if (parsed.message && typeof parsed.message === 'object' && parsed.message.message) {
            return parsed.message.message;
          }
        }
        if (parsed.error) {
          return parsed.error;
        }
      }
    } catch {
      return message;
    }
  }

  return message;
}
