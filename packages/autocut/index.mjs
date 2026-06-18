import { buildKeepRanges, mergeSegments, totalDuration } from "../edl/index.mjs";

const DEFAULT_FILLERS = [
  "嗯",
  "呃",
  "额",
  "啊",
  "呃呃",
  "嗯嗯",
  "那个",
  "这个",
  "就是",
  "然后",
];

const toSeconds = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n > 1000 ? n / 1000 : n;
};

export const normalizeWords = (raw) => {
  const items = Array.isArray(raw)
    ? raw
    : raw?.words ?? raw?.utterances?.flatMap((utterance) => utterance.words ?? []) ?? [];

  return items
    .map((word, index) => {
      const start = toSeconds(word.start ?? word.start_time);
      const end = toSeconds(word.end ?? word.end_time);
      return {
        index,
        text: String(word.text ?? word.word ?? "").trim(),
        start,
        end,
        isGap: Boolean(word.isGap),
      };
    })
    .filter((word) => Number.isFinite(word.start) && Number.isFinite(word.end))
    .filter((word) => word.end > word.start);
};

const deleteSegment = (start, end, reason, index = null) => ({
  start,
  end,
  reasons: [reason],
  wordIndices: index === null ? [] : [index],
});

export const detectDeleteSegments = (words, options = {}) => {
  const silenceThreshold = Number(options.silenceThresholdSec ?? 0.5);
  const fillerMode = options.fillerMode ?? "mark";
  const fillers = options.fillers ?? DEFAULT_FILLERS;
  const segments = [];

  for (let i = 0; i < words.length; i += 1) {
    const word = words[i];
    if (word.isGap && word.end - word.start >= silenceThreshold) {
      segments.push(deleteSegment(word.start, word.end, "silence_gap", word.index));
      continue;
    }

    const prev = words[i - 1];
    if (prev && !prev.isGap && !word.isGap) {
      const gap = word.start - prev.end;
      if (gap >= silenceThreshold) {
        segments.push(deleteSegment(prev.end, word.start, "silence_between_words"));
      }
    }

    if (
      fillerMode !== "off" &&
      !word.isGap &&
      fillers.includes(word.text) &&
      word.end - word.start <= 0.8
    ) {
      segments.push(deleteSegment(word.start, word.end, "filler_word", word.index));
    }
  }

  return mergeSegments(segments, Number(options.mergeGapSec ?? 0.05));
};

export const buildEdl = ({ sourceVideo, duration, transcript, options = {} }) => {
  const words = normalizeWords(transcript);
  const deleteSegments = detectDeleteSegments(words, options);
  const ranges = buildKeepRanges(duration, deleteSegments);

  return {
    version: 1,
    sourceVideo,
    mode: "single-source-autocut",
    rules: {
      neverCutInsideWord: true,
      deleteEarlierRetakeKeepLater: true,
      cutBoundaryFadeMs: 30,
      silenceThresholdSec: Number(options.silenceThresholdSec ?? 0.5),
      fillerMode: options.fillerMode ?? "mark",
    },
    deleteSegments,
    ranges: ranges.map((range, index) => ({
      id: `seg_${String(index + 1).padStart(3, "0")}`,
      source: "main",
      start: range.start,
      end: range.end,
      beat: "KEEP",
    })),
    sources: {
      main: sourceVideo,
    },
    metrics: {
      sourceDuration: duration,
      outputDuration: Number(totalDuration(ranges).toFixed(3)),
      deletedDuration: Number((duration - totalDuration(ranges)).toFixed(3)),
      deleteSegmentCount: deleteSegments.length,
      wordCount: words.filter((word) => !word.isGap).length,
    },
  };
};
