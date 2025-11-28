import { ConflictException } from '@nestjs/common';

/**
 * Exception thrown when a webhook or transaction has already been processed.
 * This is used for idempotent webhook handling - the operation is safe to acknowledge
 * as successful since the transaction was already completed.
 */
export class AlreadyProcessedException extends ConflictException {
  constructor(resource: string, message?: string) {
    super(message || `Resource ${resource} has already been processed`, 'ALREADY_PROCESSED');
    this.name = 'AlreadyProcessedException';
  }
}
