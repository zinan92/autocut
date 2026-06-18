#!/usr/bin/env node
import { storyboardFromTranscript } from "../packages/storyboard/index.mjs";
import { readJson, requireFile, writeJson } from "../packages/shared/json.mjs";
import { probeMedia } from "../packages/video-ingest/index.mjs";
import { parseArgs } from "./args.mjs";

const args = parseArgs(process.argv.slice(2));
const transcriptPath = args.transcript ?? args._[0];
const manifestPath = args.manifest ?? "workflow/manifest.json";
const outPath = args.out ?? "remotion-host-overlay-demo/src/storyboard.json";

if (!transcriptPath) {
  console.error(
    "Usage: node scripts/generate-storyboard-from-transcript.mjs --transcript transcript.json [--manifest workflow/manifest.json] [--out storyboard.json]",
  );
  process.exit(1);
}

const manifest = readJson(requireFile(manifestPath, "manifest"));
const transcript = readJson(requireFile(transcriptPath, "transcript"));
const sourceVideo = requireFile(manifest.sourceVideo, "source video");
const probe = probeMedia(sourceVideo);
const storyboard = storyboardFromTranscript({
  transcript,
  manifest,
  duration: probe.duration,
});

writeJson(outPath, storyboard);
console.log(`Storyboard written: ${outPath}`);
console.log(`Duration: ${storyboard.video.duration}s`);
console.log(`Captions: ${storyboard.captions.length}`);
console.log(`Phases: ${storyboard.phases.length}`);
