#!/usr/bin/env node
import { basename } from "node:path";
import { telegramMetadata } from "../packages/delivery/index.mjs";
import { requireFile } from "../packages/shared/json.mjs";
import { run } from "../packages/shared/process.mjs";
import { probeMedia } from "../packages/video-ingest/index.mjs";
import { parseArgs } from "./args.mjs";

const args = parseArgs(process.argv.slice(2));
const videoPath = args._[0] ?? args.video;
const chatId = args.chat ?? process.env.TELEGRAM_CHAT_ID;
const token = process.env.TELEGRAM_BOT_TOKEN;

if (!videoPath || !chatId || !token) {
  console.error(
    "Usage: TELEGRAM_BOT_TOKEN=... node scripts/deliver-telegram.mjs <video.mp4> --chat <chat_id> [--caption text]",
  );
  process.exit(1);
}

const video = requireFile(videoPath, "video");
const probe = probeMedia(video);
const meta = telegramMetadata(probe);

const body = JSON.parse(
  run("curl", [
    "-sS",
    "-X",
    "POST",
    `https://api.telegram.org/bot${token}/sendVideo`,
    "--form-string",
    `chat_id=${chatId}`,
    "--form-string",
    `caption=${args.caption ?? basename(video)}`,
    "--form-string",
    `width=${meta.width}`,
    "--form-string",
    `height=${meta.height}`,
    "--form-string",
    `duration=${meta.duration}`,
    "--form-string",
    "supports_streaming=true",
    "--form",
    `video=@${video};type=video/mp4`,
  ]),
);

if (!body.ok) {
  console.error(JSON.stringify(body, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  messageId: body.result.message_id,
  width: body.result.video?.width,
  height: body.result.video?.height,
  duration: body.result.video?.duration,
}, null, 2));
