# Video Tool Integration Notes

## Ceeon/videocut-skills

Use for:

- Chinese talking-head cleanup rules.
- "Delete earlier, keep later" retake handling.
- Silence, filler, stutter, repeated sentence, and fragment detection.
- Human review before execution.

Do not copy wholesale:

- Its cloud ASR dependency is optional for this repo.
- Its paths are Claude Code skill oriented, not repo-package oriented.

## browser-use/video-use

Use for:

- EDL as the editing contract.
- Per-segment extract, concat, then overlays/subtitles.
- 30ms audio fades at every cut boundary.
- Word-boundary cuts only.
- Transcript caching.
- Self-eval before showing the user.
- Treating Remotion/HyperFrames/Manim/PIL as animation slots.

Do not copy wholesale:

- It is intentionally general; this repo is optimized for Remotion host-overlay videos.

## zinan92/videocut

Use for:

- Capability-oriented CLI architecture.
- `transcribe`, `autocut`, `subtitle`, `hook`, `clip`, `cover`, `speed` as independent modules.
- Fallback behavior when AI fails.
- Batch-friendly output directories.

Do not copy wholesale:

- This repo should not become a general content repurposing system yet.
- Publishing and platform-content derivation stay out of V10.

## Local Integration Decision

This repo implements the combined approach:

```text
videocut-style cleanup
+ video-use correctness
+ zinan-style modular pipeline
+ Remotion visual engine
```

The result is not a fully automatic black box. It is an orchestrated workbench
where the agent can call one capability at a time and stop at approval gates.
