import type { DesktopLyricStyleId } from "../../../src/types/desktopLyric";
import { LyricCanvasRenderer } from "../LyricCanvasRenderer";
import { BounceLyricRenderer } from "./bounceStyle";
import { InkFlowLyricRenderer } from "./inkFlowStyle";
import { NeonFlowLyricRenderer } from "./neonFlowStyle";
import { OceanLyricRenderer } from "./oceanStyle";
import { ParticleLyricRenderer } from "./particleStyle";
import { SpotlightLyricRenderer } from "./spotlightStyle";
import { TypewriterLyricRenderer } from "./typewriterStyle";
import type { IDesktopLyricRenderer } from "./types";

export type { IDesktopLyricRenderer } from "./types";

export function createDesktopLyricRenderer(
  styleId: DesktopLyricStyleId | undefined,
  canvas: HTMLCanvasElement,
  liveRegion: HTMLElement,
): IDesktopLyricRenderer {
  switch (styleId) {
    case "typewriter":
      return new TypewriterLyricRenderer(canvas, liveRegion);
    case "ink":
      return new InkFlowLyricRenderer(canvas, liveRegion);
    case "bounce":
      return new BounceLyricRenderer(canvas, liveRegion);
    case "spotlight":
      return new SpotlightLyricRenderer(canvas, liveRegion);
    case "neon":
      return new NeonFlowLyricRenderer(canvas, liveRegion);
    case "ocean":
      return new OceanLyricRenderer(canvas, liveRegion);
    case "particle":
      return new ParticleLyricRenderer(canvas, liveRegion);
    case "default":
    default:
      return new LyricCanvasRenderer(canvas, liveRegion);
  }
}
