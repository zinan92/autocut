# Capability Cards

## 01 Ingest

Type: deterministic script.

Command:

```bash
node scripts/ingest-video.mjs <video> --out ingest.json
```

Output: source metadata including orientation, duration, fps, codec, audio, HDR flags.

## 02 Transcribe

Type: external ASR or cached transcript.

Current contract: provide `transcript.json` with word-level timestamps.

Command:

```bash
node scripts/transcribe-video.mjs <video> --reuse existing-transcript.json
```

Future providers:

- MLX Whisper local backend.
- Whisper CLI.
- Cloud ASR when explicitly configured.

## 03 Autocut

Type: deterministic rules plus optional AI review.

Command:

```bash
node scripts/build-edl.mjs <video> --transcript transcript.json --out edl.json
```

Output: `edl.json` with delete candidates and keep ranges.

Rules live in `workflow/rules/autocut/`.

## 04 Review

Type: human approval gate.

V1 review UI:

```bash
node scripts/serve-assembly-ui.mjs --assembly remotion-host-overlay-work/assembly/assembly.json
```

The left panel reorders/deletes transcript blocks. The right panel virtually
plays the current block order without rendering a new MP4.

Required when:

- semantic delete candidates are present,
- more than 15% of runtime is removed,
- one delete segment is longer than 5 seconds,
- the source is a final/important video.

## 05 Edit Plan

Type: agent judgment with fixed boundaries.

Output: plain-English strategy before destructive editing.

The agent may suggest pacing and structure, but should not silently execute
large deletions without review.

## 06 Storyboard

Type: AI or deterministic fallback.

Command:

```bash
node scripts/generate-storyboard-from-transcript.mjs --transcript transcript.json
```

Output: Remotion `storyboard.json` with captions, phases, and attention timeline.

## 07 Remotion Overlay

Type: Remotion visual engine.

Responsibility:

- composition layout,
- visual metaphors,
- SFX and BGM placement,
- orientation-specific overlay design,
- attention choreography.

## 08 Render

Type: deterministic script plus Remotion CLI.

Command:

```bash
node scripts/render-workflow.mjs workflow/manifest.json
```

Output:

- `*-raw.mp4`: Remotion render.
- `*.mp4`: delivery-safe encode.

## 09 QA

Type: deterministic checks plus optional AI visual audit.

Command:

```bash
node scripts/qa-render.mjs output.mp4 --source source.mp4 --out qa-report.json
```

Checks:

- orientation,
- dimensions,
- sample aspect ratio,
- pixel format,
- audio presence,
- duration,
- platform metadata.

## 10 Delivery

Type: deterministic platform handoff.

Command:

```bash
TELEGRAM_BOT_TOKEN=... node scripts/deliver-telegram.mjs video.mp4 --chat <id>
```

Telegram upload must pass explicit width, height, duration, and streaming metadata.
