#!/usr/bin/env node
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { buildKeepRanges } from "../packages/edl/index.mjs";
import { readJson, requireFile } from "../packages/shared/json.mjs";
import { run } from "../packages/shared/process.mjs";
import { probeMedia } from "../packages/video-ingest/index.mjs";
import { parseArgs } from "./args.mjs";

const args = parseArgs(process.argv.slice(2));
const edlPath = args._[0] ?? args.edl;
const outPath = args.out ?? "remotion-host-overlay-work/edit/cut.mp4";

if (!edlPath) {
  console.error("Usage: node scripts/render-edl.mjs <edl.json> [--out cut.mp4]");
  process.exit(1);
}

const edl = readJson(requireFile(edlPath, "EDL"));
const rawSources = edl.sources ?? (edl.sourceVideo ? { main: edl.sourceVideo } : {});
const sources = Object.fromEntries(
  Object.entries(rawSources).map(([id, value]) => [
    id,
    requireFile(typeof value === "string" ? value : value.path, `source video ${id}`),
  ]),
);
const ranges = edl.ranges?.length
  ? edl.ranges
  : buildKeepRanges(edl.metrics?.sourceDuration ?? 0, edl.deleteSegments ?? []);

if (!ranges.length) {
  throw new Error("EDL has no keep ranges");
}

const sourceIds = new Set(ranges.map((range) => range.source ?? "main"));
for (const sourceId of sourceIds) {
  if (!sources[sourceId]) {
    throw new Error(`Range references unknown source: ${sourceId}`);
  }
}

const probes = Object.fromEntries(
  [...sourceIds].map((sourceId) => [sourceId, probeMedia(sources[sourceId])]),
);
const firstProbe = probes[[...sourceIds][0]];
for (const [sourceId, probe] of Object.entries(probes)) {
  if (probe.orientation !== firstProbe.orientation || probe.width !== firstProbe.width || probe.height !== firstProbe.height) {
    throw new Error(
      `Source geometry mismatch for ${sourceId}: ${probe.width}x${probe.height} ${probe.orientation}, expected ${firstProbe.width}x${firstProbe.height} ${firstProbe.orientation}`,
    );
  }
}

run("mkdir", ["-p", dirname(resolve(outPath))]);

if ((edl.deleteSegments ?? []).length === 0 && ranges.length === 1 && sourceIds.size === 1) {
  const range = ranges[0];
  const sourceVideo = sources[range.source ?? "main"];
  const sourceProbe = probes[range.source ?? "main"];
  const isWholeSource = Number(range.start) <= 0.001 && Math.abs(Number(range.end) - sourceProbe.duration) <= 0.15;
  if (!isWholeSource) {
    // Fall through to extraction for partial single-source ranges.
  } else {
  run("ffmpeg", [
    "-y",
    "-i",
    sourceVideo,
    "-c",
    "copy",
    "-movflags",
    "+faststart",
    resolve(outPath),
  ], { stdio: "inherit" });
  console.log(`No cuts. Copied source to: ${resolve(outPath)}`);
  process.exit(0);
  }
}

const tmp = mkdtempSync(join(tmpdir(), "remotion-edl-"));
const concatPath = join(tmp, "concat.txt");
const partPaths = [];

for (let i = 0; i < ranges.length; i += 1) {
  const range = ranges[i];
  const sourceVideo = sources[range.source ?? "main"];
  const duration = Number(range.end) - Number(range.start);
  const partPath = join(tmp, `${String(i).padStart(4, "0")}_${basename(sourceVideo)}.mp4`);
  const fadeOutStart = Math.max(0, duration - 0.03);

  run("ffmpeg", [
    "-y",
    "-ss",
    Number(range.start).toFixed(3),
    "-i",
    sourceVideo,
    "-t",
    duration.toFixed(3),
    "-vf",
    "setsar=1,format=yuv420p",
    "-af",
    `afade=t=in:st=0:d=0.03,afade=t=out:st=${fadeOutStart.toFixed(3)}:d=0.03`,
    "-c:v",
    "libx264",
    "-preset",
    "fast",
    "-crf",
    "20",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-ar",
    "48000",
    "-movflags",
    "+faststart",
    partPath,
  ], { stdio: "inherit" });

  partPaths.push(partPath);
}

writeFileSync(concatPath, partPaths.map((path) => `file '${path}'`).join("\n"), "utf8");

run("ffmpeg", [
  "-y",
  "-f",
  "concat",
  "-safe",
  "0",
  "-i",
  concatPath,
  "-c",
  "copy",
  "-movflags",
  "+faststart",
  resolve(outPath),
], { stdio: "inherit" });

readFileSync(concatPath, "utf8");
console.log(`EDL render complete: ${resolve(outPath)}`);
