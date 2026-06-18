#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const workspaceDir = resolve(scriptDir, "..");
const defaultPath = resolve(
  workspaceDir,
  "remotion-host-overlay-demo/src/storyboard.json",
);
const storyboardPath = resolve(workspaceDir, process.argv[2] ?? defaultPath);

const fail = (message) => {
  console.error(`Storyboard validation failed: ${message}`);
  process.exit(1);
};

const warn = (message) => {
  console.warn(`Storyboard warning: ${message}`);
};

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));

const assertArray = (value, name) => {
  if (!Array.isArray(value) || value.length === 0) {
    fail(`${name} must be a non-empty array`);
  }
};

const assertTimedItems = (items, name, duration) => {
  let previousStart = -Infinity;

  items.forEach((item, index) => {
    if (typeof item.start !== "number" || typeof item.end !== "number") {
      fail(`${name}[${index}] must have numeric start and end`);
    }

    if (item.start < 0 || item.end <= item.start) {
      fail(`${name}[${index}] has invalid time range ${item.start}-${item.end}`);
    }

    if (item.end > duration + 0.05) {
      fail(`${name}[${index}] ends after video duration`);
    }

    if (item.start < previousStart) {
      fail(`${name}[${index}] starts before the previous item`);
    }

    previousStart = item.start;
  });
};

if (!existsSync(storyboardPath)) {
  fail(`file not found: ${storyboardPath}`);
}

const storyboard = readJson(storyboardPath);
const duration = storyboard.video?.duration;

if (typeof duration !== "number" || duration <= 0) {
  fail("video.duration must be a positive number");
}

if (duration > 10 * 60) {
  warn("duration is over 10 minutes; use segmented rendering and per-segment QA");
}

assertArray(storyboard.video?.chapters, "video.chapters");
assertArray(storyboard.captions, "captions");
assertArray(storyboard.phases, "phases");
assertArray(storyboard.attentionTimeline, "attentionTimeline");
assertArray(storyboard.referenceSkillBoard, "referenceSkillBoard");

assertTimedItems(storyboard.captions, "captions", duration);
assertTimedItems(storyboard.phases, "phases", duration);
assertTimedItems(storyboard.attentionTimeline, "attentionTimeline", duration);

const maxActive = storyboard.longVideoPolicy?.maxActivePrimaryAnimation ?? 1;
if (maxActive !== 1) {
  fail("longVideoPolicy.maxActivePrimaryAnimation must be 1");
}

const maxSegmentLength = storyboard.longVideoPolicy?.maxSegmentLengthSeconds ?? 120;
storyboard.attentionTimeline.forEach((item, index) => {
  const length = item.end - item.start;
  if (length > maxSegmentLength) {
    warn(
      `attentionTimeline[${index}] is ${length.toFixed(1)}s; consider splitting it`,
    );
  }
});

console.log(`Storyboard OK: ${storyboardPath}`);
console.log(`Duration: ${duration}s`);
console.log(`Captions: ${storyboard.captions.length}`);
console.log(`Phases: ${storyboard.phases.length}`);
console.log(`Attention beats: ${storyboard.attentionTimeline.length}`);
