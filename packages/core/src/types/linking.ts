/**
 * LINKING TYPES
 * 
 * Link groups synchronize edits across multiple clips.
 * When one clip in a link group is moved/deleted, all linked clips are affected.
 */

/**
 * Link group - relates clips for synchronized editing
 */
export interface LinkGroup {
  id: string;
  clipIds: string[];
  createdAt?: number; // Optional timestamp
}
