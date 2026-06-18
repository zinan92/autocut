import { normalizeWords } from "../autocut/index.mjs";

const DEFAULT_ACCENTS = ["#2f8dff", "#ffbd36", "#ff4d4d", "#50e38a", "#9b7cff"];
const DEFAULT_REFERENCE_SKILLS = [
  ["video-ingest", "ffprobe metadata / orientation routing"],
  ["assembly", "transcript block order / source trace"],
  ["edl", "multi-source ranges / clean master"],
  ["remotion-overlay", "storyboard JSON / attention choreography"],
  ["qa", "geometry / delivery checks"],
];

const clampText = (text, maxChars = 38) => {
  const normalized = String(text ?? "").replace(/\s+/g, " ").trim();
  if (normalized.length <= maxChars) return normalized;
  return `${normalized.slice(0, maxChars - 1)}…`;
};

const titleFromText = (text, fallback) => {
  const normalized = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!normalized) return fallback;
  const sentence = normalized.split(/[。！？!?；;,.，]/).find(Boolean) ?? normalized;
  return clampText(sentence, 12);
};

const round = (value, digits = 2) => Number(Number(value).toFixed(digits));

const chunkWords = (words, duration, targetSeconds = 5) => {
  const captions = [];
  let bucket = [];
  let start = 0;

  for (const word of words.filter((item) => !item.isGap)) {
    if (bucket.length === 0) start = word.start;
    bucket.push(word);
    const span = word.end - start;
    if (span >= targetSeconds || /[。！？!?]$/.test(word.text)) {
      captions.push({
        start: Number(start.toFixed(2)),
        end: Number(word.end.toFixed(2)),
        zh: bucket.map((item) => item.text).join(""),
        en: "",
      });
      bucket = [];
    }
  }

  if (bucket.length) {
    captions.push({
      start: Number(start.toFixed(2)),
      end: Number((bucket.at(-1)?.end ?? duration).toFixed(2)),
      zh: bucket.map((item) => item.text).join(""),
      en: "",
    });
  }

  return captions.length
    ? captions
    : [{ start: 0, end: duration, zh: "待补充字幕", en: "" }];
};

export const storyboardFromTranscript = ({ transcript, manifest, duration }) => {
  const words = normalizeWords(transcript);
  const content = manifest.content ?? {};
  const captions = chunkWords(words, duration);
  const rawPhases = Array.isArray(content.phases) && content.phases.length > 0
    ? content.phases
    : captions.slice(0, 5).map((caption, index) => ({
        start: caption.start,
        end: index === captions.length - 1 ? duration : caption.end,
        kicker: `BEAT ${String(index + 1).padStart(2, "0")}`,
        title: caption.zh.slice(0, 12) || `章节 ${index + 1}`,
        accent: DEFAULT_ACCENTS[index % DEFAULT_ACCENTS.length],
        stat: String(index + 1).padStart(2, "0"),
        statLabel: "BEAT",
        detail: "由 transcript 自动生成",
      }));

  const phases = rawPhases.map((phase, index) => ({
    start: Number(phase.start.toFixed ? phase.start.toFixed(2) : phase.start),
    end: Number(phase.end.toFixed ? phase.end.toFixed(2) : phase.end),
    kicker: phase.kicker ?? `BEAT ${index + 1}`,
    title: phase.title ?? `章节 ${index + 1}`,
    accent: phase.accent ?? DEFAULT_ACCENTS[index % DEFAULT_ACCENTS.length],
    stat: phase.stat ?? String(index + 1).padStart(2, "0"),
    statLabel: phase.statLabel ?? "BEAT",
    detail: phase.detail ?? "",
  }));

  return {
    video: {
      duration,
      chapters: content.chapters ?? phases.map((phase) => phase.title),
    },
    captions,
    phases,
    shortSkillBoard: manifest.skillBoard?.slice(0, 5) ?? [],
    referenceSkillBoard: manifest.skillBoard ?? [],
    attentionTimeline: phases.map((phase, index) => ({
      id: `beat-${String(index + 1).padStart(2, "0")}`,
      start: phase.start,
      end: phase.end,
      primary: index % 3 === 0 ? "left" : index % 3 === 1 ? "right" : "bottom",
      behavior: "one-primary-animation",
      keepPrevious: index === 0 ? false : "dim-or-freeze",
    })),
    longVideoPolicy: {
      targetRangeMinutes: "5-10",
      segmentLengthSeconds: 60,
      maxSegmentLengthSeconds: 120,
      visualBeatEverySeconds: 20,
      maxActivePrimaryAnimation: 1,
    },
  };
};

