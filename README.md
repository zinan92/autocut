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
npm run proxy -- --manifest workflow/manifest.json --out-dir remotion-host-overlay-work/proxies --out-manifest workflow/manifest.proxy.json
npm run transcribe -- --manifest workflows/host-overlay-v10/manifest.json
npm run assembly:build -- --manifest workflows/host-overlay-v10/manifest.json
npm run assembly:ui -- --assembly remotion-host-overlay-work/assembly/assembly.json
npm run assembly:export -- --assembly remotion-host-overlay-work/assembly/assembly.json --out remotion-host-overlay-work/assembly/edl.json
npm run edl:render -- remotion-host-overlay-work/assembly/edl.json --out remotion-host-overlay-work/assembly/clean-master.mp4
npm run qa -- remotion-host-overlay-work/assembly/clean-master.mp4 --edl remotion-host-overlay-work/assembly/edl.json
npm run overlay:prepare -- --video remotion-host-overlay-work/assembly/clean-master.mp4 --edl remotion-host-overlay-work/assembly/edl.json --out-dir remotion-host-overlay-work/overlay --project-name my-overlay
npm run pipeline -- workflow/manifest.json
npm run storyboard:from-transcript -- --transcript /path/to/transcript.json --manifest workflow/manifest.json
```

## Assembly Review UI

M2 review flow:

```bash
npm run assembly:ui -- --assembly remotion-host-overlay-work/assembly/assembly.json --out remotion-host-overlay-work/assembly/edl.json --port 8898
```

Open `http://localhost:8898`.

- Drag whole transcript blocks to reorder the virtual cut.
- Click a block to jump the preview player to that source/start time.
- Use `Delete` and `Restore` to remove or bring back blocks without changing source metadata.
- Use `Play Assembly` to preview the active block queue in current order.
- Use `Save` to persist `assembly.json`.
- Use `Export EDL` to write a multi-source `edl.json`; dragging and previewing do not render MP4.
- V1/M2 only allows block reorder/delete/restore. Text, source, start/end, hash, and group are immutable.

## Remotion Overlay Bridge

M3 starts from a rendered clean master and the matching EDL used to render it:

```bash
npm run overlay:prepare -- \
  --video remotion-host-overlay-work/assembly/clean-master.mp4 \
  --edl remotion-host-overlay-work/assembly/edl.json \
  --out-dir remotion-host-overlay-work/overlay \
  --project-name my-overlay

node scripts/validate-storyboard.mjs remotion-host-overlay-work/overlay/storyboard.json
node scripts/render-workflow.mjs remotion-host-overlay-work/overlay/manifest.json
```

`overlay:prepare` fails if the EDL duration does not match the clean master duration. If you edit/export a new EDL in the review UI, render a new clean master before preparing the Remotion overlay.

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
