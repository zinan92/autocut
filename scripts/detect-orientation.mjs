#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const videoPath = process.argv[2];

if (!videoPath) {
  console.error("Usage: node scripts/detect-orientation.mjs /path/to/video.mp4");
  process.exit(1);
}

if (!existsSync(videoPath)) {
  console.error(`Video not found: ${videoPath}`);
  process.exit(1);
}

const probe = spawnSync(
  "ffprobe",
  [
    "-v",
    "error",
    "-select_streams",
    "v:0",
    "-show_entries",
    "stream=width,height,duration,r_frame_rate",
    "-show_entries",
    "format=duration,size",
    "-of",
    "json",
    videoPath,
  ],
  { encoding: "utf8" },
);

if (probe.status !== 0) {
  console.error(probe.stderr || "ffprobe failed");
  process.exit(probe.status ?? 1);
}

const data = JSON.parse(probe.stdout);
const stream = data.streams?.[0];

if (!stream?.width || !stream?.height) {
  console.error("Could not read video width/height");
  process.exit(1);
}

const orientation = stream.width > stream.height ? "landscape" : "vertical";

console.log(
  JSON.stringify(
    {
      path: videoPath,
      width: stream.width,
      height: stream.height,
      fps: stream.r_frame_rate,
      duration: Number(data.format?.duration ?? stream.duration ?? 0),
      size: Number(data.format?.size ?? 0),
      orientation,
    },
    null,
    2,
  ),
);
