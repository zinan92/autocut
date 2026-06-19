#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { windowStoryboard } from "../packages/storyboard/windowing.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const workspaceDir = resolve(scriptDir, "..");
const projectDir = join(workspaceDir, "remotion-host-overlay-demo");
const workDir = join(workspaceDir, "remotion-host-overlay-work");
const manifestArg = process.argv[2] ?? "workflow/manifest.json";
const cliArgs = process.argv.slice(3);
const manifestPath = resolve(workspaceDir, manifestArg);

const getFlagValue = (name) => {
  const equalsPrefix = `${name}=`;
  const equalsMatch = cliArgs.find((arg) => arg.startsWith(equalsPrefix));
  if (equalsMatch) {
    return equalsMatch.slice(equalsPrefix.length);
  }

  const index = cliArgs.indexOf(name);
  return index === -1 ? undefined : cliArgs[index + 1];
};

const hasFlag = (name) => cliArgs.includes(name);

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

const writeJson = (path, value) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
};

const numberOption = (value, fallback) => {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

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
const previewStoryboardDir = join(workDir, "preview-storyboards");
mkdirSync(renderDir, { recursive: true });
mkdirSync(frameDir, { recursive: true });

const sourceStoryboard = readJson(storyboardPath);
const storyboardDuration = sourceStoryboard.video?.duration;
if (typeof storyboardDuration !== "number" || storyboardDuration <= 0) {
  console.error(`Storyboard video.duration must be a positive number: ${storyboardPath}`);
  process.exit(1);
}

const previewSeconds = numberOption(
  getFlagValue("--preview-seconds"),
  numberOption(manifest.render?.previewSeconds, null),
);
const segmentedRender =
  hasFlag("--segment-render") || manifest.render?.segmented === true;
const segmentSeconds = numberOption(
  getFlagValue("--segment-seconds"),
  numberOption(
    manifest.render?.segmentSeconds,
    sourceStoryboard.longVideoPolicy?.segmentLengthSeconds ?? 120,
  ),
);
const longRenderThresholdSeconds = numberOption(
  getFlagValue("--long-render-threshold-seconds"),
  numberOption(manifest.render?.longRenderThresholdSeconds, 10 * 60),
);
const allowLongRender =
  hasFlag("--allow-long-render") || manifest.render?.allowLongRender === true;

if (
  storyboardDuration > longRenderThresholdSeconds &&
  !allowLongRender &&
  !previewSeconds &&
  !segmentedRender
) {
  console.error(
    [
      `Refusing full Remotion render for ${storyboardDuration.toFixed(1)}s video.`,
      `Threshold is ${longRenderThresholdSeconds.toFixed(1)}s.`,
      "Use --preview-seconds 60 for quick visual QA, or --allow-long-render for an explicit full render.",
      "Use --segment-render for production long videos.",
      "For production long videos, use segmented rendering instead of a single Remotion render.",
    ].join("\n"),
  );
  process.exit(1);
}

const effectivePreviewSeconds =
  previewSeconds && previewSeconds > 0
    ? Math.min(previewSeconds, storyboardDuration)
    : null;
const effectiveRenderDuration = effectivePreviewSeconds ?? storyboardDuration;
const baseRenderName = effectivePreviewSeconds
  ? `${projectName}-preview-${Math.round(effectivePreviewSeconds)}s`
  : projectName;
const renderName = segmentedRender ? `${baseRenderName}-segmented` : baseRenderName;
const effectiveStoryboardPath = effectivePreviewSeconds && !segmentedRender
  ? join(previewStoryboardDir, `${renderName}-storyboard.json`)
  : storyboardPath;

if (effectivePreviewSeconds && !segmentedRender) {
  const clippedStoryboard = windowStoryboard({
    storyboard: sourceStoryboard,
    start: 0,
    end: effectivePreviewSeconds,
    timelineDuration: storyboardDuration,
  });
  writeJson(effectiveStoryboardPath, clippedStoryboard);
}

const rawOutputPath = join(renderDir, `${renderName}-${outputOrientation}-raw.mp4`);
const outputPath = join(renderDir, `${renderName}-${outputOrientation}.mp4`);
const contactSheetPath = join(
  frameDir,
  `${renderName}-${outputOrientation}-contact-sheet.png`,
);
const publicHostPath = join(projectDir, "public", "host.mp4");

copyFileSync(sourceVideo, publicHostPath);
if (!segmentedRender && resolve(effectiveStoryboardPath) !== resolve(projectStoryboardPath)) {
  copyFileSync(effectiveStoryboardPath, projectStoryboardPath);
}

const deliverySize =
  outputOrientation === "vertical"
    ? { width: 720, height: 1280, aspect: "9:16" }
    : { width: 1920, height: 1080, aspect: "16:9" };

const deliveryVideoFilter = `fps=30,scale=${deliverySize.width}:${deliverySize.height}:flags=lanczos:in_range=pc:out_range=tv,setsar=1,format=yuv420p`;

const deliveryEncodingArgs = () => [
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
];

const renderRaw = ({ storyboard, rawOutput }) => {
  if (resolve(storyboard) !== resolve(projectStoryboardPath)) {
    copyFileSync(storyboard, projectStoryboardPath);
  }

  run("node", [join(scriptDir, "validate-storyboard.mjs"), storyboard], {
    cwd: workspaceDir,
    stdio: "inherit",
  });

  run(
    "npx",
    [
      "remotion",
      "render",
      composition,
      rawOutput,
      "--codec",
      manifest.render?.codec ?? "h264",
      "--crf",
      String(manifest.render?.crf ?? 18),
      "--concurrency",
      String(manifest.render?.concurrency ?? 2),
      "--timeout",
      String(manifest.render?.timeoutInMilliseconds ?? 120000),
    ],
    { cwd: projectDir, stdio: "inherit" },
  );
};

const encodeDelivery = ({ input, output }) => {
  run(
    "ffmpeg",
    [
      "-y",
      "-i",
      input,
      "-vf",
      deliveryVideoFilter,
      ...deliveryEncodingArgs(),
      output,
    ],
    { cwd: workspaceDir, stdio: "inherit" },
  );
};

const concatAndEncodeDelivery = ({ segments, output, duration }) => {
  const inputs = segments.flatMap((segment) => ["-i", segment.output]);
  const concatInputs = segments
    .map((_, index) => `[${index}:v:0][${index}:a:0]`)
    .join("");
  const filterComplex = [
    `${concatInputs}concat=n=${segments.length}:v=1:a=1[vcat][acat]`,
    `[vcat]${deliveryVideoFilter}[vout]`,
    "[acat]aresample=async=1:first_pts=0[aout]",
  ].join(";");

  run(
    "ffmpeg",
    [
      "-y",
      ...inputs,
      "-filter_complex",
      filterComplex,
      "-map",
      "[vout]",
      "-map",
      "[aout]",
      ...deliveryEncodingArgs(),
      ...(Number.isFinite(duration) ? ["-t", String(Number(duration.toFixed(3)))] : []),
      output,
    ],
    { cwd: workspaceDir, stdio: "inherit" },
  );
};

const contactSheetFrames = (duration) => {
  const effectiveFrameCount = Math.max(1, Math.floor(duration * 30));
  return [0.1, 0.35, 0.65, 0.9].map((position) =>
    Math.min(effectiveFrameCount - 1, Math.max(0, Math.round(effectiveFrameCount * position))),
  );
};

const writeContactSheet = ({ input, duration, output }) => {
  const frames = manifest.qa?.stillFrames?.length
    ? manifest.qa.stillFrames
    : contactSheetFrames(duration);
  const selectFrames = frames.map((frame) => `eq(n\\,${frame})`).join("+");

  run(
    "ffmpeg",
    [
      "-y",
      "-i",
      input,
      "-vf",
      `select='${selectFrames}',scale=960:-1,tile=2x2`,
      "-frames:v",
      "1",
      "-update",
      "1",
      output,
    ],
    { cwd: workspaceDir, stdio: "inherit" },
  );
};

const probeOutput = (path) =>
  run("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration,size",
    "-show_entries",
    "stream=index,codec_type,codec_name,width,height,channels",
    "-of",
    "json",
    path,
  ]);

