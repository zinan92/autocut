import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  applyAssemblyEdit,
  assemblyToEdl,
  assemblyToMarkdown,
  buildAssembly,
  makeBlock,
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
      makeBlock({ id: "a", source: "part1", start: 0, end: 2, text: "A", status: "active" }),
      makeBlock({ id: "b", source: "part2", start: 3, end: 5, text: "B", status: "deleted" }),
      makeBlock({ id: "c", source: "part2", start: 5, end: 8, text: "C", status: "active" }),
    ],
  };
  const edl = assemblyToEdl(assembly);
  assert.deepEqual(Object.keys(edl.sources), ["part1", "part2"]);
  assert.deepEqual(edl.ranges.map((range) => range.blockId), ["a", "c"]);
  assert.equal(edl.metrics.outputDuration, 5);
});

test("assembly markdown rejects text edits", () => {
  const block = makeBlock({
    id: "part1_001",
    source: "part1",
    start: 0,
    end: 2,
    text: "原文",
    status: "active",
  });
  const md = assemblyToMarkdown({ blocks: [block] });
  assert.equal(parseAssemblyMarkdown(md)[0].text, "原文");
  assert.throws(() => parseAssemblyMarkdown(md.replace("原文", "改写")), /changed/);
});

test("assembly JSON edits allow reorder/delete but reject immutable changes", () => {
  const a = makeBlock({
    id: "part1_001",
    source: "part1",
    start: 0,
    end: 2,
    text: "第一块",
    status: "active",
  });
  const b = makeBlock({
    id: "part2_001",
    source: "part2",
    start: 3,
    end: 5,
    text: "第二块",
    status: "active",
  });
  const base = {
    sources: {
      part1: { path: "/tmp/part1.mp4" },
      part2: { path: "/tmp/part2.mp4" },
    },
    blocks: [a, b],
  };

  const edited = applyAssemblyEdit(base, {
    ...base,
    blocks: [{ ...b, status: "deleted" }, a],
  });
  assert.deepEqual(edited.blocks.map((block) => block.id), ["part2_001", "part1_001"]);
  assert.equal(edited.blocks[0].status, "deleted");

  assert.throws(
    () => applyAssemblyEdit(base, { ...base, blocks: [{ ...a, text: "改写" }, b] }),
    /immutable field: text/,
  );
  assert.throws(
    () => applyAssemblyEdit(base, { ...base, blocks: [{ ...a, start: 1 }, b] }),
    /immutable field: start/,
  );
});
