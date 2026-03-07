/**
 * Simple class-name merge utility.
 * Filters falsy values and joins with space.
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}
