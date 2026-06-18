import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, isAbsolute, resolve } from "node:path";
import { readJson } from "../shared/json.mjs";

const DEFAULT_SPLIT_RATIO = 0.8;

export const resolveManifestSources = (manifest, manifestPath = "workflow/manifest.json") => {
  const baseDir = dirname(resolve(manifestPath));
  const resolveFromManifestOrCwd = (path) => {
    if (!path) return null;
    if (isAbsolute(path)) return path;
    const fromManifest = resolve(baseDir, path);
    if (existsSync(fromManifest)) return fromManifest;
    return resolve(process.cwd(), path);
  };
  const rawSources = Array.isArray(manifest.sources) && manifest.sources.length > 0
    ? manifest.sources
    : manifest.sourceVideo
      ? [{ id: "part1", path: manifest.sourceVideo, transcriptPath: manifest.transcriptPath }]
      : [];

  if (rawSources.length === 0) {
    throw new Error("Manifest must define sources[] or sourceVideo");
  }

  if (rawSources.length > 3) {
    throw new Error("V1 supports 1-3 source videos");
  }

  return rawSources.map((source, index) => {
    const item = typeof source === "string" ? { path: source } : source;
    const id = item.id ?? `part${index + 1}`;
    const path = item.path ?? item.video ?? item.sourceVideo;
    if (!path) throw new Error(`sources[${index}] is missing path`);

    return {
      id,
      label: item.label ?? id,
      path: resolveFromManifestOrCwd(path),
      transcriptPath: resolveFromManifestOrCwd(item.transcriptPath),
    };
  });
};

const seconds = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n > 1000 ? n / 1000 : n;
};

const textOf = (item) => String(item.text ?? item.word ?? item.token ?? "").trim();

export const normalizeTranscriptUnits = (transcript, sourceId) => {
  const rawWords = Array.isArray(transcript)
    ? transcript
    : Array.isArray(transcript.words)
      ? transcript.words
      : Array.isArray(transcript.segments)
        ? transcript.segments
        : Array.isArray(transcript.utterances)
          ? transcript.utterances.flatMap((utterance) => utterance.words?.length ? utterance.words : [utterance])
          : [];

  const granularity = Array.isArray(transcript?.words)
    ? "word"
    : Array.isArray(transcript?.segments)
      ? "segment"
      : "unit";

  const units = rawWords
    .map((item, index) => {
      const start = seconds(item.start ?? item.start_time);
      const end = seconds(item.end ?? item.end_time);
      return {
        index,
        source: sourceId,
        start,
        end,
        text: textOf(item),
        isGap: Boolean(item.isGap),
      };
    })
    .filter((unit) => Number.isFinite(unit.start) && Number.isFinite(unit.end))
    .filter((unit) => unit.end > unit.start)
    .filter((unit) => unit.text || unit.isGap)
    .sort((a, b) => a.start - b.start);

  if (units.length === 0) {
    throw new Error(`Transcript for ${sourceId} has no timed units`);
  }

  return { units, granularity };
};

const hasSentenceEnd = (text) => /[。！？!?；;.!?]$/.test(text.trim());

export const unitsToBlocks = (units, sourceId, options = {}) => {
  const maxBlockSeconds = Number(options.maxBlockSeconds ?? 18);
  const silenceBreakSeconds = Number(options.silenceBreakSeconds ?? 0.7);
  const blocks = [];
  let bucket = [];

  const flush = () => {
    const spoken = bucket.filter((unit) => !unit.isGap && unit.text);
    if (spoken.length === 0) {
      bucket = [];
      return;
    }

    const start = spoken[0].start;
    const end = spoken.at(-1).end;
    const text = spoken.map((unit) => unit.text).join("").replace(/\s+/g, " ").trim();
    const index = blocks.length + 1;
    blocks.push(makeBlock({
      id: `${sourceId}_${String(index).padStart(3, "0")}`,
      source: sourceId,
      start,
      end,
      text,
      status: "active",
    }));
    bucket = [];
  };

  for (let i = 0; i < units.length; i += 1) {
    const unit = units[i];
    const previous = bucket.at(-1);
    const gap = previous ? unit.start - previous.end : 0;

    if (previous && gap >= silenceBreakSeconds) {
      flush();
    }

    bucket.push(unit);

    const firstSpoken = bucket.find((item) => !item.isGap && item.text);
    const span = firstSpoken ? unit.end - firstSpoken.start : 0;
    if (!unit.isGap && (hasSentenceEnd(unit.text) || span >= maxBlockSeconds)) {
      flush();
    }
  }

  flush();

  if (blocks.length === 0) {
    throw new Error(`Could not build assembly blocks for ${sourceId}`);
  }

  return blocks;
};

