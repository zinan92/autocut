export const mergeSegments = (segments, mergeGap = 0.05) => {
  const sorted = segments
    .filter((segment) => Number.isFinite(segment.start) && Number.isFinite(segment.end))
    .filter((segment) => segment.end > segment.start)
    .sort((a, b) => a.start - b.start);

  const merged = [];
  for (const segment of sorted) {
    const last = merged.at(-1);
    if (last && segment.start <= last.end + mergeGap) {
      last.end = Math.max(last.end, segment.end);
      last.reasons = [...new Set([...(last.reasons ?? []), ...(segment.reasons ?? [])])];
    } else {
      merged.push({ ...segment, reasons: segment.reasons ?? [] });
    }
  }

  return merged;
};

export const buildKeepRanges = (duration, deleteSegments) => {
  const keep = [];
  let cursor = 0;

  for (const segment of mergeSegments(deleteSegments)) {
    const start = Math.max(0, Math.min(duration, segment.start));
    const end = Math.max(0, Math.min(duration, segment.end));
    if (start > cursor) {
      keep.push({ start: cursor, end, sourceStart: cursor, sourceEnd: start });
      keep.at(-1).end = start;
    }
    cursor = Math.max(cursor, end);
  }

  if (cursor < duration) {
    keep.push({ start: cursor, end: duration, sourceStart: cursor, sourceEnd: duration });
  }

  return keep
    .map((range) => ({
      start: Number(range.sourceStart.toFixed(3)),
      end: Number(range.sourceEnd.toFixed(3)),
    }))
    .filter((range) => range.end - range.start > 0.08);
};

export const totalDuration = (ranges) =>
  ranges.reduce((sum, range) => sum + Math.max(0, range.end - range.start), 0);