const buildSegments = (duration, length) => {
  const segmentLength = Number.isFinite(length) && length > 0 ? length : 120;
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

const concatFileLine = (file) => `file '${file.replaceAll("'", "'\\''")}'`;

const renderSegmented = () => {
  const segmentDir = join(renderDir, "segments", `${renderName}-${outputOrientation}`);
  mkdirSync(segmentDir, { recursive: true });
  const segments = buildSegments(effectiveRenderDuration, segmentSeconds);
  const renderedSegments = [];

  for (const segment of segments) {
    const segmentLabel = `segment-${String(segment.index).padStart(3, "0")}`;
    const segmentStoryboardPath = join(segmentDir, `${segmentLabel}-storyboard.json`);
    const segmentRawPath = join(segmentDir, `${segmentLabel}-raw.mp4`);
    const segmentOutputPath = join(segmentDir, `${segmentLabel}.mp4`);
    const segmentStoryboard = windowStoryboard({
      storyboard: sourceStoryboard,
      start: segment.start,
      end: segment.end,
      mediaStart: segment.start,
      timelineDuration: storyboardDuration,
    });

    writeJson(segmentStoryboardPath, segmentStoryboard);
    console.log(
      `Rendering ${segmentLabel}: ${segment.start.toFixed(2)}-${segment.end.toFixed(2)}s`,
    );
    renderRaw({ storyboard: segmentStoryboardPath, rawOutput: segmentRawPath });
    encodeDelivery({ input: segmentRawPath, output: segmentOutputPath });
    renderedSegments.push({
      ...segment,
      storyboard: segmentStoryboardPath,
      raw: segmentRawPath,
      output: segmentOutputPath,
    });
  }

  const concatListPath = join(segmentDir, "concat.txt");
  writeFileSync(
    concatListPath,
    `${renderedSegments.map((segment) => concatFileLine(segment.output)).join("\n")}\n`,
  );

  concatAndEncodeDelivery({
    segments: renderedSegments,
    output: outputPath,
    duration: effectiveRenderDuration,
  });

  writeContactSheet({
    input: outputPath,
    duration: effectiveRenderDuration,
    output: contactSheetPath,
  });

  const reportPath = join(segmentDir, "segment-report.json");
  writeJson(reportPath, {
    projectName,
    output: outputPath,
    contactSheet: contactSheetPath,
    orientation: outputOrientation,
    totalDuration: effectiveRenderDuration,
    segmentSeconds,
    segmentCount: renderedSegments.length,
    concatMode: "filter-reencode",
    segments: renderedSegments,
  });

  return {
    reportPath,
    renderedProbe: probeOutput(outputPath),
  };
};

console.log(`Source: ${sourceVideo}`);
console.log(`Detected: ${probe.width}x${probe.height} ${probe.orientation}`);
console.log(`Output orientation: ${outputOrientation}`);
console.log(`Composition: ${composition}`);
console.log(`Copied source to: ${publicHostPath}`);
console.log(`Storyboard: ${storyboardPath}`);
console.log(`Storyboard duration: ${storyboardDuration.toFixed(2)}s`);
if (effectivePreviewSeconds) {
  console.log(`Preview render: ${effectivePreviewSeconds.toFixed(2)}s`);
  console.log(`Preview storyboard: ${effectiveStoryboardPath}`);
}
if (segmentedRender) {
  console.log(`Segmented render: ${segmentSeconds.toFixed(2)}s segments`);
}
if (!segmentedRender && resolve(effectiveStoryboardPath) !== resolve(projectStoryboardPath)) {
  console.log(`Copied storyboard to: ${projectStoryboardPath}`);
}

run("npm", ["run", "lint"], { cwd: projectDir, stdio: "inherit" });

const { reportPath, renderedProbe } = segmentedRender
  ? renderSegmented()
  : (() => {
      renderRaw({ storyboard: effectiveStoryboardPath, rawOutput: rawOutputPath });
      encodeDelivery({ input: rawOutputPath, output: outputPath });
      writeContactSheet({
        input: outputPath,
        duration: effectiveRenderDuration,
        output: contactSheetPath,
      });
      return { reportPath: null, renderedProbe: probeOutput(outputPath) };
    })();

if (manifest.qa?.openAfterRender !== false) {
  run("open", [outputPath], { stdio: "inherit" });
}

console.log("Render complete");
console.log(`Video: ${outputPath}`);
if (!segmentedRender) {
  console.log(`Raw render: ${rawOutputPath}`);
}
console.log(`Contact sheet: ${contactSheetPath}`);
if (reportPath) {
  console.log(`Segment report: ${reportPath}`);
}
console.log(
  `Delivery metadata for Telegram/API upload: width=${deliverySize.width}, height=${deliverySize.height}, aspect=${deliverySize.aspect}`,
);
console.log(renderedProbe);
