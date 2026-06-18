import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { probeMedia } from "../packages/video-ingest/index.mjs";

const hasFfmpeg = spawnSync("ffmpeg", ["-version"], { encoding: "utf8" }).status === 0;
const proxyScript = resolve("scripts/proxy-sources.mjs");

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
    ...options,
  });
  if (result.status !== 0 && !options.allowFailure) {
    throw new Error(
      [
        `${command} ${args.join(" ")} failed`,
        result.stdout,
        result.stderr,
      ].filter(Boolean).join("\n"),
    );
  }
  return result;
};

const makeClip = (path, { size, fps = 30, duration = 0.5 }) => {
  run("ffmpeg", [
    "-y",
    "-f",
    "lavfi",
    "-i",
    `color=c=red:s=${size}:r=${fps}:d=${duration}`,
    "-f",
    "lavfi",
    "-i",
    `sine=frequency=440:duration=${duration}`,
    "-shortest",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-ar",
    "48000",
    "-ac",
    "2",
    path,
  ]);
};

test("proxy-sources preserves portrait orientation and writes proxy manifest", { skip: !hasFfmpeg }, () => {
  const dir = mkdtempSync(join(tmpdir(), "proxy-sources-test-"));
  const sourcePath = join(dir, "portrait.mp4");
  const transcriptPath = join(dir, "transcript.json");
  const manifestPath = join(dir, "manifest.json");
  const outManifestPath = join(dir, "manifest.proxy.json");
  const outDir = join(dir, "proxies");

  makeClip(sourcePath, { size: "720x1280" });
  writeFileSync(transcriptPath, JSON.stringify({ segments: [] }), "utf8");
  writeFileSync(manifestPath, JSON.stringify({
    projectName: "proxy-test",
    sources: [
      { id: "part1", path: sourcePath, transcriptPath },
    ],
  }, null, 2), "utf8");

  run(process.execPath, [
    proxyScript,
    "--manifest",
    manifestPath,
    "--out-dir",
    outDir,
    "--out-manifest",
    outManifestPath,
    "--max-long-side",
    "640",
  ]);

  assert.equal(existsSync(outManifestPath), true);
  const proxyManifest = JSON.parse(readFileSync(outManifestPath, "utf8"));
  assert.equal(proxyManifest.sources.length, 1);
  assert.equal(proxyManifest.sources[0].transcriptPath, transcriptPath);

  const proxyProbe = probeMedia(proxyManifest.sources[0].path);
  assert.equal(proxyProbe.orientation, "vertical");
  assert.equal(proxyProbe.width, 360);
  assert.equal(proxyProbe.height, 640);
  assert.equal(proxyProbe.video.sampleAspectRatio, "1:1");
  assert.equal(proxyProbe.audio.codec, "aac");
});