export const timelineRangesFromEdl = (edl) => {
  let cursor = 0;
  return (edl.ranges ?? []).map((range) => {
    const duration = Number(range.end) - Number(range.start);
    if (!Number.isFinite(duration) || duration <= 0) {
      throw new Error(`Invalid EDL range duration for ${range.id ?? range.blockId ?? "(unknown)"}`);
    }
    const item = {
      ...range,
      outputStart: round(cursor),
      outputEnd: round(cursor + duration),
      outputDuration: round(duration),
    };
    cursor += duration;
    return item;
  });
};

const buildPhaseGroups = (timeline, duration, targetSeconds = 60, maxSeconds = 120) => {
  const groups = [];
  let bucket = [];

  const flush = () => {
    if (bucket.length === 0) return;
    groups.push(bucket);
    bucket = [];
  };

  for (const item of timeline) {
    const bucketStart = bucket[0]?.outputStart ?? item.outputStart;
    const spanIfAdded = item.outputEnd - bucketStart;
    if (bucket.length > 0 && spanIfAdded > maxSeconds) flush();
    bucket.push(item);
    const span = item.outputEnd - bucket[0].outputStart;
    if (span >= targetSeconds) flush();
  }

  flush();

  if (groups.length === 0) {
    groups.push([{ outputStart: 0, outputEnd: duration, text: "自动生成片段", source: "clean-master" }]);
  }

  return groups;
};

const ensureMinimumPhases = (phases, duration) => {
  if (phases.length >= 4) return phases;
  const expanded = [...phases];
  const step = duration / 4;
  while (expanded.length < 4) {
    const index = expanded.length;
    const start = round(index * step);
    const end = round(index === 3 ? duration : Math.max(start + 0.5, (index + 1) * step));
    expanded.push({
      start,
      end,
      kicker: `BEAT ${String(index + 1).padStart(2, "0")}`,
      title: `片段 ${index + 1}`,
      accent: DEFAULT_ACCENTS[index % DEFAULT_ACCENTS.length],
      stat: String(index + 1).padStart(2, "0"),
      statLabel: "BEAT",
      detail: "自动补齐 Remotion V9 安全片段",
    });
  }
  return expanded;
};

