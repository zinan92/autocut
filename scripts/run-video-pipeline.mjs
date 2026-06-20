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

const shouldPrepareOverlay =
  args.overlay === true ||
  args["prepare-overlay"] === true ||
  args["render-overlay"] === true;
const shouldRenderOverlay = args["render-overlay"] === true;
const shouldRenderEdl = args["render-edl"] === true || shouldPrepareOverlay;

const renderWorkflowArgs = (renderManifestPath, reportPath) => {
  const renderArgs = ["scripts/render-workflow.mjs", renderManifestPath];
  const valueFlags = [
    "preview-seconds",
    "segment-seconds",
    "segment-threshold-seconds",
    "long-render-threshold-seconds",
  ];
  const booleanFlags = ["segment-render", "allow-long-render"];

  for (const flag of valueFlags) {
    if (args[flag] !== undefined && args[flag] !== true) {
      renderArgs.push(`--${flag}`, String(args[flag]));
    }
  }

  for (const flag of booleanFlags) {
    if (args[flag] === true) {
      renderArgs.push(`--${flag}`);
    }
  }

  if (reportPath) {
    renderArgs.push("--report", reportPath);
  }

  return renderArgs;
};

const runRemotionRender = (renderManifestPath, reportPath) => {
  run("node", renderWorkflowArgs(renderManifestPath, reportPath), { stdio: "inherit" });
  return existsSync(reportPath) ? readJson(reportPath) : null;
};

const steps = [
  { step: "ingest", status: "pending", output: join(sessionDir, "ingest.json") },
];

const hasMultiSourceManifest = Array.isArray(manifest.sources) && manifest.sources.length > 0;
let sourceVideo = null;
let ingest = null;
let edlPath = null;
let cutPath = null;
let overlayManifestPath = null;

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

  const missingTranscript = sources.find(
    (source) => !source.transcriptPath || !existsSync(source.transcriptPath),
  );
  if (missingTranscript) {
    steps.push({
      step: "assembly",
      status: "blocked",
      reason: `Transcript missing for ${missingTranscript.id}: ${missingTranscript.transcriptPath ?? "(none)"}`,
    });
  } else {
    const assemblyDir = join(sessionDir, "assembly");
    edlPath = join(sessionDir, "edl.json");
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

    if (shouldRenderEdl) {
      cutPath = join(sessionDir, "cut.mp4");
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
    edlPath = join(sessionDir, "edl.json");
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

    if (shouldRenderEdl) {
      cutPath = join(sessionDir, "cut.mp4");
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

if (shouldPrepareOverlay) {
  if (!edlPath || !cutPath || !existsSync(cutPath)) {
    steps.push({
      step: "overlay-prepare",
      status: "blocked",
      reason: "Overlay preparation requires a rendered clean master. Run with --render-edl or --render-overlay.",
    });
  } else {
    const overlayDir = resolve(args["overlay-dir"] ?? join(sessionDir, "overlay"));
    overlayManifestPath = join(overlayDir, "manifest.json");
    const overlayStoryboardPath = join(overlayDir, "storyboard.json");
    run("node", [
      "scripts/prepare-overlay-workflow.mjs",
      "--video",
      cutPath,
      "--edl",
      edlPath,
      "--manifest",
      manifestPath,
      "--out-dir",
      overlayDir,
      "--project-name",
      `${projectName}-overlay`,
    ], { stdio: "inherit" });
    steps.push({
      step: "overlay-prepare",
      status: "done",
      output: overlayManifestPath,
      storyboard: overlayStoryboardPath,
    });
  }
}

if (shouldRenderOverlay) {
  if (!overlayManifestPath || !existsSync(overlayManifestPath)) {
    steps.push({
      step: "remotion-overlay-render",
      status: "blocked",
      reason: "Overlay manifest missing. Prepare overlay before rendering.",
    });
  } else {
    const reportPath = join(sessionDir, "overlay-render-report.json");
    const report = runRemotionRender(overlayManifestPath, reportPath);
    steps.push({
      step: "remotion-overlay-render",
      status: "done",
      output: report?.output ?? null,
      report: reportPath,
      segmentReport: report?.segmentReport ?? null,
      renderMode: report?.renderMode ?? null,
    });
  }
}

if (args.render) {
  const reportPath = join(sessionDir, "render-report.json");
  const report = runRemotionRender(manifestPath, reportPath);
  steps.push({
    step: "remotion-render",
    status: "done",
    output: report?.output ?? null,
    report: reportPath,
    segmentReport: report?.segmentReport ?? null,
    renderMode: report?.renderMode ?? null,
  });
}

const summary = {
  projectName,
  sessionDir,
  sourceVideo,
  orientation: ingest.orientation,
  duration: ingest.duration,
  edlPath,
  cutPath,
  overlayManifestPath,
  steps,
};
writeJson(join(sessionDir, "pipeline-summary.json"), summary);
console.log(JSON.stringify(summary, null, 2));
