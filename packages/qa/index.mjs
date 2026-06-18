import { deliverySizeForOrientation } from "../delivery/index.mjs";

export const scoreRender = ({ sourceProbe, outputProbe }) => {
  const expected = deliverySizeForOrientation(sourceProbe.orientation);
  const warnings = [];
  const checks = {
    orientationMatch: outputProbe.orientation === sourceProbe.orientation,
    expectedDimensions:
      outputProbe.width === expected.width && outputProbe.height === expected.height,
    squarePixels: outputProbe.video.sampleAspectRatio === "1:1",
    deliveryPixelFormat: outputProbe.video.pixelFormat === "yuv420p",
    hasAudio: Boolean(outputProbe.audio),
    durationPositive: outputProbe.duration > 0,
  };

  if (!checks.orientationMatch) warnings.push("Output orientation does not match source.");
  if (!checks.expectedDimensions) {
    warnings.push(`Expected ${expected.width}x${expected.height}, got ${outputProbe.width}x${outputProbe.height}.`);
  }
  if (!checks.squarePixels) warnings.push("Sample aspect ratio is not 1:1.");
  if (!checks.deliveryPixelFormat) warnings.push("Pixel format is not yuv420p.");
  if (!checks.hasAudio) warnings.push("Output has no audio stream.");
  if (!checks.durationPositive) warnings.push("Output duration is not positive.");

  const passCount = Object.values(checks).filter(Boolean).length;
  const geometryScore = Math.round((passCount / Object.keys(checks).length) * 100);

  return {
    checks,
    warnings,
    scores: {
      geometry: geometryScore,
      delivery: checks.expectedDimensions && checks.squarePixels && checks.deliveryPixelFormat ? 100 : 70,
    },
    status: warnings.length === 0 ? "pass" : "review",
  };
};
