#!/usr/bin/env node
import { existsSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { resolveManifestSources } from "../packages/assembly/index.mjs";
import { readJson, requireFile, writeJson } from "../packages/shared/json.mjs";
import { run } from "../packages/shared/process.mjs";
import { probeMedia } from "../packages/video-ingest/index.mjs";
import { parseArgs } from "./args.mjs";

const args = parseArgs(process.argv.slice(2));
const manifestPath = resolve(args.manifest ?? args._[0] ?? "workflow/manifest.json");
const outDir = resolve(args["out-dir"] ?? "remotion-host-overlay-work/proxies");
const manifestExt = extname(manifestPath) || ".json";
const manifestBase = basename(manifestPath, manifestExt);
const outManifestPath = resolve(
  args["out-manifest"] ?? join(dirname(manifestPath), `${manifestBase}.proxy${manifestExt}`),
);
const maxLongSide = Number(args["max-long-side"] ?? args.size ?? 1280);
const crf = String(args.crf ?? 23);
const preset = String(args.preset ?? "veryfast");
const audioBitrate = String(args["audio-bitrate"] ?? "128k");

if (!Number.isFinite(maxLongSide) || maxLongSide < 2) {
  throw new Error(`Invalid --max-long-side: ${args["max-long-side"] ?? args.size}`);
}

const even = (value) => Math.max(2, Math.round(value / 2) * 2);

const targetDimensions = (probe) => {
  const width = Number(probe.width);
  const height = Number(probe.height);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error(`Could not determine source dimensions for ${probe.path}`);
  }

  if (width >= height) {
    const targetWidth = even(Math.min(width, maxLongSide));
    return {
      width: targetWidth,
      height: even((targetWidth * height) / width),
    };
  }

  const targetHeight = even(Math.min(height, maxLongSide));
  return {
    width: even((targetHeight * width) / height),
    height: targetHeight,
  };
};

const manifest = readJson(requireFile(manifestPath, "manifest"));
const sources = resolveManifestSources(manifest, manifestPath);
const outputs = [];

run("mkdir", ["-p", outDir]);

for (const source of sources) {
  const probe = probeMedia(source.path);
  const target = targetDimensions(probe);
  const proxyPath = resolve(outDir, `${source.id}.mp4`);
  const cached = existsSync(proxyPath) && !args.force;

  if (!cached) {
    const targetFps = probe.fps ?? String(probe.fpsNumber);
    if (!targetFps || targetFps === "0/0") {
      throw new Error(`Could not determine source FPS for ${source.id}`);
    }

    run("ffmpeg", [
      "-y",
      "-i",
      source.path,
      "-vf",
      `scale=${target.width}:${target.height}:flags=lanczos,setsar=1`,
      "-r",
      targetFps,
      "-c:v",
      "libx264",
      "-preset",
      preset,
      "-crf",
      crf,
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-b:a",
      audioBitrate,
      "-ar",
      "48000",
      "-ac",
      "2",
      "-movflags",
      "+faststart",
      proxyPath,
    ], { stdio: "inherit" });
  }

  const proxyProbe = probeMedia(proxyPath);
  outputs.push({
    sourceId: source.id,
    status: cached ? "cached" : "created",
    originalPath: source.path,
    proxyPath,
    transcriptPath: source.transcriptPath,
    original: {
      width: probe.width,
      height: probe.height,
      orientation: probe.orientation,
      duration: probe.duration,
      fps: probe.fps,
    },
    proxy: {
      width: proxyProbe.width,
      height: proxyProbe.height,
      orientation: proxyProbe.orientation,
      duration: proxyProbe.duration,
      fps: proxyProbe.fps,
    },
  });
}

const proxySources = outputs.map((output) => ({
  id: output.sourceId,
  label: output.sourceId,
  path: output.proxyPath,
  transcriptPath: output.transcriptPath,
}));

const proxyManifest = {
  ...manifest,
  sources: proxySources,
  proxy: {
    generatedFrom: manifestPath,
    maxLongSide,
    crf,
    preset,
    audioBitrate,
    outputs,
  },
};

delete proxyManifest.sourceVideo;
delete proxyManifest.transcriptPath;

if (!Array.isArray(manifest.sources) && proxySources.length === 1) {
  proxyManifest.sourceVideo = proxySources[0].path;
  proxyManifest.transcriptPath = proxySources[0].transcriptPath;
}

writeJson(outManifestPath, proxyManifest);

console.log(`Proxy manifest written: ${outManifestPath}`);
for (const output of outputs) {
  console.log(
    `${output.sourceId}: ${output.status} ${output.original.width}x${output.original.height} -> ${output.proxy.width}x${output.proxy.height} ${output.proxyPath}`,
  );
}
