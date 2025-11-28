import { ServiceUnavailableException } from '@nestjs/common';

/**
 * Exception thrown when a distributed lock cannot be acquired.
 * This typically indicates high system load or resource contention.
 */
export class LockAcquisitionException extends ServiceUnavailableException {
  constructor(resource: string, message?: string) {
    super(
      message || 'System is busy processing your request. Please try again in a few seconds.',
      'LOCK_ACQUISITION_FAILED',
    );
    this.name = 'LockAcquisitionException';
  }
}
