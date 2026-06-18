import assert from "node:assert/strict";
import test from "node:test";
import {
  storyboardFromEdl,
  timelineRangesFromEdl,
} from "../packages/storyboard/index.mjs";

const sampleEdl = () => ({
  version: 1,
  mode: "multi-source-assembly",
  sources: {
    part1: "/tmp/part1.mp4",
    part2: "/tmp/part2.mp4",
    part3: "/tmp/part3.mp4",
  },
  ranges: [
    { id: "r1", source: "part1", start: 0, end: 20, blockId: "part1_001", text: "第一段介绍整个问题" },
    { id: "r2", source: "part2", start: 0, end: 55, blockId: "part2_001", text: "第二段先讲背景和上下文" },
    { id: "r3", source: "part3", start: 0, end: 42, blockId: "part3_001", text: "第三段插入一个关键补充" },
    { id: "r4", source: "part2", start: 55, end: 90, blockId: "part2_002", text: "第二段最后收束" },
  ],
  metrics: { outputDuration: 152 },
});

test("timelineRangesFromEdl maps source ranges onto clean-master output time", () => {
  const timeline = timelineRangesFromEdl(sampleEdl());
  assert.deepEqual(
    timeline.map((range) => [range.blockId, range.outputStart, range.outputEnd]),
    [
      ["part1_001", 0, 20],
      ["part2_001", 20, 75],
      ["part3_001", 75, 117],
      ["part2_002", 117, 152],
    ],
  );
});

test("storyboardFromEdl creates V9-compatible attention ids from assembly EDL", () => {
  const storyboard = storyboardFromEdl({
    edl: sampleEdl(),
    manifest: {
      editPlan: { targetLengthMinutes: "5-10" },
      skillBoard: [["assembly", "block order"], ["edl", "source ranges"]],
    },
  });

  assert.equal(storyboard.video.duration, 152);
  assert.equal(storyboard.captions.length, 4);
  assert.ok(storyboard.phases.length >= 4);
  assert.deepEqual(
    storyboard.attentionTimeline.slice(0, 4).map((item) => item.id),
    ["skill-board", "effort", "karma", "will"],
  );
  assert.equal(storyboard.longVideoPolicy.maxActivePrimaryAnimation, 1);
  assert.deepEqual(storyboard.sourceTrace.sources, ["part1", "part2", "part3"]);
  assert.ok(
    storyboard.attentionTimeline.every((item) => item.end - item.start <= 120),
    "attention windows should stay within the M3 long-video policy",
  );
});