const hashBlock = ({ id, source, start, end, text }) =>
  createHash("sha1")
    .update([id, source, Number(start).toFixed(3), Number(end).toFixed(3), text].join("|"))
    .digest("hex")
    .slice(0, 12);

export const makeBlock = ({ id, source, start, end, text, status = "active", group = null }) => {
  const block = {
    id,
    source,
    start: Number(Number(start).toFixed(3)),
    end: Number(Number(end).toFixed(3)),
    text: String(text ?? "").trim(),
    status,
  };
  if (group) block.group = group;
  block.hash = hashBlock(block);
  return block;
};

const findSplitBoundary = (blocks, duration, ratio = DEFAULT_SPLIT_RATIO) => {
  const target = duration * ratio;
  const candidates = blocks
    .map((block) => block.end)
    .filter((time) => time > duration * 0.45 && time < duration * 0.95);

  if (candidates.length === 0) return target;
  return candidates.reduce((best, time) =>
    Math.abs(time - target) < Math.abs(best - target) ? time : best,
  candidates[0]);
};

export const orderBlocksForAssembly = (sourceBlocks, sourceDurations, options = {}) => {
  const insertThirdIntoSecond = options.insertThirdIntoSecond ?? sourceBlocks.length === 3;
  if (!insertThirdIntoSecond || sourceBlocks.length !== 3) {
    return sourceBlocks.flatMap((item) => item.blocks);
  }

  const [part1, part2, part3] = sourceBlocks;
  const splitAt = findSplitBoundary(
    part2.blocks,
    sourceDurations[part2.source.id],
    Number(options.splitRatio ?? DEFAULT_SPLIT_RATIO),
  );

  const part2A = part2.blocks
    .filter((block) => block.end <= splitAt)
    .map((block) => ({ ...block, group: "part2-a" }));
  const part2B = part2.blocks
    .filter((block) => block.end > splitAt)
    .map((block) => ({ ...block, group: "part2-b" }));

  return [
    ...part1.blocks,
    ...part2A,
    ...part3.blocks,
    ...part2B,
  ];
};

export const buildAssembly = ({ manifest, manifestPath, sourceProbes, options = {} }) => {
  const sources = resolveManifestSources(manifest, manifestPath);
  const sourceBlocks = [];
  const sourceDurations = {};

  for (const source of sources) {
    const transcriptPath = source.transcriptPath;
    if (!transcriptPath || !existsSync(transcriptPath)) {
      throw new Error(`Transcript missing for ${source.id}: ${transcriptPath ?? "(none)"}`);
    }

    const transcript = readJson(transcriptPath);
    const { units, granularity } = normalizeTranscriptUnits(transcript, source.id);
    const blocks = unitsToBlocks(units, source.id, options);
    sourceBlocks.push({ source, granularity, blocks });
    sourceDurations[source.id] =
      sourceProbes?.[source.id]?.duration ?? Math.max(...blocks.map((block) => block.end));
  }

  const orderedBlocks = orderBlocksForAssembly(sourceBlocks, sourceDurations, {
    insertThirdIntoSecond: options.insertThirdIntoSecond,
    splitRatio: options.splitRatio,
  });

  return {
    version: 1,
    kind: "remotion-assembly",
    createdAt: new Date().toISOString(),
    rules: {
      editableOperations: ["reorder-block", "delete-block", "restore-block"],
      freeTextRewriteMapping: false,
      metadataRequired: true,
      defaultThreePartOrder: "part1 -> part2-a -> part3 -> part2-b",
    },
    sources: Object.fromEntries(sources.map((source) => [
      source.id,
      {
        id: source.id,
        label: source.label,
        path: source.path,
        transcriptPath: source.transcriptPath,
        duration: sourceDurations[source.id],
      },
    ])),
    blocks: orderedBlocks,
  };
};

