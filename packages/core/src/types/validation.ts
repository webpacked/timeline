/**
 * VALIDATION SYSTEM TYPES
 * 
 * This file defines the structure for validation results throughout the engine.
 * 
 * WHY STRUCTURED VALIDATION?
 * - Operations can fail gracefully (no exceptions thrown)
 * - Errors are descriptive and actionable
 * - Multiple errors can be collected and reported together
 * - Validation logic is separated from business logic
 * 
 * USAGE:
 * ```typescript
 * const result = validateClip(state, clip);
 * if (!result.valid) {
 *   console.error('Validation failed:', result.errors);
 *   return;
 * }
 * ```
 */

/**
 * ValidationError - A single validation error
 * 
 * Contains:
 * - code: Machine-readable error code (e.g., "CLIP_OVERLAP")
 * - message: Human-readable error message
 * - context: Optional additional data about the error
 */
export interface ValidationError {
  /** Machine-readable error code */
  code: string;
  
  /** Human-readable error message */
  message: string;
  
  /** Optional context data for debugging */
  context?: Record<string, unknown>;
}

/**
 * ValidationResult - The result of a validation operation
 * 
 * Contains:
 * - valid: Whether the validation passed
 * - errors: Array of validation errors (empty if valid)
 */
export interface ValidationResult {
  /** Whether the validation passed */
  valid: boolean;
  
  /** Array of validation errors (empty if valid) */
  errors: ValidationError[];
}

/**
 * Create a successful validation result
 * 
 * @returns A ValidationResult indicating success
 */
export function validResult(): ValidationResult {
  return {
    valid: true,
    errors: [],
  };
}

/**
 * Create a failed validation result with a single error
 * 
 * @param code - Error code
 * @param message - Error message
 * @param context - Optional context data
 * @returns A ValidationResult indicating failure
 */
export function invalidResult(
  code: string,
  message: string,
  context?: Record<string, unknown>
): ValidationResult {
  const error: ValidationError = { code, message };
  
  if (context !== undefined) {
    error.context = context;
  }
  
  return {
    valid: false,
    errors: [error],
  };
}

/**
 * Create a failed validation result with multiple errors
 * 
 * @param errors - Array of validation errors
 * @returns A ValidationResult indicating failure
 */
export function invalidResults(errors: ValidationError[]): ValidationResult {
  return {
    valid: false,
    errors,
  };
}

/**
 * Combine multiple validation results
 * 
 * If any result is invalid, the combined result is invalid.
 * All errors are collected together.
 * 
 * @param results - Array of validation results to combine
 * @returns A combined ValidationResult
 */
export function combineResults(...results: ValidationResult[]): ValidationResult {
  const allErrors: ValidationError[] = [];
  
  for (const result of results) {
    if (!result.valid) {
      allErrors.push(...result.errors);
    }
  }
  
  if (allErrors.length > 0) {
    return invalidResults(allErrors);
  }
  
  return validResult();
}
