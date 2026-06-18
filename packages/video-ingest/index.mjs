import { resolve } from "node:path";
import { runJson } from "../shared/process.mjs";

const fpsToNumber = (rate) => {
  if (!rate || typeof rate !== "string") return null;
  const [num, den] = rate.split("/").map(Number);
  if (!num || !den) return null;
  return num / den;
};

const orientationFromDimensions = (width, height) =>
  width > height ? "landscape" : "vertical";

export const probeMedia = (inputPath) => {
  const absPath = resolve(inputPath);
  const data = runJson("ffprobe", [
    "-v",
    "error",
    "-show_format",
    "-show_streams",
    "-of",
    "json",
    absPath,
  ]);

  const streams = data.streams ?? [];
  const video = streams.find((stream) => stream.codec_type === "video");
  const audio = streams.find((stream) => stream.codec_type === "audio");
  const subtitles = streams.filter((stream) => stream.codec_type === "subtitle");

  if (!video?.width || !video?.height) {
    throw new Error(`Could not read video dimensions: ${absPath}`);
  }

  const duration = Number(data.format?.duration ?? video.duration ?? 0);
  const width = Number(video.width);
  const height = Number(video.height);

  return {
    path: absPath,
    width,
    height,
    orientation: orientationFromDimensions(width, height),
    fps: video.avg_frame_rate ?? video.r_frame_rate ?? null,
    fpsNumber: fpsToNumber(video.avg_frame_rate) ?? fpsToNumber(video.r_frame_rate),
    nominalFps: video.r_frame_rate ?? null,
    duration,
    size: Number(data.format?.size ?? 0),
    container: data.format?.format_name ?? null,
    video: {
      codec: video.codec_name ?? null,
      profile: video.profile ?? null,
      pixelFormat: video.pix_fmt ?? null,
      sampleAspectRatio: video.sample_aspect_ratio ?? null,
      displayAspectRatio: video.display_aspect_ratio ?? null,
      colorSpace: video.color_space ?? null,
      colorTransfer: video.color_transfer ?? null,
      colorRange: video.color_range ?? null,
      bitrate: video.bit_rate ? Number(video.bit_rate) : null,
      isHdr: ["smpte2084", "arib-std-b67"].includes(video.color_transfer),
    },
    audio: audio
      ? {
          codec: audio.codec_name ?? null,
          channels: audio.channels ?? null,
          sampleRate: audio.sample_rate ? Number(audio.sample_rate) : null,
          bitrate: audio.bit_rate ? Number(audio.bit_rate) : null,
        }
      : null,
    subtitles: subtitles.map((subtitle) => ({
      codec: subtitle.codec_name ?? null,
      language: subtitle.tags?.language ?? null,
    })),
  };
};
