/**
 * GROUPING TYPES
 * 
 * Groups organize clips visually without affecting edit behavior.
 * Unlike link groups, groups are for organization only.
 */

/**
 * Group - organizes clips visually
 */
export interface Group {
  id: string;
  name: string;
  clipIds: string[];
  parentGroupId?: string; // For nested groups
  color?: string;
  collapsed?: boolean; // UI hint
}
