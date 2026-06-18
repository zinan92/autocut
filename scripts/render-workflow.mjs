#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const workspaceDir = resolve(scriptDir, "..");
const projectDir = join(workspaceDir, "remotion-host-overlay-demo");
const workDir = join(workspaceDir, "remotion-host-overlay-work");
const manifestArg = process.argv[2] ?? "workflow/manifest.json";
const manifestPath = resolve(workspaceDir, manifestArg);

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? workspaceDir,
    encoding: "utf8",
    stdio: options.stdio ?? "pipe",
  });

  if (result.status !== 0) {
    throw new Error(
      [
        `${command} ${args.join(" ")} failed`,
        result.stdout?.trim(),
        result.stderr?.trim(),
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }

  return result.stdout;
};

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));

if (!existsSync(manifestPath)) {
  console.error(`Manifest not found: ${manifestPath}`);
  process.exit(1);
}

const manifest = readJson(manifestPath);
const storyboardPath = resolve(
  workspaceDir,
  manifest.storyboardPath ?? "remotion-host-overlay-demo/src/storyboard.json",
);
const projectStoryboardPath = join(projectDir, "src", "storyboard.json");
const sourceVideo = isAbsolute(manifest.sourceVideo)
  ? manifest.sourceVideo
  : resolve(dirname(manifestPath), manifest.sourceVideo);

if (!existsSync(sourceVideo)) {
  console.error(`Source video not found: ${sourceVideo}`);
  process.exit(1);
}

const probe = JSON.parse(
  run("node", [join(scriptDir, "detect-orientation.mjs"), sourceVideo]),
);

const outputOrientation =
  manifest.outputOrientation === "auto" || !manifest.outputOrientation
    ? probe.orientation
    : manifest.outputOrientation;

if (!["vertical", "landscape"].includes(outputOrientation)) {
  console.error(`Unsupported outputOrientation: ${outputOrientation}`);
  process.exit(1);
}

const composition =
  outputOrientation === "vertical" ? "HostOverlayVideo" : "HostOverlayReferenceV9";

const projectName = manifest.projectName || "host-overlay";
const renderDir = join(workDir, "renders");
const frameDir = join(renderDir, "workflow-frames");
mkdirSync(renderDir, { recursive: true });
mkdirSync(frameDir, { recursive: true });

const rawOutputPath = join(renderDir, `${projectName}-${outputOrientation}-raw.mp4`);
const outputPath = join(renderDir, `${projectName}-${outputOrientation}.mp4`);
const contactSheetPath = join(frameDir, `${projectName}-${outputOrientation}-contact-sheet.png`);
const publicHostPath = join(projectDir, "public", "host.mp4");

copyFileSync(sourceVideo, publicHostPath);
if (resolve(storyboardPath) !== resolve(projectStoryboardPath)) {
  copyFileSync(storyboardPath, projectStoryboardPath);
}

console.log(`Source: ${sourceVideo}`);
console.log(`Detected: ${probe.width}x${probe.height} ${probe.orientation}`);
console.log(`Output orientation: ${outputOrientation}`);
console.log(`Composition: ${composition}`);
console.log(`Copied source to: ${publicHostPath}`);
console.log(`Storyboard: ${storyboardPath}`);
if (resolve(storyboardPath) !== resolve(projectStoryboardPath)) {
  console.log(`Copied storyboard to: ${projectStoryboardPath}`);
}

run("npm", ["run", "lint"], { cwd: projectDir, stdio: "inherit" });
run("node", [join(scriptDir, "validate-storyboard.mjs"), storyboardPath], {
  cwd: workspaceDir,
  stdio: "inherit",
});

run(
  "npx",
  [
    "remotion",
    "render",
    composition,
    rawOutputPath,
    "--codec",
    manifest.render?.codec ?? "h264",
    "--crf",
    String(manifest.render?.crf ?? 18),
    "--concurrency",
    String(manifest.render?.concurrency ?? 2),
  ],
  { cwd: projectDir, stdio: "inherit" },
);

const deliverySize =
  outputOrientation === "vertical"
    ? { width: 720, height: 1280, aspect: "9:16" }
    : { width: 1920, height: 1080, aspect: "16:9" };

run(
  "ffmpeg",
  [
    "-y",
    "-i",
    rawOutputPath,
    "-vf",
    `scale=${deliverySize.width}:${deliverySize.height}:flags=lanczos:in_range=pc:out_range=tv,setsar=1,format=yuv420p`,
    "-c:v",
    "libx264",
    "-profile:v",
    "high",
    "-level",
    outputOrientation === "vertical" ? "4.1" : "4.2",
    "-pix_fmt",
    "yuv420p",
    "-color_range",
    "tv",
    "-crf",
    String(manifest.delivery?.crf ?? manifest.render?.crf ?? 18),
    "-preset",
    manifest.delivery?.preset ?? "medium",
    "-c:a",
    "aac",
    "-b:a",
    manifest.delivery?.audioBitrate ?? "192k",
    "-ar",
    "48000",
    "-movflags",
    "+faststart",
    "-metadata:s:v:0",
    "rotate=0",
    "-aspect",
    deliverySize.aspect,
    outputPath,
  ],
  { cwd: workspaceDir, stdio: "inherit" },
);

const selectFrames = manifest.qa?.stillFrames?.length
  ? manifest.qa.stillFrames.map((frame) => `eq(n\\,${frame})`).join("+")
  : "eq(n\\,120)+eq(n\\,480)+eq(n\\,1020)+eq(n\\,1620)";

run(
  "ffmpeg",
  [
    "-y",
    "-i",
    outputPath,
    "-vf",
    `select='${selectFrames}',scale=960:-1,tile=2x2`,
    "-frames:v",
    "1",
    "-update",
    "1",
    contactSheetPath,
  ],
  { cwd: workspaceDir, stdio: "inherit" },
);

const renderedProbe = run("ffprobe", [
  "-v",
  "error",
  "-show_entries",
  "format=duration,size",
  "-show_entries",
  "stream=index,codec_type,codec_name,width,height,channels",
  "-of",
  "json",
  outputPath,
]);

if (manifest.qa?.openAfterRender !== false) {
  run("open", [outputPath], { stdio: "inherit" });
}

console.log("Render complete");
console.log(`Video: ${outputPath}`);
console.log(`Raw render: ${rawOutputPath}`);
console.log(`Contact sheet: ${contactSheetPath}`);
console.log(
  `Delivery metadata for Telegram/API upload: width=${deliverySize.width}, height=${deliverySize.height}, aspect=${deliverySize.aspect}`,
);
console.log(renderedProbe);
