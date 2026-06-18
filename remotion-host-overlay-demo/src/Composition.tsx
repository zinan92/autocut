import {
  AbsoluteFill,
  Audio,
  Easing,
  interpolate,
  OffthreadVideo,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import storyboard from "./storyboard.json";

const captions = storyboard.captions;
const phases = storyboard.phases;
const chapters = storyboard.video.chapters;
export const videoDuration = storyboard.video.duration;
const skillRows = storyboard.shortSkillBoard;
const referenceSkillRows = storyboard.referenceSkillBoard;
const attentionTimeline = storyboard.attentionTimeline;
const attentionById = Object.fromEntries(
  attentionTimeline.map((item) => [item.id, item]),
);

const clamp = (value: number) => Math.max(0, Math.min(1, value));

const useSeconds = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return frame / fps;
};

const enter = (second: number, start: number, duration = 0.55) =>
  interpolate(second, [start, start + duration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

const currentCaption = (second: number) =>
  captions.find((caption) => second >= caption.start && second < caption.end) ??
  captions[captions.length - 1];

const currentPhase = (second: number) =>
  phases.find((phase) => second >= phase.start && second < phase.end) ??
  phases[phases.length - 1];

export const HostOverlayVideo = () => {
  const second = useSeconds();
  const phase = currentPhase(second);

  return (
    <AbsoluteFill className="stage">
      <HostVideo />
      <ColorGrade />
      <TopTitle phase={phase} />
      <ForceStack phase={phase} />
      <MetaphorDiagram phase={phase} />
      <InsightPanel phase={phase} />
      <CaptionLayer caption={currentCaption(second)} />
      <ChapterBar second={second} />
      <ProofBadge />
    </AbsoluteFill>
  );
};

export const HostOverlayLandscape = () => {
  const second = useSeconds();
  const phase = currentPhase(second);
  const caption = currentCaption(second);

  return (
    <AbsoluteFill className="landscape-stage">
      <LandscapeHostVideo />
      <LandscapeGrade phase={phase} />
      <LandscapePhaseFlash phase={phase} />
      <LandscapeHeader phase={phase} />
      <LandscapeSkillSheet />
      <LandscapeConceptMap phase={phase} />
      <LandscapeStatColumn phase={phase} />
      <LandscapeTimeline second={second} />
      <LandscapeCaption caption={caption} />
      <LandscapeLowerNav second={second} />
      <SfxLayer />
    </AbsoluteFill>
  );
};

export const HostOverlayReferenceV5 = () => {
  const second = useSeconds();
  const phase = currentPhase(second);
  const caption = currentCaption(second);

  return (
    <AbsoluteFill className="ref-stage">
      <RefHostVideo />
      <LandscapeGrade phase={phase} />
      <LandscapePhaseFlash phase={phase} />
      <RefHeader phase={phase} />
      <RefSkillBoard />
      <RefStoryPanel phase={phase} />
      <RefStatBlock phase={phase} />
      <RefSideCards phase={phase} />
      <RefCaption caption={caption} />
      <RefLowerNav second={second} />
      <SfxLayer />
    </AbsoluteFill>
  );
};

export const HostOverlayReferenceV6 = () => {
  const second = useSeconds();
  const phase = currentPhase(second);
  const caption = currentCaption(second);

  return (
    <AbsoluteFill className="ref-stage ref-stage-v6">
      <RefHostVideo />
      <LandscapeGrade phase={phase} />
      <LandscapePhaseFlash phase={phase} />
      <RefHeader phase={phase} />
      <RefSkillBoard />
      <RefStoryPanel phase={phase} />
      <RefStatBlock phase={phase} />
      <RefSideCards phase={phase} />
      <RefCaption caption={caption} />
      <RefLowerNav second={second} />
      <SfxLayer />
    </AbsoluteFill>
  );
};

export const HostOverlayReferenceV7 = () => {
  const second = useSeconds();
  const phase = currentPhase(second);
  const caption = currentCaption(second);

  return (
    <AbsoluteFill className="ref-stage ref-stage-v7">
      <RefRoomSet phase={phase} />
      <RefHostVideo />
      <LandscapeGrade phase={phase} />
      <LandscapePhaseFlash phase={phase} />
      <RefHeader phase={phase} />
      <RefSkillBoard />
      <RefStoryPanel phase={phase} />
      <RefStatBlock phase={phase} />
      <RefSideCards phase={phase} />
      <RefCaption caption={caption} />
      <RefLowerNav second={second} />
      <SfxLayer />
    </AbsoluteFill>
  );
};

export const HostOverlayReferenceV8 = () => {
  const second = useSeconds();
  const phase = currentPhase(second);
  const caption = currentCaption(second);

  return (
    <AbsoluteFill className="ref-stage ref-stage-v7 ref-stage-v8">
      <RefRoomSet phase={phase} />
      <RefHostVideo />
      <LandscapeGrade phase={phase} />
      <LandscapePhaseFlash phase={phase} />
      <RefHeader phase={phase} />
      <RefSkillBoard />
      <RefStoryPanel phase={phase} />
      <RefStatBlock phase={phase} />
      <RefSideCards phase={phase} />
      <RefCaption caption={caption} />
      <RefLowerNav second={second} />
      <SfxLayer />
    </AbsoluteFill>
  );
};

export const HostOverlayReferenceV9 = () => {
  const second = useSeconds();
  const phase = currentPhase(second);
  const caption = currentCaption(second);

  return (
    <AbsoluteFill className="ref-stage ref-stage-v7 ref-stage-v8 ref-stage-v9">
      <RefRoomSet phase={phase} />
      <RefHostVideo />
      <LandscapeGrade phase={phase} />
      <LandscapePhaseFlash phase={phase} />
      <RefHeader phase={phase} />
      <RefSkillBoard />
      <RefStoryPanelV9 />
      <RefStatBlockV9 />
      <RefSideCardsV9 />
      <RefCaption caption={caption} />
      <RefLowerNav second={second} />
      <SfxLayer />
    </AbsoluteFill>
  );
};

const HostVideo = () => {
  return (
    <AbsoluteFill>
      <OffthreadVideo
        src={staticFile("host.mp4")}
        className="host-video"
        muted={false}
      />
    </AbsoluteFill>
  );
};

const LandscapeHostVideo = () => {
  return (
    <AbsoluteFill>
      <OffthreadVideo
        src={staticFile("host.mp4")}
        className="landscape-bg-video"
        muted
      />
      <OffthreadVideo
        src={staticFile("host.mp4")}
        className="landscape-person-video"
        muted={false}
      />
      <div className="landscape-person-shadow" />
    </AbsoluteFill>
  );
};

const RefHostVideo = () => (
  <AbsoluteFill>
    <OffthreadVideo src={staticFile("host.mp4")} className="ref-bg-video" muted />
    <OffthreadVideo
      src={staticFile("host.mp4")}
      className="ref-person-video"
      muted={false}
    />
    <div className="ref-person-mask" />
  </AbsoluteFill>
);

const RefRoomSet = ({ phase }: { phase: (typeof phases)[number] }) => (
  <AbsoluteFill className="ref-room-set">
    <div className="ref-room-wall" />
    <div className="ref-room-door" />
    <div className="ref-room-curtain" />
    <div className="ref-room-desk" />
    <div className="ref-room-monitor" />
    <div className="ref-room-lamp" style={{ borderColor: `${phase.accent}55` }} />
  </AbsoluteFill>
);

const LandscapeGrade = ({ phase }: { phase: (typeof phases)[number] }) => (
  <AbsoluteFill>
    <div className="landscape-grade-vignette" />
    <div
      className="landscape-grade-accent"
      style={{
        background: `linear-gradient(120deg, ${phase.accent}33, transparent 32%, rgba(0,0,0,0.48) 74%)`,
      }}
    />
  </AbsoluteFill>
);

const LandscapePhaseFlash = ({ phase }: { phase: (typeof phases)[number] }) => {
  const second = useSeconds();
  const flash = interpolate(
    second,
    [phase.start, phase.start + 0.16, phase.start + 0.58],
    [0, 0.48, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.bezier(0.16, 1, 0.3, 1),
    },
  );

  return (
    <div
      className="landscape-phase-flash"
      style={{
        opacity: flash,
        background: `linear-gradient(90deg, transparent 0%, ${phase.accent} 52%, transparent 100%)`,
      }}
    />
  );
};

const SfxLayer = () => {
  const phaseHits = phases.map((phase) => phase.start);
  const whooshes = attentionTimeline.slice(1).map((item) => item.start);
  const ticks = captions
    .filter((_, index) => index % 2 === 1)
    .map((caption) => caption.start);

  return (
    <>
      {phaseHits.map((second) => (
        <Sequence key={`phase-hit-${second}`} from={Math.round(second * 30)} layout="none">
          <Audio src={staticFile("sfx/phase-hit.wav")} volume={0.18} />
        </Sequence>
      ))}
      {whooshes.map((second) => (
        <Sequence key={`whoosh-${second}`} from={Math.round(second * 30)} layout="none">
          <Audio src={staticFile("sfx/soft-whoosh.wav")} volume={0.12} />
        </Sequence>
      ))}
      {ticks.map((second) => (
        <Sequence key={`tick-${second}`} from={Math.round(second * 30)} layout="none">
          <Audio src={staticFile("sfx/tick.wav")} volume={0.12} />
        </Sequence>
      ))}
    </>
  );
};

const LandscapeHeader = ({ phase }: { phase: (typeof phases)[number] }) => {
  const second = useSeconds();
  const opacity = enter(second, phase.start, 0.35);
  const x = interpolate(opacity, [0, 1], [-28, 0]);

  return (
    <div
      className="landscape-header"
      style={{ opacity, transform: `translateX(${x}px)` }}
    >
      <div className="landscape-kicker" style={{ color: phase.accent }}>
        <span style={{ background: phase.accent }} />
        {phase.kicker} · REMOTION SKILLS
      </div>
      <div className="landscape-title">{phase.title}</div>
      <div className="landscape-subtitle">努力 · 业力 · 愿力的动态解释</div>
    </div>
  );
};

const LandscapeSkillSheet = () => {
  const second = useSeconds();
  const frame = useCurrentFrame();
  const opacity =
    enter(second, 1.1, 0.72) *
    interpolate(second, [9.4, 10.35], [1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  const y = interpolate(opacity, [0, 1], [34, 0]);
  const scan = interpolate(frame % 140, [0, 140], [-18, 492]);

  return (
    <div
      className="landscape-skill-sheet"
      style={{ opacity, transform: `translateY(${y}px)` }}
    >
      <div className="skill-sheet-topbar">
        <span />
        ClaudeProjects / 愿力视频
      </div>
      <div className="skill-sheet-note">这个项目参考的 5 个 Remotion skill</div>
      <div className="skill-sheet-table">
        <div className="skill-sheet-head">
          <span>#</span>
          <span>Skill</span>
          <span>作用</span>
        </div>
        {skillRows.map(([skill, role], index) => (
          <div className="skill-sheet-row" key={skill}>
            <span>{index + 1}</span>
            <b>{skill}</b>
            <em>{role}</em>
          </div>
        ))}
      </div>
      <div
        className="skill-sheet-scan"
        style={{ transform: `translateY(${scan}px)` }}
      />
      <div className="skill-sheet-badge">✓ REAL · 我的 REMOTION 层 5 项</div>
    </div>
  );
};

const RefHeader = ({ phase }: { phase: (typeof phases)[number] }) => {
  const second = useSeconds();
  const opacity = enter(second, phase.start, 0.38);

  return (
    <div className="ref-header" style={{ opacity }}>
      <div className="ref-kicker" style={{ color: phase.accent }}>
        <span style={{ background: phase.accent }} />
        {phase.kicker} · REMOTION SKILLS · ALL SELF-BUILT
      </div>
      <div className="ref-subtitle">{phase.title} · {phase.detail}</div>
    </div>
  );
};

const RefSkillBoard = () => {
  const second = useSeconds();
  const frame = useCurrentFrame();
  const opacity =
    enter(second, 0.8, 0.65) *
    interpolate(second, [10.8, 12], [1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  const y = interpolate(opacity, [0, 1], [26, 0]);
  const scan = interpolate(frame % 150, [0, 150], [-20, 570]);

  return (
    <div className="ref-skill-board" style={{ opacity, transform: `translateY(${y}px)` }}>
      <div className="ref-board-top">
        <span />
        ClaudeProjects / 愿力项目
      </div>
      <div className="ref-board-copy">我们这个项目参考的 9 个 remotion skill</div>
      <div className="ref-board-table">
        <div className="ref-board-head">
          <span>#</span>
          <span>Skill</span>
          <span>作用</span>
        </div>
        {referenceSkillRows.map(([skill, role], index) => (
          <div className="ref-board-row" key={skill}>
            <span>{index + 1}</span>
            <b>{skill}</b>
            <em>{role}</em>
          </div>
        ))}
      </div>
      <div className="ref-board-scan" style={{ transform: `translateY(${scan}px)` }} />
      <div className="ref-proof">✓ REAL · REMOTION SKILL 库 9 项</div>
    </div>
  );
};

const RefStoryPanel = ({ phase }: { phase: (typeof phases)[number] }) => {
  const second = useSeconds();
  const opacity = enter(second, 13, 0.52);

  return (
    <div className="ref-story-panel" style={{ opacity }}>
      <div className="ref-story-kicker">MONTHS OF ITERATION · 不是只靠蛮力</div>
      <div className="ref-story-row">
        <span>只用力</span>
        <b>→</b>
        <em>改变方向</em>
      </div>
      <div className="ref-story-copy" style={{ color: phase.accent }}>
        {phase.title} · {phase.detail}
      </div>
    </div>
  );
};

const windowOpacity = (second: number, start: number, end: number, fade = 0.5) =>
  enter(second, start, fade) *
  interpolate(second, [end - fade, end], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

const passiveAfter = (second: number, start: number, activeEnd: number, exit: number) => {
  const active = windowOpacity(second, start, activeEnd, 0.52);
  const passive =
    enter(second, activeEnd, 0.35) *
    interpolate(second, [exit - 0.6, exit], [0.42, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });

  return Math.max(active, passive);
};

const RefStoryPanelV9 = () => {
  const second = useSeconds();
  const effortWindow = attentionById.effort;
  const karmaWindow = attentionById.karma;
  const active = windowOpacity(second, effortWindow.start, effortWindow.end, 0.52);
  const opacity = passiveAfter(second, effortWindow.start, effortWindow.end, karmaWindow.end);
  const y = interpolate(active, [0, 1], [24, 0]);
  const effort = phases[1];

  return (
    <div
      className={`ref-story-panel ref-story-panel-v9 ${active > 0.02 ? "is-active" : "is-passive"}`}
      style={{ opacity, transform: `translateY(${y}px)` }}
    >
      <div className="ref-story-kicker">FOCUS 01 · EFFORT</div>
      <div className="ref-story-row">
        <span>只用力</span>
        <b>→</b>
        <em>改变方向</em>
      </div>
      <div className="ref-story-copy" style={{ color: effort.accent }}>
        {effort.title} · {effort.detail}
      </div>
    </div>
  );
};

const RefStatBlock = ({ phase }: { phase: (typeof phases)[number] }) => {
  const second = useSeconds();
  const detailOpacity = interpolate(second, [10.8, 13], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const pop = spring({
    frame: Math.max(0, (second - phase.start) * 30),
    fps: 30,
    config: { damping: 12, stiffness: 140, mass: 0.72 },
  });

  return (
    <div className="ref-stat-block">
      <div
        className="ref-stat-number"
        style={{
          color: phase.accent,
          textShadow: `0 0 36px ${phase.accent}88`,
          transform: `scale(${0.93 + pop * 0.07})`,
        }}
      >
        {phase.stat}
      </div>
      <div className="ref-stat-label">{phase.statLabel}</div>
      <div className="ref-stat-rule" style={{ background: phase.accent }} />
      <div className="ref-stat-copy" style={{ opacity: detailOpacity }}>
        {phase.detail}
      </div>
    </div>
  );
};

const RefStatBlockV9 = () => {
  const second = useSeconds();
  const karma = phases[2];
  const karmaWindow = attentionById.karma;
  const willWindow = attentionById.will;
  const active = windowOpacity(second, karmaWindow.start, karmaWindow.end, 0.52);
  const passive =
    enter(second, willWindow.start, 0.35) *
    interpolate(second, [56, 57], [0.34, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  const opacity = Math.max(active, passive);
  const pop = spring({
    frame: Math.max(0, (second - karmaWindow.start) * 30),
    fps: 30,
    config: { damping: 14, stiffness: 120, mass: 0.82 },
  });

  return (
    <div
      className={`ref-stat-block ref-stat-block-v9 ${active > 0.02 ? "is-active" : "is-passive"}`}
      style={{
        opacity,
        transform: `translateY(${interpolate(active, [0, 1], [22, 0])}px)`,
      }}
    >
      <div
        className="ref-stat-number"
        style={{
          color: karma.accent,
          textShadow: `0 0 36px ${karma.accent}88`,
          transform: `scale(${0.94 + pop * 0.06})`,
        }}
      >
        {karma.stat}
      </div>
      <div className="ref-stat-label">{karma.statLabel}</div>
      <div className="ref-stat-rule" style={{ background: karma.accent }} />
      <div className="ref-stat-copy">{karma.detail}</div>
    </div>
  );
};

const RefSideCards = ({ phase }: { phase: (typeof phases)[number] }) => {
  const second = useSeconds();
  const frame = useCurrentFrame();
  const opacity = enter(second, 13, 0.5);
  const bars = [
    { label: "EFFORT", value: phase.stat === "01" ? 0.82 : 0.38 },
    { label: "KARMA", value: phase.stat === "02" ? 0.86 : 0.46 },
    { label: "WILL", value: phase.stat === "03" ? 0.92 : 0.34 },
  ];

  return (
    <div className="ref-side-cards" style={{ opacity }}>
      <div className="ref-dark-card">
        <div className="ref-card-title">CURRENT INDEX</div>
        <div className="ref-bar-scene">
          {bars.map((bar, index) => (
            <div key={bar.label} className="ref-bar-wrap">
              <div
                className="ref-bar"
                style={{
                  height: `${bar.value * 135}px`,
                  background: phase.accent,
                  opacity: 0.45 + index * 0.16,
                }}
              />
              <span>{bar.label}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="ref-dark-card">
        <div className="ref-card-title">BOAT ANALOGY</div>
        <div className="ref-boat-scene">
          <div className="ref-current-lines" style={{ transform: `translateX(${frame % 80}px)` }} />
          <div className="ref-boat-body" />
          <div className="ref-wind-lines">≈≈≈</div>
        </div>
      </div>
    </div>
  );
};

const RefSideCardsV9 = () => {
  const second = useSeconds();
  const frame = useCurrentFrame();
  const will = phases[3];
  const willWindow = attentionById.will;
  const active = enter(second, willWindow.start, 0.56);
  const opacity = active;
  const y = interpolate(active, [0, 1], [26, 0]);
  const currentShift = active > 0.98 ? frame % 80 : 0;
  const bars = [
    { label: "EFFORT", value: 0.38, color: "#ffbd36" },
    { label: "KARMA", value: 0.52, color: "#ff4d4d" },
    { label: "WILL", value: 0.92, color: "#50e38a" },
  ];

  return (
    <div className="ref-side-cards ref-side-cards-v9" style={{ opacity, transform: `translateY(${y}px)` }}>
      <div className="ref-dark-card">
        <div className="ref-card-title">FOCUS 03 · WILL POWER</div>
        <div className="ref-bar-scene">
          {bars.map((bar) => (
            <div key={bar.label} className="ref-bar-wrap">
              <div
                className="ref-bar"
                style={{
                  height: `${bar.value * 135}px`,
                  background: bar.color,
                  opacity: bar.label === "WILL" ? 1 : 0.36,
                }}
              />
              <span>{bar.label}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="ref-dark-card">
        <div className="ref-card-title" style={{ color: will.accent }}>BOAT ANALOGY · 风改变水流</div>
        <div className="ref-boat-scene">
          <div className="ref-current-lines" style={{ transform: `translateX(${-currentShift}px)` }} />
          <div className="ref-boat-body" />
          <div className="ref-wind-lines">≈≈≈</div>
        </div>
      </div>
    </div>
  );
};

const RefCaption = ({ caption }: { caption: (typeof captions)[number] }) => {
  const second = useSeconds();
  const progress = clamp((second - caption.start) / Math.max(0.1, caption.end - caption.start));

  return (
    <div className="ref-caption">
      <div className="caption-progress" style={{ transform: `scaleX(${progress})` }} />
      <div className="ref-caption-zh">{caption.zh}</div>
      <div className="ref-caption-en">{caption.en}</div>
    </div>
  );
};

const RefLowerNav = ({ second }: { second: number }) => {
  const progress = clamp(second / videoDuration);

  return (
    <div className="ref-lower-nav">
      {chapters.map((chapter, index) => (
        <span key={chapter} className={index / chapters.length <= progress ? "active" : ""}>
          | {chapter}
        </span>
      ))}
    </div>
  );
};

const LandscapeConceptMap = ({ phase }: { phase: (typeof phases)[number] }) => {
  const second = useSeconds();
  const opacity =
    enter(second, 10.8, 0.6) *
    interpolate(second, [12.7, 13.25], [1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  const items = [
    {
      id: "努力",
      en: "EFFORT",
      text: "划船：持续动作",
      color: "#ffbd36",
      active: phase.stat === "01" || phase.stat === "3",
    },
    {
      id: "业力",
      en: "KARMA",
      text: "水流：习惯和命",
      color: "#ff4d4d",
      active: phase.stat === "02" || phase.stat === "3",
    },
    {
      id: "愿力",
      en: "WILL",
      text: "风：改变方向",
      color: "#50e38a",
      active: phase.stat === "03" || phase.stat === "3",
    },
  ];

  return (
    <div className="landscape-map" style={{ opacity }}>
      <div className="landscape-map-label">CONCEPT STACK · 三层力量</div>
      {items.map((item, index) => (
        <div
          key={item.id}
          className={`landscape-map-card ${item.active ? "active" : ""}`}
          style={{ borderColor: `${item.color}aa` }}
        >
          <div className="map-card-index" style={{ color: item.color }}>
            0{index + 1}
          </div>
          <div>
            <div className="map-card-title">{item.id}</div>
            <div className="map-card-en">{item.en}</div>
          </div>
          <div className="map-card-text">{item.text}</div>
        </div>
      ))}
    </div>
  );
};

const LandscapeStatColumn = ({ phase }: { phase: (typeof phases)[number] }) => {
  const second = useSeconds();
  const frame = useCurrentFrame();
  const pop = spring({
    frame: Math.max(0, (second - phase.start) * 30),
    fps: 30,
    config: { damping: 12, stiffness: 140, mass: 0.75 },
  });
  const waterShift = interpolate(frame % 100, [0, 100], [0, 60]);

  return (
    <div className="landscape-stat-column">
      <div
        className="landscape-big-stat"
        style={{
          color: phase.accent,
          textShadow: `0 0 34px ${phase.accent}88`,
          transform: `scale(${0.92 + pop * 0.08})`,
        }}
      >
        {phase.stat}
      </div>
      <div className="landscape-stat-label">{phase.statLabel}</div>
      <div className="landscape-stat-rule" style={{ background: phase.accent }} />
      <div className="landscape-stat-copy">{phase.detail}</div>
      <div className="landscape-mini-visual">
        <div className="mini-boat">
          <span />
        </div>
        <div
          className="mini-current"
          style={{ transform: `translateX(${phase.stat === "02" ? -waterShift : waterShift}px)` }}
        />
        <div
          className="mini-wind"
          style={{ opacity: phase.stat === "03" ? 1 : 0.24, color: "#50e38a" }}
        >
          ≈≈≈
        </div>
      </div>
    </div>
  );
};

const LandscapeTimeline = ({ second }: { second: number }) => {
  const progress = clamp(second / videoDuration);
  const opacity = enter(second, 13, 0.45);
  const y = interpolate(opacity, [0, 1], [24, 0]);

  return (
    <div className="landscape-timeline" style={{ opacity, transform: `translateY(${y}px)` }}>
      <div className="timeline-heading">MONTHS OF ITERATION · 不是只靠蛮力</div>
      <div className="timeline-row">
        <span className="bad">只用力</span>
        <span className="arrow">→</span>
        <span className="good">改变方向</span>
      </div>
      <div className="timeline-copy">
        当水流和你相反时，真正的变量不是更用力，而是找到能改变水流的风。
      </div>
      <div className="landscape-progress">
        <div style={{ transform: `scaleX(${progress})` }} />
      </div>
    </div>
  );
};

const LandscapeCaption = ({ caption }: { caption: (typeof captions)[number] }) => {
  const second = useSeconds();
  const progress = clamp((second - caption.start) / Math.max(0.1, caption.end - caption.start));

  return (
    <div className="landscape-caption">
      <div className="caption-progress" style={{ transform: `scaleX(${progress})` }} />
      <div className="landscape-caption-zh">{caption.zh}</div>
      <div className="landscape-caption-en">{caption.en}</div>
    </div>
  );
};

const LandscapeLowerNav = ({ second }: { second: number }) => {
  const progress = clamp(second / videoDuration);

  return (
    <div className="landscape-lower-nav">
      {chapters.map((chapter, index) => (
        <span key={chapter} className={index / chapters.length <= progress ? "active" : ""}>
          | {chapter}
        </span>
      ))}
    </div>
  );
};

const ColorGrade = () => (
  <AbsoluteFill>
    <div className="grade grade-vignette" />
    <div className="grade grade-warm" />
    <div className="grade grade-side" />
  </AbsoluteFill>
);

const TopTitle = ({ phase }: { phase: (typeof phases)[number] }) => {
  const second = useSeconds();
  const opacity = enter(second, phase.start, 0.35);
  const y = interpolate(opacity, [0, 1], [-18, 0]);

  return (
    <div className="top-title" style={{ opacity, transform: `translateY(${y}px)` }}>
      <div className="kicker" style={{ color: phase.accent }}>
        <span className="rail" style={{ background: phase.accent }} />
        {phase.kicker} · REMOTION OVERLAY
      </div>
      <div className="title-row">
        <span>{phase.title}</span>
        <small>把口播变成动态图层</small>
      </div>
    </div>
  );
};

const ForceStack = ({ phase }: { phase: (typeof phases)[number] }) => {
  const second = useSeconds();
  const pop = spring({
    frame: Math.max(0, (second - phase.start) * 30),
    fps: 30,
    config: { damping: 13, stiffness: 130, mass: 0.8 },
  });
  const opacity = enter(second, phase.start + 0.15, 0.4);

  return (
    <div className="force-stack" style={{ opacity, transform: `scale(${0.92 + pop * 0.08})` }}>
      <div className="stat" style={{ color: phase.accent, textShadow: `0 0 28px ${phase.accent}66` }}>
        {phase.stat}
      </div>
      <div className="stat-label">{phase.statLabel}</div>
      <div className="mini-rule" style={{ background: phase.accent }} />
      <div className="stat-detail">{phase.detail}</div>
    </div>
  );
};

const MetaphorDiagram = ({ phase }: { phase: (typeof phases)[number] }) => {
  const second = useSeconds();
  const frame = useCurrentFrame();
  const opacity = enter(second, 10, 0.75);
  const currentShift = interpolate(frame % 90, [0, 90], [0, 44]);
  const windShift = interpolate(frame % 72, [0, 72], [-28, 28]);
  const isWill = phase.stat === "03";
  const isKarma = phase.stat === "02";

  return (
    <div className="diagram" style={{ opacity }}>
      <div className="diagram-label" style={{ color: phase.accent }}>
        BOAT ANALOGY
      </div>
      <div className="water">
        {[0, 1, 2].map((line) => (
          <div
            key={line}
            className="water-line"
            style={{
              transform: `translateX(${(isKarma ? -currentShift : currentShift) - line * 18}px)`,
              opacity: isKarma ? 0.95 : 0.55,
            }}
          />
        ))}
      </div>
      <div className="boat" style={{ transform: `translateX(${isWill ? 16 : 0}px)` }}>
        <div className="boat-body" />
        <div className="paddle paddle-left" />
        <div className="paddle paddle-right" />
      </div>
      <div
        className="wind"
        style={{
          opacity: isWill ? 1 : 0.18,
          transform: `translateX(${windShift}px)`,
        }}
      >
        <span>≈</span>
        <span>≈</span>
        <span>≈</span>
      </div>
      <div className="diagram-copy">
        <b style={{ color: phase.accent }}>
          {isWill ? "愿力改变方向" : isKarma ? "水流决定阻力" : "努力只是动作"}
        </b>
        <span>
          {isWill
            ? "wind redirects the current"
            : isKarma
              ? "current shapes the outcome"
              : "rowing is not enough"}
        </span>
      </div>
    </div>
  );
};

const InsightPanel = ({ phase }: { phase: (typeof phases)[number] }) => {
  const second = useSeconds();
  const opacity = enter(second, phase.start + 1.1, 0.45);
  const y = interpolate(opacity, [0, 1], [20, 0]);

  return (
    <div
      className="insight-panel"
      style={{ borderColor: `${phase.accent}88`, opacity, transform: `translateY(${y}px)` }}
    >
      <div className="panel-chip" style={{ background: phase.accent }}>
        KEY
      </div>
      <div className="panel-title">{phase.title}</div>
      <div className="panel-body">{phase.detail}</div>
    </div>
  );
};

const CaptionLayer = ({ caption }: { caption: (typeof captions)[number] }) => {
  const second = useSeconds();
  const progress = clamp((second - caption.start) / Math.max(0.1, caption.end - caption.start));

  return (
    <div className="caption-wrap">
      <div className="caption-progress" style={{ transform: `scaleX(${progress})` }} />
      <div className="caption-zh">{caption.zh}</div>
      <div className="caption-en">{caption.en}</div>
    </div>
  );
};

const ChapterBar = ({ second }: { second: number }) => {
  const progress = clamp(second / videoDuration);

  return (
    <div className="chapter-bar">
      <div className="chapter-track">
        <div className="chapter-fill" style={{ transform: `scaleX(${progress})` }} />
      </div>
      <div className="chapter-labels">
        {chapters.map((chapter, index) => (
          <span key={chapter} className={index / chapters.length <= progress ? "active" : ""}>
            | {chapter}
          </span>
        ))}
      </div>
    </div>
  );
};

const ProofBadge = () => {
  const second = useSeconds();
  const opacity =
    enter(second, 0.8, 0.5) *
    interpolate(second, [9.5, 11.5], [1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });

  return (
    <div className="proof-badge" style={{ opacity }}>
      ✓ REAL · HOST VIDEO + REMOTION LAYERS
    </div>
  );
};
