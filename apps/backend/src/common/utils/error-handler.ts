export class FireblocksException extends Error {
  constructor(
    message: string,
    public readonly code?: string | number,
    public readonly status?: number,
    public readonly context?: string,
  ) {
    super(message);
    this.name = 'FireblocksException';
  }
}

export function extractFireblocksErrorDetails(error: unknown): {
  message: string;
  code?: string | number;
  status?: number;
  responseData?: any;
} {
  if (error instanceof Error) {
    const anyError = error as any;
    return {
      message: error.message,
      code: anyError.code,
      status: anyError.status,
      responseData: anyError.response?.data,
    };
  }

  return {
    message: typeof error === 'object' && error !== null ? JSON.stringify(error) : String(error),
  };
}
