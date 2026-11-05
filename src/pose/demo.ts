import type { PoseFrame, Landmark } from '../domain/types';
// Synthetic articulated 2D skeleton. Runs through the exact same landmark/analysis pipeline.
export function demoFrame(timestamp: number, elapsed: number, kind: 'squat' | 'sitToStand' = 'squat', facing: 'left' | 'right' = 'right'): PoseFrame {
  const t = elapsed / 1000;
  const cycle = 82 * (1 - Math.cos(2 * Math.PI * (Math.max(0, t - 1.2) % 6) / 6)) / 2;
  const angle = kind === 'sitToStand' ? 82 - cycle : cycle;
  const r = Math.PI / 180;
  const ankle = { x: 310, y: 408 };
  const knee = { x: ankle.x + 110 * Math.sin(angle * 0.3 * r), y: ankle.y - 110 * Math.cos(angle * 0.3 * r) };
  const hip = { x: knee.x - 110 * Math.sin(angle * 0.7 * r), y: knee.y - 110 * Math.cos(angle * 0.7 * r) };
  const shoulder = { x: hip.x + 140 * Math.sin(angle * 0.35 * r), y: hip.y - 140 * Math.cos(angle * 0.35 * r) };
  const landmarks: Landmark[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0, presence: 0 }));
  for (const [indices, shift, quality] of [[[11, 23, 25, 27], -10, 0.86], [[12, 24, 26, 28], 0, 0.98]] as const) {
    [shoulder, hip, knee, ankle].forEach((p, i) => { landmarks[indices[i]] = { x: facing === 'right' ? (p.x + shift) / 640 : 1 - (p.x + shift) / 640, y: p.y / 480, visibility: quality, presence: quality }; });
  }
  return { timestamp, landmarks, width: 640, height: 480 };
}
