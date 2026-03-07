/**
 * TransactionCompressor — Phase 7 Step 3
 *
 * Decides whether a transaction should be merged into the previous
 * history entry (same op type within window).
 */

import type { Transaction } from '../types/operations';
import type { CompressionPolicy } from '../types/compression';
import { DEFAULT_COMPRESSION_POLICY } from '../types/compression';
import { isCompressibleOpType } from '../types/compression';

export class TransactionCompressor {
  private lastOpType: string | null = null;
  private lastTime = 0;
  private policy: CompressionPolicy;
  private clock: () => number;

  constructor(
    policy: CompressionPolicy = DEFAULT_COMPRESSION_POLICY,
    clock: () => number = Date.now,
  ) {
    this.policy = policy;
    this.clock = clock;
  }

  shouldCompress(transaction: Transaction, now: number): boolean {
    if (this.policy.kind === 'none') return false;
    if (transaction.operations.length !== 1) return false;
    const opType = transaction.operations[0]!.type;
    if (!isCompressibleOpType(opType)) return false;
    if (
      opType === this.lastOpType &&
      now - this.lastTime <= (this.policy as { windowMs: number }).windowMs
    ) {
      return true;
    }
    return false;
  }

  record(transaction: Transaction, now: number): void {
    this.lastOpType = transaction.operations[0]?.type ?? null;
    this.lastTime = now;
  }

  reset(): void {
    this.lastOpType = null;
    this.lastTime = 0;
  }
}
