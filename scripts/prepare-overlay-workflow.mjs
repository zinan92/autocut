#!/usr/bin/env node
import { existsSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { storyboardFromEdl, timelineRangesFromEdl } from "../packages/storyboard/index.mjs";
import { probeMedia } from "../packages/video-ingest/index.mjs";
import { readJson, requireFile, writeJson } from "../packages/shared/json.mjs";
import { parseArgs } from "./args.mjs";

const args = parseArgs(process.argv.slice(2));
const videoPath = resolve(args.video ?? args.sourceVideo ?? args._[0] ?? "");
const edlPath = resolve(args.edl ?? "");
const manifestPath = args.manifest ? resolve(args.manifest) : null;
const outDir = resolve(args["out-dir"] ?? "remotion-host-overlay-work/overlay");
const outStoryboardPath = resolve(args["out-storyboard"] ?? join(outDir, "storyboard.json"));
const outManifestPath = resolve(args["out-manifest"] ?? join(outDir, "manifest.json"));

if (!args.video && !args.sourceVideo && !args._[0]) {
  console.error(
    "Usage: node scripts/prepare-overlay-workflow.mjs --video clean-master.mp4 --edl edl.json [--manifest manifest.json] [--out-dir remotion-host-overlay-work/overlay]",
  );
  process.exit(1);
}

requireFile(videoPath, "clean master video");
requireFile(edlPath, "edl");

const edl = readJson(edlPath);
const baseManifest = manifestPath && existsSync(manifestPath) ? readJson(manifestPath) : {};
const probe = probeMedia(videoPath);
const timeline = timelineRangesFromEdl(edl);
const edlDuration = timeline.at(-1)?.outputEnd ?? edl.metrics?.outputDuration;
const durationTolerance = Number(args["duration-tolerance"] ?? 0.75);
if (!Number.isFinite(edlDuration) || Math.abs(edlDuration - probe.duration) > durationTolerance) {
  throw new Error(
    `EDL duration (${edlDuration}s) does not match clean master duration (${probe.duration}s). Re-render the clean master from this EDL or pass the matching EDL.`,
  );
}
const projectName = args["project-name"] ??
  baseManifest.projectName ??
  basename(videoPath).replace(/\.[^.]+$/, "");

const storyboard = storyboardFromEdl({
  edl,
  manifest: baseManifest,
  duration: probe.duration,
});

const overlayManifest = {
  ...baseManifest,
  projectName,
  sourceVideo: videoPath,
  outputOrientation: args.orientation ?? baseManifest.outputOrientation ?? "auto",
  stylePreset: args["style-preset"] ?? baseManifest.stylePreset ?? "host-overlay-v10",
  storyboardPath: outStoryboardPath,
  cleanMaster: {
    path: videoPath,
    width: probe.width,
    height: probe.height,
    orientation: probe.orientation,
    fps: probe.fps,
    duration: probe.duration,
  },
  overlay: {
    sourceEdlPath: edlPath,
    storyboardGeneratedFrom: "edl",
    maxActivePrimaryAnimation: 1,
  },
};

writeJson(outStoryboardPath, storyboard);
writeJson(outManifestPath, overlayManifest);

console.log(`Overlay manifest: ${outManifestPath}`);
console.log(`Storyboard: ${outStoryboardPath}`);
console.log(`Video: ${videoPath}`);
console.log(`Duration: ${storyboard.video.duration}s`);
console.log(`Captions: ${storyboard.captions.length}`);
console.log(`Phases: ${storyboard.phases.length}`);
