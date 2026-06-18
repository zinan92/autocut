#!/usr/bin/env node
import { writeJson } from "../packages/shared/json.mjs";
import { probeMedia } from "../packages/video-ingest/index.mjs";
import { parseArgs } from "./args.mjs";

const args = parseArgs(process.argv.slice(2));
const input = args._[0] ?? args.input;

if (!input) {
  console.error("Usage: node scripts/ingest-video.mjs <video> [--out ingest.json]");
  process.exit(1);
}

const probe = probeMedia(input);

if (args.out) {
  writeJson(args.out, probe);
}

console.log(JSON.stringify(probe, null, 2));
