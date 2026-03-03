/**
 * SerializationError — Phase 5 Step 1
 *
 * Thrown when deserialization or migration fails.
 */

import type { InvariantViolation } from '../types/operations';

export class SerializationError extends Error {
  constructor(
    message: string,
    public readonly violations?: InvariantViolation[],
  ) {
    super(message);
    this.name = 'SerializationError';
  }
}
