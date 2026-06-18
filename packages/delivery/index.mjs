export const deliverySizeForOrientation = (orientation) =>
  orientation === "landscape"
    ? { width: 1920, height: 1080, aspect: "16:9" }
    : { width: 720, height: 1280, aspect: "9:16" };

export const telegramMetadata = ({ width, height, duration }) => ({
  width,
  height,
  duration: Math.max(1, Math.round(Number(duration) || 1)),
  supportsStreaming: true,
});