export const storyboardFromEdl = ({ edl, manifest = {}, duration }) => {
  const outputDuration = round(
    duration ?? edl.metrics?.outputDuration ?? timelineRangesFromEdl(edl).at(-1)?.outputEnd ?? 0,
  );
  if (!Number.isFinite(outputDuration) || outputDuration <= 0) {
    throw new Error("Cannot build storyboard without positive duration");
  }

  const timeline = timelineRangesFromEdl(edl);
  const captions = timeline.length
    ? timeline.map((range) => ({
        start: range.outputStart,
        end: range.outputEnd,
        zh: clampText(range.text ?? range.blockId ?? range.id ?? "", 46),
        en: range.source ? `${range.source} · ${round(range.start)}-${round(range.end)}s` : "",
      }))
    : [{ start: 0, end: outputDuration, zh: "待补充字幕", en: "" }];

  const content = manifest.content ?? {};
  const phaseGroups = buildPhaseGroups(timeline, outputDuration, 60, 110);
  const generatedPhases = phaseGroups.map((group, index) => {
    const first = group[0];
    const last = group.at(-1);
    const sources = [...new Set(group.map((item) => item.source).filter(Boolean))].join(" / ");
    return {
      start: round(first.outputStart),
      end: round(last.outputEnd),
      kicker: `SEGMENT ${String(index + 1).padStart(2, "0")}`,
      title: titleFromText(first.text, `片段 ${index + 1}`),
      accent: DEFAULT_ACCENTS[index % DEFAULT_ACCENTS.length],
      stat: String(index + 1).padStart(2, "0"),
      statLabel: "BEAT",
      detail: sources ? `来源 ${sources}` : "clean master",
    };
  });

  const manifestPhases = Array.isArray(content.phases) && content.phases.length > 0
    ? content.phases.map((phase, index) => ({
        start: round(phase.start ?? generatedPhases[index]?.start ?? 0),
        end: round(phase.end ?? generatedPhases[index]?.end ?? outputDuration),
        kicker: phase.kicker ?? generatedPhases[index]?.kicker ?? `SEGMENT ${index + 1}`,
        title: phase.title ?? generatedPhases[index]?.title ?? `片段 ${index + 1}`,
        accent: phase.accent ?? DEFAULT_ACCENTS[index % DEFAULT_ACCENTS.length],
        stat: phase.stat ?? String(index + 1).padStart(2, "0"),
        statLabel: phase.statLabel ?? "BEAT",
        detail: phase.detail ?? generatedPhases[index]?.detail ?? "",
      }))
    : generatedPhases;

  const phases = ensureMinimumPhases(manifestPhases, outputDuration);
  phases[phases.length - 1] = {
    ...phases.at(-1),
    end: round(Math.min(outputDuration, Math.max(phases.at(-1).end, phases.at(-1).start + 0.5))),
  };

  const firstFour = phases.slice(0, 4);
  const attentionTimeline = [
    {
      id: "skill-board",
      start: round(Math.min(0.8, outputDuration * 0.02)),
      end: round(Math.min(outputDuration, Math.max(6, Math.min(12, outputDuration * 0.18)))),
      primary: "skillBoard",
      after: "fadeOut",
      behavior: "one-primary-animation",
    },
    {
      id: "effort",
      start: firstFour[1].start,
      end: firstFour[1].end,
      primary: "storyPanel",
      after: "dim",
      behavior: "one-primary-animation",
    },
    {
      id: "karma",
      start: firstFour[2].start,
      end: firstFour[2].end,
      primary: "statBlock",
      after: "dim",
      behavior: "one-primary-animation",
    },
    {
      id: "will",
      start: firstFour[3].start,
      end: firstFour[3].end,
      primary: "sideCards",
      after: "hold",
      behavior: "one-primary-animation",
    },
    ...phases.slice(4).map((phase, index) => ({
      id: `beat-${String(index + 5).padStart(2, "0")}`,
      start: phase.start,
      end: phase.end,
      primary: index % 3 === 0 ? "header" : index % 3 === 1 ? "caption" : "lowerNav",
      after: "dim",
      behavior: "one-primary-animation",
    })),
  ]
    .filter((item) => item.end > item.start)
    .sort((a, b) => a.start - b.start);

  return {
    video: {
      duration: outputDuration,
      chapters: content.chapters?.length
        ? content.chapters
        : phases.slice(0, 8).map((phase) => phase.title),
    },
    captions,
    phases,
    shortSkillBoard: manifest.skillBoard?.slice(0, 5) ?? DEFAULT_REFERENCE_SKILLS.slice(0, 5),
    referenceSkillBoard: manifest.skillBoard ?? DEFAULT_REFERENCE_SKILLS,
    attentionTimeline,
    longVideoPolicy: {
      targetLengthMinutes: manifest.editPlan?.targetLengthMinutes ?? "5-10",
      segmentLengthSeconds: 60,
      maxSegmentLengthSeconds: 120,
      maxActivePrimaryAnimation: 1,
      visualBeatEverySeconds: 20,
      qaFramesPerSegment: 3,
    },
    sourceTrace: {
      edlMode: edl.mode ?? "unknown",
      rangeCount: edl.ranges?.length ?? 0,
      sources: Object.keys(edl.sources ?? {}),
    },
  };
};