const formatTime = (secondsValue) => {
  const totalMs = Math.round(secondsValue * 1000);
  const ms = totalMs % 1000;
  const totalSeconds = Math.floor(totalMs / 1000);
  const s = totalSeconds % 60;
  const m = Math.floor(totalSeconds / 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
};

export const assemblyToMarkdown = (assembly) => {
  const lines = [
    "# Assembly Draft",
    "",
    "<!-- assembly:v1; edit by moving or deleting whole block sections only. Do not edit block metadata or text. -->",
    "",
  ];

  for (const block of assembly.blocks) {
    const metadata = {
      id: block.id,
      source: block.source,
      start: block.start,
      end: block.end,
      status: block.status,
      hash: block.hash,
      group: block.group ?? null,
    };
    lines.push(`<!-- block ${JSON.stringify(metadata)} -->`);
    lines.push(`## ${block.id} · ${block.source} · ${formatTime(block.start)}-${formatTime(block.end)}`);
    lines.push("");
    lines.push(block.text);
    lines.push("");
  }

  return `${lines.join("\n").trim()}\n`;
};

export const parseAssemblyMarkdown = (markdown) => {
  const blocks = [];
  const regex = /<!-- block (\{[^\n]*\}) -->\n##[^\n]*\n\n([\s\S]*?)(?=\n<!-- block |\n?$)/g;
  let match;

  while ((match = regex.exec(markdown)) !== null) {
    const meta = JSON.parse(match[1]);
    const text = match[2].trim();
    const block = makeBlock({
      id: meta.id,
      source: meta.source,
      start: meta.start,
      end: meta.end,
      status: meta.status ?? "active",
      group: meta.group ?? null,
      text,
    });

    if (block.hash !== meta.hash) {
      throw new Error(`Block text or metadata changed for ${block.id}; V1 only supports moving/deleting whole blocks`);
    }

    blocks.push(block);
  }

  if (blocks.length === 0) {
    throw new Error("No valid assembly blocks found");
  }

  return blocks;
};

export const assemblyToEdl = (assembly) => {
  const ranges = assembly.blocks
    .filter((block) => block.status !== "deleted")
    .map((block, index) => ({
      id: `range_${String(index + 1).padStart(3, "0")}`,
      source: block.source,
      start: block.start,
      end: block.end,
      blockId: block.id,
      text: block.text,
    }));

  return {
    version: 1,
    mode: "multi-source-assembly",
    sources: Object.fromEntries(
      Object.entries(assembly.sources).map(([id, source]) => [id, source.path]),
    ),
    sourceMetadata: assembly.sources,
    ranges,
    rules: {
      neverCutInsideWord: true,
      cutBoundaryFadeMs: 30,
      sourceTraceRequired: true,
    },
    metrics: {
      rangeCount: ranges.length,
      outputDuration: Number(ranges.reduce((sum, range) => sum + range.end - range.start, 0).toFixed(3)),
    },
  };
};

export const mergeAssemblyWithMarkdownOrder = (assembly, markdown) => {
  const parsedBlocks = parseAssemblyMarkdown(markdown);
  const known = new Map(assembly.blocks.map((block) => [block.id, block]));
  const ordered = parsedBlocks.map((block) => {
    const original = known.get(block.id);
    if (!original) throw new Error(`Unknown block in markdown: ${block.id}`);
    return { ...original, status: block.status ?? original.status };
  });

  const present = new Set(ordered.map((block) => block.id));
  const deleted = assembly.blocks
    .filter((block) => !present.has(block.id))
    .map((block) => ({ ...block, status: "deleted" }));

  return {
    ...assembly,
    blocks: [...ordered, ...deleted],
  };
};

export const sourceLabelFromPath = (path) => basename(path).replace(/\.[^.]+$/, "");
