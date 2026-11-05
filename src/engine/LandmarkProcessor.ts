import type { Landmark, PoseFrame, ProcessedLandmarks, Side } from '../domain/types';
export const sideIndices = { left: [11, 23, 25, 27], right: [12, 24, 26, 28] } as const;
export function confidence(p?: Landmark): number {
  if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.visibility) || !Number.isFinite(p.presence ?? 1) || p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1) return 0;
  return Math.max(0, Math.min(1, p.visibility, p.presence ?? 1));
}
export class LandmarkProcessor {
  side: Side | null = null;
  reset() { this.side = null; }
  process(frame: PoseFrame, threshold: number): ProcessedLandmarks | null {
    const score = (side: Side) => Math.min(...sideIndices[side].slice(1).map(i => confidence(frame.landmarks[i])));
    // Lock the best visible hip/knee/ankle for the entire set. Never swap during occlusion.
    const candidate = this.side ?? (score('left') >= score('right') ? 'left' : 'right');
    const [shoulder, hip, knee, ankle] = sideIndices[candidate].map(i => frame.landmarks[i]);
    const quality = Math.min(score(candidate), confidence(shoulder));
    if (quality < threshold || frame.width <= 0 || frame.height <= 0) return null;
    this.side = candidate;
    return { shoulder, hip, knee, ankle, quality, side: candidate, width: frame.width, height: frame.height };
  }
}
