const numberOption = (value, fallback) => {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const secondsFromMinutes = (value, fallback) => {
  const minutes = Number(value);
  return Number.isFinite(minutes) && minutes > 0 ? minutes * 60 : fallback;
};

export const DEFAULT_SEGMENT_THRESHOLD_SECONDS = 5 * 60;
export const DEFAULT_SEGMENT_SECONDS = 60;

export const buildRenderSegments = (duration, length) => {
  const segmentLength =
    Number.isFinite(length) && length > 0 ? length : DEFAULT_SEGMENT_SECONDS;
  const segments = [];
  for (let start = 0; start < duration - 0.001; start += segmentLength) {
    const end = Math.min(duration, start + segmentLength);
    segments.push({
      index: segments.length + 1,
      start: Number(start.toFixed(3)),
      end: Number(end.toFixed(3)),
      duration: Number((end - start).toFixed(3)),
    });
  }
  return segments;
};

export const resolveRenderPlan = ({ manifest = {}, storyboard = {}, cli = {} }) => {
  const render = manifest.render ?? {};
  const lengthPolicy = manifest.lengthPolicy ?? {};
  const longVideoPolicy = storyboard.longVideoPolicy ?? {};
  const storyboardDuration = numberOption(storyboard.video?.duration, cli.storyboardDuration);

  if (!Number.isFinite(storyboardDuration) || storyboardDuration <= 0) {
    throw new Error(`Storyboard video.duration must be a positive number: ${storyboardDuration}`);
  }

  const previewSeconds = numberOption(
    cli.previewSeconds,
    numberOption(render.previewSeconds, null),
  );
  const effectivePreviewSeconds =
    previewSeconds && previewSeconds > 0
      ? Math.min(previewSeconds, storyboardDuration)
      : null;

  const segmentSeconds = numberOption(
    cli.segmentSeconds,
    numberOption(
      render.segmentSeconds,
      numberOption(
        lengthPolicy.segmentLengthSeconds,
        longVideoPolicy.segmentLengthSeconds ?? DEFAULT_SEGMENT_SECONDS,
      ),
    ),
  );
  const defaultThresholdSeconds = secondsFromMinutes(
    lengthPolicy.singleCompositionMaxMinutes,
    DEFAULT_SEGMENT_THRESHOLD_SECONDS,
  );
  const segmentThresholdSeconds = numberOption(
    cli.segmentThresholdSeconds,
    numberOption(
      render.segmentThresholdSeconds,
      numberOption(render.longRenderThresholdSeconds, defaultThresholdSeconds),
    ),
  );
  const longRenderThresholdSeconds = numberOption(
    cli.longRenderThresholdSeconds,
    numberOption(render.longRenderThresholdSeconds, segmentThresholdSeconds),
  );
  const allowLongRender = cli.allowLongRender === true || render.allowLongRender === true;
  const manualSegmented =
    cli.segmentRender === true ||
    render.segmented === true ||
    render.mode === "segmented";
  const autoSegmentLongVideos = render.autoSegmentLongVideos !== false;
  const autoSegmented =
    autoSegmentLongVideos &&
    !effectivePreviewSeconds &&
    storyboardDuration >= segmentThresholdSeconds;
  const segmentedRender = manualSegmented || autoSegmented;
  const effectiveRenderDuration = effectivePreviewSeconds ?? storyboardDuration;
  const shouldRefuseLongRender =
    storyboardDuration > longRenderThresholdSeconds &&
    !allowLongRender &&
    !effectivePreviewSeconds &&
    !segmentedRender;

  return {
    storyboardDuration,
    previewSeconds,
    effectivePreviewSeconds,
    effectiveRenderDuration,
    segmentSeconds,
    segmentThresholdSeconds,
    longRenderThresholdSeconds,
    allowLongRender,
    autoSegmentLongVideos,
    manualSegmented,
    autoSegmented,
    segmentedRender,
    shouldRefuseLongRender,
    renderMode: effectivePreviewSeconds
      ? "preview"
      : segmentedRender
        ? "segmented"
        : "single",
  };
};
