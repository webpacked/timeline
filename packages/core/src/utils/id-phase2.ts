/**
 * ID GENERATION UTILITIES - PHASE 2
 * 
 * Additional ID generators for Phase 2 features.
 */

import { generateId } from './id';

/**
 * Generate a unique link group ID
 * 
 * @returns A unique link group ID
 */
export function generateLinkGroupId(): string {
  return generateId('linkgroup');
}

/**
 * Generate a unique group ID
 * 
 * @returns A unique group ID
 */
export function generateGroupId(): string {
  return generateId('group');
}

/**
 * Generate a unique marker ID
 * 
 * @returns A unique marker ID
 */
export function generateMarkerId(): string {
  return generateId('marker');
}
