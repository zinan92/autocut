import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { probeMedia } from "../packages/video-ingest/index.mjs";

const hasFfmpeg = spawnSync("ffmpeg", ["-version"], { encoding: "utf8" }).status === 0;
const renderScript = resolve("scripts/render-edl.mjs");
const qaScript = resolve("scripts/qa-render.mjs");
const pipelineScript = resolve("scripts/run-video-pipeline.mjs");

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

const makeClip = (path, { color, fps, frequency, duration = 1 }) => {
  run("ffmpeg", [
    "-y",
    "-f",
    "lavfi",
    "-i",
    `color=c=${color}:s=160x120:r=${fps}:d=${duration}`,
    "-f",
    "lavfi",
    "-i",
    `sine=frequency=${frequency}:duration=${duration}`,
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

test("render-edl renders traceable multi-source EDL and passes QA", { skip: !hasFfmpeg }, () => {
  const dir = mkdtempSync(join(tmpdir(), "render-edl-test-"));
  const part1 = join(dir, "part1.mp4");
  const part2 = join(dir, "part2.mp4");
  const part3 = join(dir, "part3.mp4");
  makeClip(part1, { color: "red", fps: 30, frequency: 440 });
  makeClip(part2, { color: "green", fps: 30, frequency: 550 });
  makeClip(part3, { color: "blue", fps: 30, frequency: 660 });

  const edlPath = join(dir, "edl.json");
  const outPath = join(dir, "clean-master.mp4");
  const qaPath = join(dir, "qa-report.json");
  writeFileSync(edlPath, JSON.stringify({
    version: 1,
    mode: "multi-source-assembly",
    sources: { part1, part2, part3 },
    ranges: [
      { id: "range_001", source: "part1", start: 0, end: 0.45, blockId: "part1_001" },
      { id: "range_002", source: "part2", start: 0, end: 0.45, blockId: "part2_001" },
      { id: "range_003", source: "part3", start: 0, end: 0.45, blockId: "part3_001" },
    ],
    rules: { cutBoundaryFadeMs: 30 },
    metrics: { outputDuration: 1.35 },
  }, null, 2), "utf8");

  run(process.execPath, [renderScript, edlPath, "--out", outPath]);
  assert.equal(existsSync(outPath), true);
  const probe = probeMedia(outPath);
  assert.equal(probe.width, 160);
  assert.equal(probe.height, 120);
  assert.equal(probe.video.codec, "h264");
  assert.equal(probe.audio.codec, "aac");

  run(process.execPath, [qaScript, outPath, "--edl", edlPath, "--out", qaPath]);
  assert.equal(existsSync(qaPath), true);
});

test("render-edl keeps duration stable across many short ranges", { skip: !hasFfmpeg }, () => {
  const dir = mkdtempSync(join(tmpdir(), "render-edl-many-ranges-test-"));
  const part1 = join(dir, "part1.mp4");
  makeClip(part1, { color: "red", fps: 30, frequency: 440, duration: 7 });

  const ranges = Array.from({ length: 60 }, (_, index) => {
    const start = index * 0.1;
    const end = start + 0.06;
    return {
      id: `range_${String(index + 1).padStart(3, "0")}`,
      source: "part1",
      start,
      end,
      blockId: `part1_${String(index + 1).padStart(3, "0")}`,
    };
  });
  const expectedDuration = ranges.reduce((sum, range) => sum + range.end - range.start, 0);

  const edlPath = join(dir, "edl.json");
  const outPath = join(dir, "clean-master.mp4");
  const qaPath = join(dir, "qa-report.json");
  writeFileSync(edlPath, JSON.stringify({
    version: 1,
    mode: "multi-source-assembly",
    sources: { part1 },
    ranges,
    rules: { cutBoundaryFadeMs: 30 },
    metrics: { outputDuration: expectedDuration },
  }, null, 2), "utf8");

  run(process.execPath, [renderScript, edlPath, "--out", outPath]);
  const probe = probeMedia(outPath);
  assert.ok(
    Math.abs(probe.duration - expectedDuration) < 0.2,
    `expected ${expectedDuration}s, got ${probe.duration}s`,
  );

  run(process.execPath, [qaScript, outPath, "--edl", edlPath, "--out", qaPath]);
  const qa = JSON.parse(readFileSync(qaPath, "utf8"));
  assert.equal(qa.status, "pass");
});

test("render-edl rejects mixed source FPS before rendering", { skip: !hasFfmpeg }, () => {
  const dir = mkdtempSync(join(tmpdir(), "render-edl-fps-test-"));
  const part1 = join(dir, "part1.mp4");
  const part2 = join(dir, "part2.mp4");
  makeClip(part1, { color: "red", fps: 30, frequency: 440 });
  makeClip(part2, { color: "green", fps: 60, frequency: 550 });

  const edlPath = join(dir, "edl.json");
  const outPath = join(dir, "bad.mp4");
  writeFileSync(edlPath, JSON.stringify({
    version: 1,
    mode: "multi-source-assembly",
    sources: { part1, part2 },
    ranges: [
      { id: "range_001", source: "part1", start: 0, end: 0.45, blockId: "part1_001" },
      { id: "range_002", source: "part2", start: 0, end: 0.45, blockId: "part2_001" },
    ],
    rules: { cutBoundaryFadeMs: 30 },
    metrics: { outputDuration: 0.9 },
  }, null, 2), "utf8");

  const result = run(process.execPath, [renderScript, edlPath, "--out", outPath], {
    allowFailure: true,
  });
  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}\n${result.stderr}`, /FPS mismatch/);
});

test("pipeline uses multi-source assembly path for sources manifests", { skip: !hasFfmpeg }, () => {
  const dir = mkdtempSync(join(tmpdir(), "pipeline-multi-source-test-"));
  const part1 = join(dir, "part1.mp4");
  const part2 = join(dir, "part2.mp4");
  const part3 = join(dir, "part3.mp4");
  makeClip(part1, { color: "red", fps: 30, frequency: 440 });
  makeClip(part2, { color: "green", fps: 30, frequency: 550 });
  makeClip(part3, { color: "blue", fps: 30, frequency: 660 });

  const writeTranscript = (name, segments) => {
    const path = join(dir, `${name}.json`);
    writeFileSync(path, JSON.stringify({ segments }, null, 2), "utf8");
    return path;
  };

  const t1 = writeTranscript("part1", [
    { start: 0, end: 0.5, text: "第一段。" },
  ]);
  const t2 = writeTranscript("part2", [
    { start: 0, end: 0.5, text: "第二段前面。" },
    { start: 0.5, end: 1, text: "第二段结尾。" },
  ]);
  const t3 = writeTranscript("part3", [
    { start: 0, end: 0.5, text: "第三段。" },
  ]);

  const manifestPath = join(dir, "manifest.json");
  const sessionDir = join(dir, "session");
  writeFileSync(manifestPath, JSON.stringify({
    projectName: "pipeline-multi-source",
    sources: [
      { id: "part1", path: part1, transcriptPath: t1 },
      { id: "part2", path: part2, transcriptPath: t2 },
      { id: "part3", path: part3, transcriptPath: t3 },
    ],
    assembly: { insertThirdIntoSecond: true, splitRatio: 0.8 },
  }, null, 2), "utf8");

  run(process.execPath, [
    pipelineScript,
    manifestPath,
    "--session",
    sessionDir,
    "--render-edl",
  ]);

  const assemblyPath = join(sessionDir, "assembly", "assembly.json");
  const edlPath = join(sessionDir, "edl.json");
  const cutPath = join(sessionDir, "cut.mp4");
  assert.equal(existsSync(assemblyPath), true);
  assert.equal(existsSync(edlPath), true);
  assert.equal(existsSync(cutPath), true);

  const edl = JSON.parse(readFileSync(edlPath, "utf8"));
  assert.deepEqual(edl.ranges.map((range) => range.source), [
    "part1",
    "part2",
    "part3",
    "part2",
  ]);
});
