import assert from "node:assert/strict";
import test from "node:test";
import {
  buildRenderSegments,
  resolveRenderPlan,
} from "../packages/render-policy/index.mjs";

const storyboard = (duration, longVideoPolicy = {}) => ({
  video: { duration },
  longVideoPolicy,
});

test("render policy auto-segments long production renders", () => {
  const plan = resolveRenderPlan({
    manifest: {
      render: { autoSegmentLongVideos: true, segmentThresholdSeconds: 300 },
    },
    storyboard: storyboard(601, { segmentLengthSeconds: 90 }),
  });

  assert.equal(plan.renderMode, "segmented");
  assert.equal(plan.segmentedRender, true);
  assert.equal(plan.autoSegmented, true);
  assert.equal(plan.segmentSeconds, 90);
  assert.equal(plan.effectiveRenderDuration, 601);
});

test("render policy defaults to segmented rendering at five minutes without explicit threshold", () => {
  const manifest = { render: { autoSegmentLongVideos: true } };
  const durations = [300, 360, 480, 599, 600];

  for (const duration of durations) {
    const plan = resolveRenderPlan({
      manifest,
      storyboard: storyboard(duration),
    });
    assert.equal(plan.renderMode, "segmented", `${duration}s should be segmented`);
    assert.equal(plan.segmentedRender, true);
    assert.equal(plan.autoSegmented, true);
    assert.equal(plan.segmentThresholdSeconds, 300);
    assert.equal(plan.segmentSeconds, 60);
  }

  const underThreshold = resolveRenderPlan({
    manifest,
    storyboard: storyboard(299.999),
  });
  assert.equal(underThreshold.renderMode, "single");
  assert.equal(underThreshold.segmentedRender, false);
});

test("render policy uses default five-minute segmentation even without render config", () => {
  const plan = resolveRenderPlan({
    manifest: {},
    storyboard: storyboard(360),
  });

  assert.equal(plan.renderMode, "segmented");
  assert.equal(plan.segmentThresholdSeconds, 300);
  assert.equal(plan.segmentSeconds, 60);
});

test("render segment math has clean tails and no zero-duration segments", () => {
  const tenMinuteSegments = buildRenderSegments(600, 60);
  assert.equal(tenMinuteSegments.length, 10);
  assert.deepEqual(tenMinuteSegments[0], {
    index: 1,
    start: 0,
    end: 60,
    duration: 60,
  });
  assert.deepEqual(tenMinuteSegments.at(-1), {
    index: 10,
    start: 540,
    end: 600,
    duration: 60,
  });

  const sevenSegments = buildRenderSegments(361, 60);
  assert.equal(sevenSegments.length, 7);
  assert.deepEqual(sevenSegments.at(-1), {
    index: 7,
    start: 360,
    end: 361,
    duration: 1,
  });
  assert.equal(sevenSegments.some((segment) => segment.duration <= 0), false);
});

test("render policy does not auto-segment previews unless explicitly requested", () => {
  const plan = resolveRenderPlan({
    manifest: { render: { autoSegmentLongVideos: true } },
    storyboard: storyboard(601),
    cli: { previewSeconds: 30 },
  });

  assert.equal(plan.renderMode, "preview");
  assert.equal(plan.segmentedRender, false);
  assert.equal(plan.effectivePreviewSeconds, 30);
  assert.equal(plan.effectiveRenderDuration, 30);
});

test("render policy lets manual segment render apply to previews", () => {
  const plan = resolveRenderPlan({
    manifest: {},
    storyboard: storyboard(120),
    cli: { previewSeconds: 12, segmentRender: true, segmentSeconds: 4 },
  });

  assert.equal(plan.renderMode, "preview");
  assert.equal(plan.segmentedRender, true);
  assert.equal(plan.segmentSeconds, 4);
  assert.equal(plan.effectiveRenderDuration, 12);
});

test("render policy lets CLI segment threshold override the default", () => {
  const plan = resolveRenderPlan({
    manifest: {},
    storyboard: storyboard(360),
    cli: { segmentThresholdSeconds: 400 },
  });

  assert.equal(plan.renderMode, "single");
  assert.equal(plan.segmentThresholdSeconds, 400);
  assert.equal(plan.segmentedRender, false);
});

test("render policy refuses unsegmented long renders when auto segmentation is disabled", () => {
  const plan = resolveRenderPlan({
    manifest: {
      render: {
        autoSegmentLongVideos: false,
        longRenderThresholdSeconds: 300,
      },
    },
    storyboard: storyboard(601),
  });

  assert.equal(plan.shouldRefuseLongRender, true);
  assert.equal(plan.segmentedRender, false);
});
