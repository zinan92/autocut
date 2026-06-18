#!/usr/bin/env node
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { resolveManifestSources } from "../packages/assembly/index.mjs";
import { readJson, writeJson } from "../packages/shared/json.mjs";
import { run } from "../packages/shared/process.mjs";
import { probeMedia } from "../packages/video-ingest/index.mjs";
import { parseArgs } from "./args.mjs";

const args = parseArgs(process.argv.slice(2));
const manifestPath = resolve(args._[0] ?? args.manifest ?? "workflow/manifest.json");

if (!existsSync(manifestPath)) {
  console.error(`Manifest not found: ${manifestPath}`);
  process.exit(1);
}

const manifest = readJson(manifestPath);
const projectName = manifest.projectName ?? "host-overlay";
const sessionDir = resolve(
  args.session ?? join("remotion-host-overlay-work", "sessions", projectName),
);
mkdirSync(sessionDir, { recursive: true });

const steps = [
  { step: "ingest", status: "pending", output: join(sessionDir, "ingest.json") },
];

const hasMultiSourceManifest = Array.isArray(manifest.sources) && manifest.sources.length > 0;
let sourceVideo = null;
let ingest = null;

if (hasMultiSourceManifest) {
  const sources = resolveManifestSources(manifest, manifestPath);
  const sourceProbes = Object.fromEntries(
    sources.map((source) => [source.id, probeMedia(source.path)]),
  );
  ingest = {
    mode: "multi-source",
    sourceCount: sources.length,
    sources: sourceProbes,
    orientation: Object.values(sourceProbes)[0]?.orientation ?? null,
    duration: Object.values(sourceProbes).reduce((sum, probe) => sum + probe.duration, 0),
  };
  writeJson(join(sessionDir, "ingest.json"), ingest);
  steps[0] = { ...steps[0], status: "done" };

  const missingTranscript = sources.find((source) => !source.transcriptPath || !existsSync(source.transcriptPath));
  if (missingTranscript) {
    steps.push({
      step: "assembly",
      status: "blocked",
      reason: `Transcript missing for ${missingTranscript.id}: ${missingTranscript.transcriptPath ?? "(none)"}`,
    });
  } else {
    const assemblyDir = join(sessionDir, "assembly");
    const edlPath = join(sessionDir, "edl.json");
    run("node", [
      "scripts/build-assembly.mjs",
      "--manifest",
      manifestPath,
      "--out-dir",
      assemblyDir,
    ], { stdio: "inherit" });
    steps.push({
      step: "assembly",
      status: "done",
      output: join(assemblyDir, "assembly.json"),
    });

    run("node", [
      "scripts/export-assembly-edl.mjs",
      "--assembly",
      join(assemblyDir, "assembly.json"),
      "--out",
      edlPath,
    ], { stdio: "inherit" });
    steps.push({ step: "multi-source-edl", status: "done", output: edlPath });

    if (args["render-edl"]) {
      const cutPath = join(sessionDir, "cut.mp4");
      run("node", ["scripts/render-edl.mjs", edlPath, "--out", cutPath], {
        stdio: "inherit",
      });
      steps.push({ step: "edl-render", status: "done", output: cutPath });
    }
  }
} else {
  sourceVideo = resolve(dirname(manifestPath), manifest.sourceVideo);
  ingest = probeMedia(sourceVideo);
  writeJson(join(sessionDir, "ingest.json"), ingest);
  steps[0] = { ...steps[0], status: "done" };

  const transcriptPath =
    args.transcript ??
    manifest.transcriptPath ??
    (existsSync("remotion-host-overlay-work/transcript/source.json")
      ? "remotion-host-overlay-work/transcript/source.json"
      : null);

  if (transcriptPath && existsSync(transcriptPath)) {
  const edlPath = join(sessionDir, "edl.json");
  run("node", [
    "scripts/build-edl.mjs",
    sourceVideo,
    "--transcript",
    transcriptPath,
    "--out",
    edlPath,
    "--silence-threshold",
    String(manifest.autocut?.silenceThresholdSec ?? 0.5),
    "--filler-mode",
    manifest.autocut?.fillerMode ?? "mark",
  ], { stdio: "inherit" });
  steps.push({ step: "autocut-edl", status: "done", output: edlPath });

  if (args["render-edl"]) {
    const cutPath = join(sessionDir, "cut.mp4");
    run("node", ["scripts/render-edl.mjs", edlPath, "--out", cutPath], {
      stdio: "inherit",
    });
    steps.push({ step: "edl-render", status: "done", output: cutPath });
  }

  if (args.storyboard) {
    const storyboardPath = join(sessionDir, "storyboard.json");
    run("node", [
      "scripts/generate-storyboard-from-transcript.mjs",
      "--transcript",
      transcriptPath,
      "--manifest",
      manifestPath,
      "--out",
      storyboardPath,
    ], { stdio: "inherit" });
    steps.push({ step: "storyboard", status: "done", output: storyboardPath });
  }
  } else {
    steps.push({
      step: "transcribe",
      status: "blocked",
      reason: "No transcript path found. Add manifest.transcriptPath or run ASR first.",
    });
  }
}

if (args.render) {
  run("node", ["scripts/render-workflow.mjs", manifestPath], { stdio: "inherit" });
  steps.push({ step: "remotion-render", status: "done" });
}

const summary = {
  projectName,
  sessionDir,
  sourceVideo,
  orientation: ingest.orientation,
  duration: ingest.duration,
  steps,
};
writeJson(join(sessionDir, "pipeline-summary.json"), summary);
console.log(JSON.stringify(summary, null, 2));
