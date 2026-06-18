import { normalizeWords } from "../autocut/index.mjs";

const DEFAULT_ACCENTS = ["#2f8dff", "#ffbd36", "#ff4d4d", "#50e38a", "#9b7cff"];

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
