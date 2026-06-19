import assert from "node:assert/strict";
import test from "node:test";
import { windowStoryboard } from "../packages/storyboard/windowing.mjs";

const sampleStoryboard = () => ({
  video: {
    duration: 180,
    chapters: ["A", "B"],
  },
  captions: [
    { start: 0, end: 20, zh: "first", en: "" },
    { start: 20, end: 70, zh: "second", en: "" },
    { start: 70, end: 120, zh: "third", en: "" },
  ],
  phases: [
    { start: 0, end: 60, kicker: "A", title: "one", accent: "#fff", stat: "01", statLabel: "BEAT", detail: "" },
    { start: 60, end: 120, kicker: "B", title: "two", accent: "#000", stat: "02", statLabel: "BEAT", detail: "" },
  ],
  attentionTimeline: [
    { id: "a", start: 5, end: 50, primary: "left", behavior: "one-primary-animation" },
    { id: "b", start: 65, end: 100, primary: "right", behavior: "one-primary-animation" },
  ],
  shortSkillBoard: [["x", "y"]],
  referenceSkillBoard: [["x", "y"]],
});

test("windowStoryboard clips and shifts timed items to segment-local time", () => {
  const windowed = windowStoryboard({
    storyboard: sampleStoryboard(),
    start: 45,
    end: 90,
    timelineDuration: 180,
  });

  assert.equal(windowed.video.duration, 45);
  assert.equal(windowed.video.mediaStart, 45);
  assert.equal(windowed.video.timelineStart, 45);
  assert.equal(windowed.video.timelineDuration, 180);
  assert.deepEqual(
    windowed.captions.map((caption) => [caption.zh, caption.start, caption.end]),
    [
      ["second", 0, 25],
      ["third", 25, 45],
    ],
  );
  assert.deepEqual(
    windowed.phases.map((phase) => [phase.title, phase.start, phase.end]),
    [
      ["one", 0, 15],
      ["two", 15, 45],
    ],
  );
  assert.deepEqual(
    windowed.attentionTimeline.map((item) => [item.id, item.start, item.end]),
    [
      ["a", 0, 5],
      ["b", 20, 45],
    ],
  );
});

test("windowStoryboard keeps timed arrays non-empty for validator safety", () => {
  const windowed = windowStoryboard({
    storyboard: {
      video: { duration: 10, chapters: ["Only"] },
      captions: [],
      phases: [],
      attentionTimeline: [],
      shortSkillBoard: [["x", "y"]],
      referenceSkillBoard: [["x", "y"]],
    },
    start: 2,
    end: 5,
  });

  assert.equal(windowed.video.duration, 3);
  assert.equal(windowed.captions.length, 1);
  assert.equal(windowed.phases.length, 1);
  assert.equal(windowed.attentionTimeline.length, 1);
});
