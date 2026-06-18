# Reusable Remotion Host Overlay Workflow

## Principle

The output format follows the source video orientation by default.

- Vertical source: render a vertical Remotion composition.
- Horizontal source: render a horizontal Remotion composition.
- `outputOrientation: "auto"` is the default for reusable work.

Only override this when a project explicitly requires a different delivery format.

## Current Standard Pipeline

1. Put the source video path in a manifest.
2. Detect source orientation with `ffprobe`.
3. Copy the source video into the Remotion project as `public/host.mp4`.
4. Use AI to create or update the transcript/storyboard/phase model.
5. Write the storyboard into `remotion-host-overlay-demo/src/storyboard.json`.
6. Validate the storyboard before rendering.
7. Render the orientation-matched Remotion composition.
8. Post-process the render into a delivery-safe MP4.
9. Generate a contact sheet for visual QA.
10. Open the render for playback.
11. Write or update a handoff/audit document.

## Default Length Boundary

The default production target is now **5-10 minutes**.

This means:

- Keep the single-video workflow as the default path.
- Use `storyboard.json` as the content source of truth.
- Split the video conceptually into 60-120 second segments, even when rendering one final composition.
- Give every segment a primary visual beat and passive context policy.
- Do not animate every sentence. Use visual beats around every 20 seconds unless the content needs a tighter rhythm.
- Generate QA frames per segment, not only at the beginning/middle/end of the full video.

If the source is longer than 10 minutes, use segmented rendering:

- Render chunks of roughly 60-120 seconds.
- QA each chunk.
- Assemble final video with `ffmpeg concat`.
- Keep SFX sparse and avoid repeating the same motion template for every point.

## Attention Choreography Rule

The video should not behave like an information wall.

Default rule:

- Only one primary visual region should update at a time.
- Other regions may remain on screen only as passive context: frozen, dimmed, or visually quiet.
- When a new concept animation starts, the previous concept should either:
  - freeze as a completed note,
  - fade out,
  - shrink into a small passive marker, or
  - be covered/replaced by the next visual.
- Do not update left and right panels at the same moment unless it is a deliberate transition beat.

Example:

- Concept 1 appears on the left.
- Concept 2 appears on the lower-left or right.
- Concept 1 stops animating or fades down before Concept 2 starts moving.

This keeps viewer attention on one active idea instead of stretching attention across multiple simultaneous animations.

## Audio And SFX Policy

Use Remotion for audio assembly by default.

- SFX live in `remotion-host-overlay-demo/public/sfx/`.
- Background music should live in `remotion-host-overlay-demo/public/music/`.
- Remotion uses `<Audio>` and `<Sequence>` to place SFX and music on the timeline.
- Keep SFX under the speaker voice.
- Background music should be very low volume and ducked under speech when possible.

Do not create a separate repo for SFX/music at this stage. A separate sound-library repo only makes sense later if multiple video projects share a large curated audio catalog.

## Driver Model

This workflow is intentionally split into three layers:

- **Storyboard JSON driven**: duration, chapters, captions, phases, skill board, attention timeline.
- **Manifest/Markdown driven**: source path, topic, transcript, handoff, render options.
- **Remotion code driven**: layout, motion templates, visual system, SFX, components.
- **Script driven**: orientation detection, copying source assets, rendering, delivery-safe encoding, ffprobe, contact sheet, opening output.

The current productization step is complete for V9: Remotion reads `src/storyboard.json`, so phases, captions, chapters, duration, and attention timing no longer require editing TypeScript.

## Files

- `workflow/manifest.template.json`: copy this for a new video.
- `workflow/capabilities/README.md`: capability cards for the agent orchestrator.
- `workflow/rules/autocut/`: spoken-word cleanup rules adapted from videocut-style workflows.
- `docs/architecture.md`: product architecture and hard rules.
- `docs/research/video-tool-integration.md`: integration notes for the three researched repos.
- `remotion-host-overlay-demo/src/storyboard.json`: content and attention source of truth.
- `scripts/detect-orientation.mjs`: returns video width, height, duration, and orientation.
- `scripts/ingest-video.mjs`: richer ffprobe metadata for orchestration.
- `scripts/build-edl.mjs`: transcript + source video to autocut EDL.
- `scripts/render-edl.mjs`: EDL to cleaned MP4 with 30ms cut fades.
- `scripts/generate-storyboard-from-transcript.mjs`: deterministic storyboard fallback.
- `scripts/qa-render.mjs`: output geometry and delivery QA.
- `scripts/deliver-telegram.mjs`: Telegram upload with explicit metadata.
- `scripts/run-video-pipeline.mjs`: thin orchestrator for the local capability chain.
- `scripts/validate-storyboard.mjs`: validates storyboard timing before render.
- `scripts/render-workflow.mjs`: copies input video, chooses composition, renders, creates a delivery-safe MP4, creates contact sheet, and optionally opens the output.
- `remotion-host-overlay-demo`: Remotion project.
- `remotion-host-overlay-work`: transcripts, renders, QA frames, and handoff docs.

## How To Run A New Video

Copy the template:

```bash
cp workflow/manifest.template.json workflow/manifest.json
```

Edit `workflow/manifest.json`:

- `sourceVideo`
- `projectName`
- `topic`
- `summary`
- `phases`
- `skillBoard`

Then run:

```bash
node scripts/render-workflow.mjs workflow/manifest.json
```

Run the orchestrator preflight:

```bash
npm run pipeline -- workflow/manifest.json
```

Build an autocut EDL from a cached transcript:

```bash
npm run edl:build -- /path/to/source.mp4 --transcript /path/to/transcript.json --out remotion-host-overlay-work/edit/edl.json
```

Render the cleaned EDL before Remotion overlay:

```bash
npm run edl:render -- remotion-host-overlay-work/edit/edl.json --out remotion-host-overlay-work/edit/cut.mp4
```

Validate the storyboard directly:

```bash
cd remotion-host-overlay-demo
npm run storyboard:validate
```

## Orientation Rules

When `outputOrientation` is `auto`:

- `width > height` chooses `HostOverlayReferenceV9`.
- `height >= width` chooses `HostOverlayVideo`.

Current mappings:

| Source orientation | Composition | Output |
| --- | --- | --- |
| Vertical | `HostOverlayVideo` | 720x1280 |
| Horizontal | `HostOverlayReferenceV9` | 1920x1080 |

## Delivery Rules

The Remotion raw render is not the final delivery artifact.

`render-workflow.mjs` now creates:

- `*-raw.mp4`: direct Remotion output.
- `*.mp4`: delivery-safe output with fixed dimensions, `SAR=1:1`, `yuv420p`, AAC audio, and `+faststart`.

For Telegram Bot API uploads, do not rely on Telegram to infer video metadata. Send explicit metadata with the upload:

- Vertical: `width=720`, `height=1280`, `duration=<seconds>`, `supports_streaming=true`.
- Horizontal: `width=1920`, `height=1080`, `duration=<seconds>`, `supports_streaming=true`.

Without explicit metadata, Telegram may display a valid 9:16 MP4 as a `320x320` square preview.

## Current Limitation

The current Remotion project reads storyboard content from `src/storyboard.json`. Full content automation still requires an AI runner that turns transcript files into that JSON automatically, plus per-segment QA generation for 5-10 minute videos.
