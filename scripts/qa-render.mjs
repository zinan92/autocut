#!/usr/bin/env node
import { resolve } from "node:path";
import { telegramMetadata } from "../packages/delivery/index.mjs";
import { scoreRender } from "../packages/qa/index.mjs";
import { readJson, requireFile, writeJson } from "../packages/shared/json.mjs";
import { probeMedia } from "../packages/video-ingest/index.mjs";
import { parseArgs } from "./args.mjs";

const args = parseArgs(process.argv.slice(2));
const outputVideo = args._[0] ?? args.video;
const sourceVideo = args.source;
const edlPath = args.edl;
const outPath = args.out ?? "remotion-host-overlay-work/renders/qa-report.json";

if (!outputVideo || (!sourceVideo && !edlPath)) {
  console.error("Usage: node scripts/qa-render.mjs <output.mp4> --source source.mp4 [--out qa-report.json]\n   or: node scripts/qa-render.mjs <output.mp4> --edl edl.json [--out qa-report.json]");
  process.exit(1);
}

const edl = edlPath ? readJson(requireFile(edlPath, "EDL")) : null;
const firstSourcePath = sourceVideo ?? Object.values(edl.sources ?? {})[0];
const sourceProbe = probeMedia(typeof firstSourcePath === "string" ? firstSourcePath : firstSourcePath.path);
const outputProbe = probeMedia(outputVideo);
const baseReport = scoreRender({ sourceProbe, outputProbe });
const warnings = [...baseReport.warnings];

let edlChecks = null;
if (edl) {
  const expectedDuration = Number(
    edl.metrics?.outputDuration ??
    (edl.ranges ?? []).reduce((sum, range) => sum + Number(range.end) - Number(range.start), 0),
  );
  const durationDelta = Math.abs(outputProbe.duration - expectedDuration);
  const traceOk = (edl.ranges ?? []).every((range) =>
    range.source && edl.sources?.[range.source] && Number.isFinite(Number(range.start)) && Number.isFinite(Number(range.end)) && range.end > range.start,
  );
  const cutFadeMs = edl.rules?.cutBoundaryFadeMs ?? 30;

  if (durationDelta > 0.5) {
    warnings.push(`Output duration differs from EDL by ${durationDelta.toFixed(2)}s`);
  }
  if (!traceOk) {
    warnings.push("One or more EDL ranges are not traceable to source/start/end.");
  }
  if (cutFadeMs < 30) {
    warnings.push("EDL cut fade is under 30ms.");
  }

  edlChecks = {
    expectedDuration,
    actualDuration: outputProbe.duration,
    durationDelta: Number(durationDelta.toFixed(3)),
    traceOk,
    cutFadeMs,
    rangeCount: edl.ranges?.length ?? 0,
    sourceCount: Object.keys(edl.sources ?? {}).length,
  };
}

const report = {
  source: sourceProbe,
  output: outputProbe,
  ...baseReport,
  warnings,
  status: warnings.length === 0 ? "pass" : "review",
  edl: edlChecks,
  platform: {
    telegram: telegramMetadata({
      width: outputProbe.width,
      height: outputProbe.height,
      duration: outputProbe.duration,
    }),
  },
};

writeJson(outPath, report);
console.log(`QA report written: ${resolve(outPath)}`);
console.log(`Status: ${report.status}`);
console.log(`Geometry score: ${report.scores.geometry}`);
if (report.warnings.length) {
  console.log(`Warnings: ${report.warnings.join(" | ")}`);
}
