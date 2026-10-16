/** Pure, reusable filtering helpers shared by reports and CSV exports. */
import type { UtcRange } from "./datetime";

/** Is an ISO instant inside the half-open range [startUtc, endUtc)? */
export function inUtcRange(instant: string, range: UtcRange): boolean {
  const t = new Date(instant).getTime();
  return t >= new Date(range.startUtc).getTime() && t < new Date(range.endUtc).getTime();
}

/** Filter records that carry an ISO timestamp field into a UTC range. */
export function filterByRange<T>(
  records: T[],
  getInstant: (r: T) => string,
  range: UtcRange
): T[] {
  return records.filter((r) => inUtcRange(getInstant(r), range));
}
