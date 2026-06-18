import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  assemblyToEdl,
  assemblyToMarkdown,
  buildAssembly,
  parseAssemblyMarkdown,
} from "../packages/assembly/index.mjs";

const writeTranscript = (dir, name, segments) => {
  const path = join(dir, `${name}.json`);
  writeFileSync(path, JSON.stringify({ segments }, null, 2), "utf8");
  return path;
};

test("three-part assembly defaults to part1 -> part2-a -> part3 -> part2-b", () => {
  const dir = mkdtempSync(join(tmpdir(), "assembly-test-"));
  const p1 = writeTranscript(dir, "part1", [
    { start: 0, end: 10, text: "第一段" },
  ]);
  const p2 = writeTranscript(dir, "part2", [
    { start: 0, end: 20, text: "第二段前面" },
    { start: 20, end: 80, text: "第二段中间" },
    { start: 80, end: 100, text: "第二段结尾" },
  ]);
  const p3 = writeTranscript(dir, "part3", [
    { start: 0, end: 12, text: "第三段补充" },
  ]);

  const manifest = {
    sources: [
      { id: "part1", path: "/tmp/part1.mp4", transcriptPath: p1 },
      { id: "part2", path: "/tmp/part2.mp4", transcriptPath: p2 },
      { id: "part3", path: "/tmp/part3.mp4", transcriptPath: p3 },
    ],
    assembly: { insertThirdIntoSecond: true, splitRatio: 0.8, maxBlockSeconds: 19 },
  };

  const assembly = buildAssembly({
    manifest,
    manifestPath: join(dir, "manifest.json"),
    sourceProbes: {
      part1: { duration: 10 },
      part2: { duration: 100 },
      part3: { duration: 12 },
    },
    options: manifest.assembly,
  });

  assert.deepEqual(
    assembly.blocks.map((block) => block.source),
    ["part1", "part2", "part2", "part3", "part2"],
  );
  assert.equal(assembly.blocks[1].group, "part2-a");
  assert.equal(assembly.blocks.at(-1).group, "part2-b");
});

test("assembly exports traceable multi-source EDL", () => {
  const assembly = {
    sources: {
      part1: { path: "/tmp/part1.mp4" },
      part2: { path: "/tmp/part2.mp4" },
    },
    blocks: [
      { id: "a", source: "part1", start: 0, end: 2, text: "A", status: "active" },
      { id: "b", source: "part2", start: 3, end: 5, text: "B", status: "deleted" },
      { id: "c", source: "part2", start: 5, end: 8, text: "C", status: "active" },
    ],
  };
  const edl = assemblyToEdl(assembly);
  assert.deepEqual(Object.keys(edl.sources), ["part1", "part2"]);
  assert.deepEqual(edl.ranges.map((range) => range.blockId), ["a", "c"]);
  assert.equal(edl.metrics.outputDuration, 5);
});

test("assembly markdown rejects text edits", () => {
  const assembly = {
    blocks: [
      {
        id: "part1_001",
        source: "part1",
        start: 0,
        end: 2,
        text: "原文",
        status: "active",
        hash: "placeholder",
      },
    ],
  };
  const block = {
    id: "part1_001",
    source: "part1",
    start: 0,
    end: 2,
    text: "原文",
    status: "active",
  };
  const md = assemblyToMarkdown({ ...assembly, blocks: [block] });
  assert.throws(() => parseAssemblyMarkdown(md.replace("原文", "改写")), /changed/);
});
