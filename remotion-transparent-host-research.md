# Remotion Transparent Host Video Research

Date: 2026-05-23

## Goal

Replicate the reference style: a talking-head video stays visible as the base layer, while a high-polish Remotion motion-graphics layer plays on top. The visual language is not a generic slide deck. It is a hybrid of host video, transparent UI overlays, animated data cards, chapter/navigation bars, bilingual captions, and impact graphics timed to narration.

## What The Reference Video Is Probably Doing

The screenshots point to a Remotion-led assembly workflow:

1. A real talking-head recording is the bottom layer.
2. Remotion renders all animated labels, stats, charts, panels, captions, chapter bars, and callouts as upper layers.
3. The overlay graphics use transparency directly in CSS/React, not a fully opaque slide canvas.
4. The final can be rendered in either of two ways:
   - one master Remotion composition containing both the host video and overlays, exported as MP4;
   - a transparent Remotion overlay exported as ProRes 4444 / WebM alpha, then composited over the host video in an editor.
5. If graphics need to appear behind the person, the host must be separated into foreground subject and background plate. The provided examples do not require that for every scene, but the “premium” look benefits from it in selected moments.

The third screenshot strongly suggests the creator built a private skill stack, not just installed public Remotion skills. The listed skills map to practical production constraints:

| Screenshot skill | Likely meaning |
|---|---|
| `remotion-core` | Transparent-layer rules, 4K scaling, phase indexing, frame/tick conventions, font lower bounds |
| `remotion-motion-design` | House style, layout archetypes, face-safe zones, bilingual layout |
| `remotion-apple-keynote-style` | Apple/Keynote-like scene patterns, image fit modes, subtitle safe lines, palette rules |
| `remotion-asset-gathering` | Asset manifest, screenshot/video capture workflow |
| `remotion-asset-usage` | Safe image/video usage, fit modes, focus/top-skip positioning |
| `remotion-long-video-assembly` | Master timeline, host vs B-roll collision checks, gap pacing |
| `remotion-sfx-system` | Sound effect taxonomy, impact density limits, spring landings |
| `remotion-4k-export` | RAM-bound concurrency, CRF, temp disk, render monitoring |
| `cover-title` | Title-card and cover selection rules |

## Repo Findings

### 1. `remotion-dev/remotion`

Best foundation. Remotion already supports exactly the required structure: React components, frame-based animation, `<Sequence>`, `<Series>`, media tracks, captions, transparent video export, and overlay templates.

Relevant findings:

- Official overlay export supports transparent ProRes 4444 for use in Final Cut / Premiere / DaVinci.
- Transparent WebM/VP8/VP9 alpha is supported for browser playback.
- The monorepo has a `template-overlay` project with ProRes alpha config.
- Remotion has a template category for overlays, and `create-video` includes `overlay`.

Use Remotion as the core renderer.

### 2. `remotion-dev/skills`

Useful but too generic for the reference video. It gives correct Remotion primitives:

- no CSS transitions/animations; use `useCurrentFrame()`, `interpolate()`, `spring()`, `Sequence`;
- transparent video export rules;
- captions via `@remotion/captions`;
- sequencing, timing, audio, SFX, transitions, text animation, asset handling.

It does not provide the creator's house style. We need to add our own local skills on top of this.

### 3. `av/remotion-bits`

Useful component source, not a full workflow. It gives reusable Remotion effects:

- animated counters;
- animated text;
- code blocks/typewriter;
- matrix/code backgrounds;
- particle systems;
- 3D scenes and cursor/screenshot flyover;
- staggered reveals, card stacks, list reveal, fracture/reassemble.

This is good for fast detail work, especially the numeric cards and animated text in the reference. It will not produce the full “host video + transparent graphics” format by itself.

### 4. `digitalsamba/claude-code-video-toolkit`

Closest public production workflow. It combines Remotion, templates, project lifecycle, voiceover, SFX/music, Playwright recording, design review, and Codex skill migration.

Useful pieces:

- `NarratorPiP`, `Vignette`, `LogoWatermark`, slide templates, transitions library;
- project structure for longer videos;
- workflow around assets, voiceover, rendering, scene review;
- Codex migration script that installs Remotion-related skills.

Limitation: its default templates are product-demo/sprint-review oriented. We should borrow the workflow and selected components, not the visual style.

### 5. `heygen-com/hyperframes`

Very relevant as a secondary tool, especially for background removal and HTML/GSAP video authoring. HyperFrames is HTML-native and agent-friendly, but since the reference creator used Remotion and the goal is to match him, HyperFrames should not be the primary renderer.

The most useful HyperFrames piece is `hyperframes-media remove-background`:

