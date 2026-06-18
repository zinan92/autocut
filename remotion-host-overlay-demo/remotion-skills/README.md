# Remotion Skills For Host Overlay Videos

This folder turns the reference creator's "self-built skills" idea into local production rules for this project. The goal is to make a talking-head source video feel like a transparent, animated Remotion presentation is playing in front of the speaker.

## 1. remotion-core

- Render two canonical compositions:
  - `HostOverlayVideo`: 720x1280 vertical for Shorts/Reels.
  - `HostOverlayLandscape`: 1920x1080 for the reference-style wide frame.
- Keep all timing in seconds and convert through `fps` inside components.
- Drive every major layer from one phase model: `start`, `end`, `kicker`, `title`, `accent`, `stat`, `statLabel`, `detail`.
- Use `OffthreadVideo` for source footage so Remotion handles media decoding reliably.
- Keep captions as structured objects, not burned into images.

## 2. remotion-motion-design

- House style: large editorial typography, hard phase cuts softened by spring pops, colored stat systems, low-radius glass panels.
- Attention rule: one primary visual animation at a time. Supporting panels may persist only as passive context.
- When a new concept appears, older concept graphics should freeze, dim, fade out, shrink, or be replaced instead of continuing to animate.
- Main motion verbs:
  - Phase pop: stat and title scale in on phase start.
  - Current drift: water/current lines translate continuously.
  - Timeline reveal: lower-left explanation enters after the intro.
  - Caption progress: each spoken line gets a top progress bar.
- Accent colors:
  - Model: `#2f8dff`
  - Effort: `#ffbd36`
  - Karma: `#ff4d4d`
  - Will: `#50e38a`

## 3. remotion-apple-keynote-style

- Use oversized numbers as the visual anchor, like a keynote stat slide.
- Keep panels clean and sparse: one headline, one supporting line, one motion diagram.
- Avoid nested cards. Use one strong card only when a framed data object is needed.
- For wide video, leave the speaker visible in the center-right and reserve left/right bands for overlays.

## 4. remotion-asset-gathering

- Source video: `public/host.mp4`
- Transcript source: Whisper output in `../remotion-host-overlay-work/transcript/`
- QA frames: `../remotion-host-overlay-work/renders/*-frames/`
- Do not depend on external web assets for this prototype; all visual components are generated in React/CSS.

## 5. remotion-asset-usage

- Wide composition uses the same vertical video twice:
  - blurred full-frame background
  - sharp foreground host layer
- Foreground host remains audible; background copy is muted.
- Captions sit over the lower center, not on top of the main right stat or left diagram.
- Text must stay inside its fixed layout zones at 1920x1080.

## 6. remotion-long-video-assembly

- Build from the audio/transcript first, then add graphics by phase.
- The current phase map:
  - 0-13s: model intro
  - 13-28s: effort
  - 28-45s: karma
  - 45-63.3s: will
- QA stills should be sampled from each phase before rendering the full video.

## 7. remotion-sfx-system

- Keep SFX low under the speaker voice.
- Use Remotion's `<Audio>` and `<Sequence>` for SFX and background music placement.
- Keep SFX in `public/sfx/`; keep background music in `public/music/`.
- Do not split audio into a separate repo until there is a shared multi-project sound library.
- Use three sound types:
  - `phase-hit.wav`: major phase start.
  - `soft-whoosh.wav`: diagram/timeline movement.
  - `tick.wav`: small emphasis moments.
- Audio cues should support cuts and pops, not compete with speech.

## 8. remotion-4k-export

- Prototype export: H.264, CRF 18, concurrency 2.
- If rendering 4K later, use RAM-bound concurrency and inspect dropped frames before batch rendering.
- Keep rendered outputs in `../remotion-host-overlay-work/renders/`.

## 9. cover-title

- Cover frame should communicate:
  - the speaker is real,
  - the Remotion layer is transparent/animated,
  - the core concept is visible in one large phrase or number.
- Recommended cover timestamps: 3s for intro proof, 16s for effort/current contrast, 54s for final will-power claim.
