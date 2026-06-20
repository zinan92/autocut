import assert from "node:assert/strict";
import test from "node:test";
import { resolveRenderPlan } from "../packages/render-policy/index.mjs";

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

test("render policy does not auto-segment previews unless explicitly requested", () => {
  const plan = resolveRenderPlan({
    manifest: {
      render: { autoSegmentLongVideos: true, segmentThresholdSeconds: 300 },
    },
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
