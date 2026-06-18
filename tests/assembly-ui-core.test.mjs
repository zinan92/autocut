import assert from "node:assert/strict";
import test from "node:test";
import {
  moveBlockAfter,
  moveBlockBefore,
  nextPlayableBlock,
  previewQueue,
  queueStats,
  setBlockStatus,
  sourceRuns,
} from "../assembly-ui/app-core.mjs";
import { makeBlock } from "../packages/assembly/index.mjs";

const sampleAssembly = () => ({
  sources: {
    part1: { id: "part1", path: "/tmp/part1.mp4" },
    part2: { id: "part2", path: "/tmp/part2.mp4" },
    part3: { id: "part3", path: "/tmp/part3.mp4" },
  },
  blocks: [
    makeBlock({ id: "part1_001", source: "part1", start: 0, end: 4, text: "one" }),
    makeBlock({ id: "part2_001", source: "part2", start: 0, end: 5, text: "two a" }),
    makeBlock({ id: "part3_001", source: "part3", start: 0, end: 6, text: "three" }),
    makeBlock({ id: "part2_002", source: "part2", start: 5, end: 9, text: "two b" }),
  ],
});

test("assembly UI core reorders blocks without changing block metadata", () => {
  const base = sampleAssembly();
  const moved = moveBlockBefore(base, "part3_001", "part2_001");
  assert.deepEqual(
    moved.blocks.map((block) => block.id),
    ["part1_001", "part3_001", "part2_001", "part2_002"],
  );
  assert.equal(moved.blocks[1].hash, base.blocks[2].hash);
  assert.deepEqual(
    base.blocks.map((block) => block.id),
    ["part1_001", "part2_001", "part3_001", "part2_002"],
  );

  const movedAfter = moveBlockAfter(base, "part1_001", "part3_001");
  assert.deepEqual(
    movedAfter.blocks.map((block) => block.id),
    ["part2_001", "part3_001", "part1_001", "part2_002"],
  );
});

test("assembly UI core delete and restore update preview queue", () => {
  const base = sampleAssembly();
  const deleted = setBlockStatus(base, "part2_001", "deleted");
  assert.deepEqual(
    previewQueue(deleted).map((block) => block.id),
    ["part1_001", "part3_001", "part2_002"],
  );
  assert.equal(nextPlayableBlock(deleted, "part2_001").id, "part3_001");

  const restored = setBlockStatus(deleted, "part2_001", "active");
  assert.deepEqual(
    previewQueue(restored).map((block) => block.id),
    ["part1_001", "part2_001", "part3_001", "part2_002"],
  );
});

test("assembly UI core reports queue runs and duration", () => {
  const assembly = setBlockStatus(sampleAssembly(), "part2_001", "deleted");
  const stats = queueStats(assembly);
  assert.equal(stats.activeCount, 3);
  assert.equal(stats.deletedCount, 1);
  assert.equal(stats.duration, 14);
  assert.deepEqual(sourceRuns(previewQueue(assembly)), [
    { source: "part1", blocks: 1, duration: 4 },
    { source: "part3", blocks: 1, duration: 6 },
    { source: "part2", blocks: 1, duration: 4 },
  ]);
});