- outputs transparent `.webm` / ProRes 4444 `.mov`;
- can emit both a subject cutout and an inverse-alpha plate;
- supports the exact “text/graphics between background room and foreground person” pattern.

This can be used as preprocessing for a Remotion project: generate `subject.webm` and optionally `plate.webm`, then import them in Remotion.

### 6. `cclank/lanshu-waytovideo`

Not relevant for the core reference style. It automates Jianying/XiaoYunque/Seedance video generation via Playwright. Useful if we need AI-generated B-roll or image-to-video clips, but not for deterministic overlay graphics or a Remotion production system.

## Recommended Architecture

Use a Remotion master composition:

```text
MasterComposition
  HostVideoLayer            original talking-head mp4
  OptionalBackgroundPlate   only when doing behind-person graphics
  MotionGraphicsLayer       all Remotion UI overlays
  OptionalSubjectCutout     only when foreground person must cover graphics
  CaptionLayer              Chinese + English subtitles
  ChapterBarLayer           bottom navigation / progress markers
  SfxAudioLayer             whooshes, hits, risers
```

For most scenes:

```text
<HostVideo full screen>
<Transparent overlay cards / text / charts / lower thirds>
<Captions>
```

For premium behind-person moments:

```text
<Background plate with subject hole>
<Text or graphics behind person>
<Subject cutout WebM with alpha>
<Front overlays / captions>
```

## Visual System To Match

The reference has a consistent “coded keynote over real footage” style:

- aspect: likely 16:9, 4K-safe, social-platform crop aware;
- background: talking-head footage with warm room lighting and subtle dark vignette;
- typography: large condensed uppercase English labels, bold Chinese headlines, small bilingual supporting text;
- color: electric blue for “skills”, amber/yellow for “path/months”, red for negative/early work, green for verified/self-built;
- overlays: semi-transparent glass panels with thin borders, subtle blur/shadow, rounded corners around 8-12px;
- motion: springy entrance, fast impacts, hold long enough to read, not continuous noisy animation;
- subtitles: large Chinese first, smaller English second, dark translucent backing box;
- chapters: thin bottom bar with labeled sections and tick marks;
- safe zones: avoid covering the face center, mouth, and key hand gestures.

## Public Assets/Tools That Are Enough

We do not need to find a complete template. The public pieces are enough:

1. Remotion official project + overlay export.
2. Official Remotion skills for correct frame-based implementation.
3. Remotion Bits for component/effect snippets.
4. Claude Code Video Toolkit for workflow and components.
5. HyperFrames media preprocessing only if we need person/background separation.

The missing piece is not tooling. The missing piece is a house-style skill pack that encodes the reference constraints.

## Custom Skills We Should Build

To match the creator, create a local skill set similar to his:

1. `remotion-host-overlay-core`
   - composition contract, transparent layers, 4K/1080 scaling, frame constants, export presets.

2. `remotion-reference-house-style`
   - colors, typography, overlay panel treatment, glow/shadow limits, motion timing, safe-zone rules.

3. `remotion-bilingual-captions`
   - Chinese/English caption layout, line length, backing box, word emphasis, subtitle safe lines.

4. `remotion-longform-assembly`
   - timeline manifest, scene phases, overlay collision checks, host/B-roll/audio track conventions.

5. `remotion-sfx-pack`
   - SFX categories, impact density rules, mapping of UI actions to sounds.

6. `remotion-export-4k`
   - local render settings, ProRes alpha, WebM alpha, MP4 final, memory/concurrency presets.

## MVP Plan

Build a 10-15 second proof first, not a full long video.

Inputs:

- one talking-head clip;
- short script/transcript;
- 2-3 overlay beats:
  - title label top-left;
  - one large number/stat on the right;
  - one glass panel / table card;
  - bilingual subtitle and bottom chapter bar.

Deliverables:

1. `host-overlay-demo` Remotion project.
2. `public/host.mp4`.
3. `src/style-tokens.ts` for the reference house style.
4. `src/layers/HostVideo.tsx`.
5. `src/layers/CaptionLayer.tsx`.
6. `src/layers/ChapterBar.tsx`.
7. `src/overlays/*` for stat cards, glass panels, callouts.
8. Render outputs:
   - final MP4 with host + overlays;
   - optional transparent overlay `.mov` / `.webm` for external editor use.

## Decision

Prioritize Remotion. Use HyperFrames only for preprocessing foreground/background alpha if a shot requires graphics behind the person. Use Remotion Bits as a component source, not as the production architecture. Ignore Jianying for this specific replication unless we later need AI-generated B-roll.

The fastest path to “exactly like him” is:

1. create a Remotion MVP project;
2. encode his house style as reusable tokens and components;
3. implement one 10-15 second shot matching the screenshots;
4. only then package the patterns into local skills.

