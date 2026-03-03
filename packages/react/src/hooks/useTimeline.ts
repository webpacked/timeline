// Forwarding shim — implementation moved to hooks.ts
export { useTimeline } from '../hooks';
// Legacy export: UseTimelineResult was the old shape that returned { state, engine }.
// useTimeline() now returns Timeline directly (breaking change — intentional).
// Keeping this export to avoid unused-export errors; consumers should update.
export type UseTimelineResult = never;
