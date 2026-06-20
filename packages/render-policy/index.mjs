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
      numberOption(lengthPolicy.segmentLengthSeconds, longVideoPolicy.segmentLengthSeconds ?? 120),
    ),
  );
  const defaultThresholdSeconds = secondsFromMinutes(
    lengthPolicy.singleCompositionMaxMinutes,
    10 * 60,
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
    storyboardDuration > segmentThresholdSeconds;
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
