/**
 * Centered interval tree — Phase 7 Step 1
 *
 * Stores intervals [start, end) and answers query(point):
 * all intervals containing point. O(log n + k).
 */

export type Interval<T> = {
  readonly start: number; // inclusive
  readonly end: number;   // exclusive
  readonly data: T;
};

type INode<T> = {
  center: number;
  intervals: Interval<T>[];
  left: INode<T> | null;
  right: INode<T> | null;
};

function medianMidpoints(intervals: Interval<unknown>[]): number {
  const midpoints = intervals
    .map((i) => (i.start + i.end) / 2)
    .slice()
    .sort((a, b) => a - b);
  const len = midpoints.length;
  if (len === 0) return 0;
  return len % 2 === 1
    ? midpoints[(len - 1) / 2]!
    : (midpoints[len / 2 - 1]! + midpoints[len / 2]!) / 2;
}

function buildNode<T>(intervals: Interval<T>[], _depth: number): INode<T> | null {
  if (intervals.length === 0) return null;
  const center = medianMidpoints(intervals);
  const left_intervals: Interval<T>[] = [];
  const right_intervals: Interval<T>[] = [];
  const crossing: Interval<T>[] = [];
  for (const i of intervals) {
    if (i.end <= center) left_intervals.push(i);
    else if (i.start > center) right_intervals.push(i);
    else crossing.push(i);
  }
  crossing.sort((a, b) => a.start - b.start);
  return {
    center,
    intervals: crossing,
    left: buildNode(left_intervals, _depth + 1),
    right: buildNode(right_intervals, _depth + 1),
  };
}

function queryNode<T>(node: INode<T> | null, point: number): T[] {
  if (node === null) return [];
  const results: T[] = [];
  for (const interval of node.intervals) {
    if (interval.start <= point && point < interval.end) {
      results.push(interval.data);
    }
  }
  if (point < node.center) {
    results.push(...queryNode(node.left, point));
  } else {
    results.push(...queryNode(node.right, point));
  }
  return results;
}

export class IntervalTree<T> {
  private root: INode<T> | null = null;
  private _size = 0;

  build(intervals: Interval<T>[]): void {
    this._size = intervals.length;
    this.root = buildNode(intervals, 0);
  }

  query(point: number): T[] {
    return queryNode(this.root, point);
  }

  size(): number {
    return this._size;
  }
}
