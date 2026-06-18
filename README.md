# Remotion Video Workbench

Agent-orchestrated video production pipeline for talking-head videos.

This project combines:

- videocut-style spoken-word cleanup,
- video-use-style production correctness,
- modular CLI capabilities,
- Remotion host-overlay rendering.

## Current Status

The repo is intended to be run locally; generated media and session outputs are ignored.

Existing Remotion demo:

- `remotion-host-overlay-demo/`
- `remotion-host-overlay-work/`
- `workflow/manifest.json`

New capability layer:

- `packages/`
- `scripts/`
- `workflow/capabilities/`
- `workflow/rules/`
- `docs/`

## Common Commands

```bash
npm run ingest -- /path/to/video.mp4 --out ingest.json
npm run transcribe -- --manifest workflows/host-overlay-v10/manifest.json
npm run assembly:build -- --manifest workflows/host-overlay-v10/manifest.json
npm run assembly:ui -- --assembly remotion-host-overlay-work/assembly/assembly.json
npm run assembly:export -- --assembly remotion-host-overlay-work/assembly/assembly.json --out remotion-host-overlay-work/assembly/edl.json
npm run edl:render -- remotion-host-overlay-work/assembly/edl.json --out remotion-host-overlay-work/assembly/clean-master.mp4
npm run qa -- remotion-host-overlay-work/assembly/clean-master.mp4 --edl remotion-host-overlay-work/assembly/edl.json
npm run pipeline -- workflow/manifest.json
npm run storyboard:from-transcript -- --transcript /path/to/transcript.json --manifest workflow/manifest.json
```

For a single source with an existing transcript cache:

```bash
npm run transcribe -- /path/to/video.mp4 --reuse /path/to/transcript.json --out-dir remotion-host-overlay-work/transcripts
```

Render the current Remotion workflow:

```bash
node scripts/render-workflow.mjs workflow/manifest.json
```

## Hard Rules

- Keep source orientation unless manifest explicitly overrides it.
- Do not cut inside words.
- Add 30ms fades at cut boundaries.
- In V1, users may reorder/delete assembly blocks but not rewrite block text for source mapping.
- `assembly.json` is the UI source of truth; `edl.json` is the render source of truth.
- Render raw Remotion output first, then delivery-safe MP4.
- QA before delivery.
- Telegram delivery must include explicit width, height, and duration.
