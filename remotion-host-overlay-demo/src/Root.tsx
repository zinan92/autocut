import "./index.css";
import { Composition } from "remotion";
import {
  HostOverlayLandscape,
  HostOverlayReferenceV5,
  HostOverlayReferenceV6,
  HostOverlayReferenceV7,
  HostOverlayReferenceV8,
  HostOverlayReferenceV9,
  HostOverlayVideo,
  videoDuration,
} from "./Composition";

const fps = 30;
const durationInFrames = Math.ceil(videoDuration * fps);

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="HostOverlayVideo"
        component={HostOverlayVideo}
        durationInFrames={durationInFrames}
        fps={fps}
        width={720}
        height={1280}
      />
      <Composition
        id="HostOverlayLandscape"
        component={HostOverlayLandscape}
        durationInFrames={durationInFrames}
        fps={fps}
        width={1920}
        height={1080}
      />
      <Composition
        id="HostOverlayReferenceV5"
        component={HostOverlayReferenceV5}
        durationInFrames={durationInFrames}
        fps={fps}
        width={1920}
        height={1080}
      />
      <Composition
        id="HostOverlayReferenceV6"
        component={HostOverlayReferenceV6}
        durationInFrames={durationInFrames}
        fps={fps}
        width={1920}
        height={1080}
      />
      <Composition
        id="HostOverlayReferenceV7"
        component={HostOverlayReferenceV7}
        durationInFrames={durationInFrames}
        fps={fps}
        width={1920}
        height={1080}
      />
      <Composition
        id="HostOverlayReferenceV8"
        component={HostOverlayReferenceV8}
        durationInFrames={durationInFrames}
        fps={fps}
        width={1920}
        height={1080}
      />
      <Composition
        id="HostOverlayReferenceV9"
        component={HostOverlayReferenceV9}
        durationInFrames={durationInFrames}
        fps={fps}
        width={1920}
        height={1080}
      />
    </>
  );
};
