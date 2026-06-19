const round = (value, digits = 3) => Number(Number(value).toFixed(digits));

const timedKeys = ["captions", "phases", "attentionTimeline"];

const clipTimedItems = (items, start, end) => {
  if (!Array.isArray(items)) {
    return items;
  }

  return items
    .filter((item) => typeof item.start !== "number" || item.start < end)
    .filter((item) => typeof item.end !== "number" || item.end > start)
    .map((item) => {
      if (typeof item.start !== "number" || typeof item.end !== "number") {
        return item;
      }

      return {
        ...item,
        start: round(Math.max(item.start, start) - start),
        end: round(Math.min(item.end, end) - start),
      };
    })
    .filter((item) => typeof item.end !== "number" || item.end > item.start);
};

const fallbackCaption = (duration) => ({
  start: 0,
  end: duration,
  zh: "片段字幕待生成",
  en: "",
});

const fallbackPhase = (duration) => ({
  start: 0,
  end: duration,
  kicker: "SEGMENT",
  title: "片段",
  accent: "#2f8dff",
  stat: "01",
  statLabel: "BEAT",
  detail: "segment render",
});

const fallbackAttention = (duration) => ({
  id: "segment-window",
  start: 0,
  end: duration,
  primary: "caption",
  behavior: "one-primary-animation",
});

const ensureNonEmptyTimedArrays = (storyboard, duration) => ({
  ...storyboard,
  captions: storyboard.captions?.length ? storyboard.captions : [fallbackCaption(duration)],
  phases: storyboard.phases?.length ? storyboard.phases : [fallbackPhase(duration)],
  attentionTimeline: storyboard.attentionTimeline?.length
    ? storyboard.attentionTimeline
    : [fallbackAttention(duration)],
});

export const windowStoryboard = ({
  storyboard,
  start,
  end,
  mediaStart = start,
  timelineDuration = storyboard.video?.duration,
}) => {
  const duration = round(end - start);
  if (!Number.isFinite(start) || !Number.isFinite(end) || duration <= 0) {
    throw new Error(`Invalid storyboard window: ${start}-${end}`);
  }

  const windowed = structuredClone(storyboard);
  windowed.video = {
    ...windowed.video,
    duration,
    mediaStart: round(mediaStart),
    timelineStart: round(start),
    timelineDuration: round(timelineDuration ?? duration),
  };

  for (const key of timedKeys) {
    windowed[key] = clipTimedItems(windowed[key], start, end);
  }

  return ensureNonEmptyTimedArrays(windowed, duration);
};
