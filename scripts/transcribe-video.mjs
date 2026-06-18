#!/usr/bin/env node
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { resolveManifestSources } from "../packages/assembly/index.mjs";
import { readJson, writeJson } from "../packages/shared/json.mjs";
import { run } from "../packages/shared/process.mjs";
import { parseArgs } from "./args.mjs";

const args = parseArgs(process.argv.slice(2));
const manifestPath = args.manifest ? resolve(args.manifest) : null;
const input = args._[0] ?? args.input;
const outDir = resolve(args["out-dir"] ?? "remotion-host-overlay-work/transcripts");
const reuse = args.reuse;
const model = args.model ?? "mlx-community/whisper-large-v3-turbo";

if (!input && !manifestPath) {
  console.error(
    "Usage: node scripts/transcribe-video.mjs <video> [--reuse transcript.json] [--out-dir transcript-dir]\n   or: node scripts/transcribe-video.mjs --manifest workflow/manifest.json",
  );
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });

const transcribeOne = ({ sourceId, videoPath, reusePath = null }) => {
  const targetDir = resolve(outDir, sourceId);
  mkdirSync(targetDir, { recursive: true });
  const transcriptPath = join(targetDir, "transcript.json");

  if (existsSync(transcriptPath) && !args.force) {
    return { sourceId, status: "cached", transcriptPath };
  }

  if (reusePath) {
    if (!existsSync(reusePath)) {
      throw new Error(`Reusable transcript not found: ${reusePath}`);
    }
    copyFileSync(reusePath, transcriptPath);
    return { sourceId, status: "reused", transcriptPath };
  }

  const python = process.env.MLX_WHISPER_PYTHON ?? "python3";
  run(python, [
    "scripts/mlx-transcribe.py",
    resolve(videoPath),
    "--out-dir",
    targetDir,
    "--model",
    model,
    "--language",
    args.language ?? "zh",
  ], { stdio: "inherit" });

  return { sourceId, status: "transcribed", transcriptPath };
};

const outputs = [];

if (manifestPath) {
  const manifest = readJson(manifestPath);
  const sources = resolveManifestSources(manifest, manifestPath);
  for (const source of sources) {
    outputs.push(transcribeOne({
      sourceId: source.id,
      videoPath: source.path,
      reusePath: source.transcriptPath && existsSync(source.transcriptPath)
        ? source.transcriptPath
        : null,
    }));
  }
} else {
  outputs.push(transcribeOne({
    sourceId: args.source ?? "part1",
    videoPath: input,
    reusePath: reuse ? resolve(reuse) : null,
  }));
}

const summaryPath = join(outDir, "transcribe-summary.json");
writeJson(summaryPath, {
  status: "complete",
  outDir,
  model,
  outputs,
});

console.log(`Transcription summary: ${summaryPath}`);
for (const output of outputs) {
  console.log(`${output.sourceId}: ${output.status} -> ${output.transcriptPath}`);
}
