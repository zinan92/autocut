#!/usr/bin/env node
import { dirname, resolve } from "node:path";
import { mkdirSync } from "node:fs";
import { buildEdl } from "../packages/autocut/index.mjs";
import { readJson, requireFile, writeJson } from "../packages/shared/json.mjs";
import { probeMedia } from "../packages/video-ingest/index.mjs";
import { parseArgs } from "./args.mjs";

const args = parseArgs(process.argv.slice(2));
const sourceVideo = args.video ?? args._[0];
const transcriptPath = args.transcript;
const outPath = args.out ?? "remotion-host-overlay-work/edit/edl.json";

if (!sourceVideo || !transcriptPath) {
  console.error(
    "Usage: node scripts/build-edl.mjs <video> --transcript transcript.json [--out edl.json] [--silence-threshold 0.5] [--filler-mode mark|off]",
  );
  process.exit(1);
}

const source = requireFile(sourceVideo, "source video");
const transcript = readJson(requireFile(transcriptPath, "transcript"));
const probe = probeMedia(source);
const edl = buildEdl({
  sourceVideo: source,
  duration: probe.duration,
  transcript,
  options: {
    silenceThresholdSec: Number(args["silence-threshold"] ?? 0.5),
    fillerMode: args["filler-mode"] ?? "mark",
  },
});

mkdirSync(dirname(resolve(outPath)), { recursive: true });
writeJson(outPath, edl);

console.log(`EDL written: ${resolve(outPath)}`);
console.log(`Delete segments: ${edl.metrics.deleteSegmentCount}`);
console.log(`Source duration: ${edl.metrics.sourceDuration.toFixed(2)}s`);
console.log(`Output duration: ${edl.metrics.outputDuration.toFixed(2)}s`);
