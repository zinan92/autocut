import { closeSync, openSync, readSync, statSync } from "node:fs";
import { deliverySizeForOrientation } from "../delivery/index.mjs";

const readTopLevelBoxes = (path, byteLimit = 2 * 1024 * 1024) => {
  const size = statSync(path).size;
  const fd = openSync(path, "r");
  try {
    const buffer = Buffer.alloc(Math.min(size, byteLimit));
    const bytes = readSync(fd, buffer, 0, buffer.length, 0);
    const boxes = [];
    let offset = 0;
    while (offset + 8 <= bytes) {
      const boxSize = buffer.readUInt32BE(offset);
      const type = buffer.toString("ascii", offset + 4, offset + 8);
      if (boxSize === 0) {
        boxes.push({ type, offset, size: bytes - offset });
        break;
      }
      if (boxSize === 1 || boxSize < 8) break;
      boxes.push({ type, offset, size: boxSize });
      offset += boxSize;
    }
    return boxes;
  } finally {
    closeSync(fd);
  }
};

export const hasFaststartMoov = (path) => {
  const boxes = readTopLevelBoxes(path);
  const moov = boxes.find((box) => box.type === "moov");
  const mdat = boxes.find((box) => box.type === "mdat");
  return Boolean(moov && mdat && moov.offset < mdat.offset);
};

export const scoreRender = ({ sourceProbe, outputProbe, outputPath, expectedDimensions }) => {
  const expected = expectedDimensions ?? deliverySizeForOrientation(sourceProbe.orientation);
  const warnings = [];
  const failures = [];
  const checks = {
    orientationMatch: outputProbe.orientation === sourceProbe.orientation,
    expectedDimensions:
      outputProbe.width === expected.width && outputProbe.height === expected.height,
    squarePixels: outputProbe.video.sampleAspectRatio === "1:1",
    deliveryPixelFormat: outputProbe.video.pixelFormat === "yuv420p",
    deliveryVideoCodec: outputProbe.video.codec === "h264",
    hasAudio: Boolean(outputProbe.audio),
    deliveryAudioCodec: outputProbe.audio?.codec === "aac",
    deliveryAudioSampleRate: outputProbe.audio?.sampleRate === 48000,
    durationPositive: outputProbe.duration > 0,
    faststart: outputPath ? hasFaststartMoov(outputPath) : false,
  };

  if (!checks.orientationMatch) failures.push("Output orientation does not match source.");
  if (!checks.expectedDimensions) {
    failures.push(`Expected ${expected.width}x${expected.height}, got ${outputProbe.width}x${outputProbe.height}.`);
  }
  if (!checks.squarePixels) failures.push("Sample aspect ratio is not 1:1.");
  if (!checks.deliveryPixelFormat) failures.push("Pixel format is not yuv420p.");
  if (!checks.deliveryVideoCodec) failures.push("Video codec is not h264.");
  if (!checks.hasAudio) failures.push("Output has no audio stream.");
  if (!checks.deliveryAudioCodec) failures.push("Audio codec is not aac.");
  if (!checks.deliveryAudioSampleRate) failures.push("Audio sample rate is not 48000 Hz.");
  if (!checks.durationPositive) failures.push("Output duration is not positive.");
  if (!checks.faststart) failures.push("MP4 is not faststart; moov atom is not before mdat.");

  const passCount = Object.values(checks).filter(Boolean).length;
  const geometryScore = Math.round((passCount / Object.keys(checks).length) * 100);

  return {
    checks,
    failures,
    warnings,
    scores: {
      geometry: geometryScore,
      delivery:
        checks.expectedDimensions &&
        checks.squarePixels &&
        checks.deliveryPixelFormat &&
        checks.deliveryVideoCodec &&
        checks.deliveryAudioCodec &&
        checks.faststart
          ? 100
          : 0,
    },
    status: failures.length === 0 ? (warnings.length === 0 ? "pass" : "review") : "fail",
  };
};
