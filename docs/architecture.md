# Remotion Video Workbench Architecture

This repo is an agent-orchestrated video production system.

Remotion is the visual layer. It should not own transcription, spoken-word cleanup,
EDL decisions, platform upload rules, or QA policy.

## Product Shape

Input:

- Talking-head source video.
- Optional transcript with word-level timestamps.
- Manifest describing topic, output target, style, and policy.

Output:

- Clean edit plan / EDL.
- Remotion storyboard JSON.
- Orientation-matched Remotion render.
- Delivery-safe MP4.
- QA report and platform metadata.

## Orchestration Model

The agent is the orchestrator:

1. Inspect the source.
2. Decide which capability modules are needed.
3. Run deterministic scripts.
4. Ask for approval when edits are destructive.
5. Generate or update storyboard data.
6. Render with Remotion.
7. Verify output before delivery.

The agent may choose module order, but it must not skip correctness gates.

## Capability Layers

```text
01 ingest          deterministic ffprobe metadata
02 transcribe      word-level transcript provider or cache
03 autocut         silence/filler/retake delete candidates
04 review          human approval for destructive edits
05 edit-plan       EDL strategy and plain-English plan
06 storyboard      transcript/plan to Remotion storyboard.json
07 overlay         Remotion visual composition
08 render          raw render plus delivery encode
09 qa              geometry, captions, face safety, delivery checks
10 delivery        Telegram / platform upload metadata
```

## Data Contracts

- `manifest.json`: project intent and fixed routing policy.
- `ingest.json`: source metadata from ffprobe.
- `transcript.json`: word-level ASR cache.
- `edl.json`: keep ranges, delete ranges, and cut policy.
- `storyboard.json`: Remotion content and attention choreography.
- `qa-report.json`: objective delivery checks plus review warnings.

## Hard Rules

- Source orientation controls output orientation unless manifest explicitly overrides it.
- Never cut inside a word.
- Add 30ms audio fades at cut boundaries.
- Subtitles are applied after overlays.
- Remotion raw renders are not final delivery files.
- Delivery files must use square pixels, `yuv420p`, AAC audio, and `+faststart`.
- Telegram Bot API uploads must send explicit `width`, `height`, and `duration`.
- AI may suggest destructive cuts, but large semantic deletions require review.

## What Came From Each Reference

- `Ceeon/videocut-skills`: Chinese spoken-word cleanup rules and review-first workflow.
- `browser-use/video-use`: production correctness rules, EDL-first editing, output self-eval.
- `zinan92/videocut`: modular CLI capability architecture, fallback behavior, batch-friendly scripts.
- This repo: Remotion overlay style, attention choreography, orientation routing, delivery encode.
