import { resolveRange, type DateRangePreset, type UtcRange } from "./datetime";

type SP = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined) =>
  Array.isArray(v) ? v[0] : v;

/** Resolve a UTC range + echo the active preset/custom values from searchParams. */
export function rangeFromParams(sp: SP): {
  range: UtcRange;
  preset: DateRangePreset;
  from?: string;
  to?: string;
} {
  const preset = (one(sp.range) as DateRangePreset) || "today";
  const from = one(sp.from);
  const to = one(sp.to);
  return { range: resolveRange(preset, from, to), preset, from, to };
}
