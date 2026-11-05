import type { KinematicSample, Landmark, ProcessedLandmarks } from '../domain/types';
import type { ExercisePrescription } from '../domain/ExercisePrescription';
type Point = Pick<Landmark, 'x' | 'y'>;
export function includedAngle(a: Point, vertex: Point, b: Point): number | null {
  const ax = a.x - vertex.x, ay = a.y - vertex.y, bx = b.x - vertex.x, by = b.y - vertex.y;
  const length = Math.hypot(ax, ay) * Math.hypot(bx, by);
  if (!Number.isFinite(length) || length < 1e-8) return null;
  return Math.acos(Math.max(-1, Math.min(1, (ax * bx + ay * by) / length))) * 180 / Math.PI;
}
export function flexion(a: Point, vertex: Point, b: Point): number | null {
  const angle = includedAngle(a, vertex, b);
  return angle === null ? null : 180 - angle;
}
// Screen y points down. Facing determines the signed anterior direction.
export function trunkInclination(hip: Point, shoulder: Point, facing: 'left' | 'right'): number | null {
  const dx = shoulder.x - hip.x, dy = hip.y - shoulder.y;
  if (Math.hypot(dx, dy) < 1e-8) return null;
  return Math.atan2((facing === 'right' ? 1 : -1) * dx, dy) * 180 / Math.PI;
}
export function smooth(previous: number, next: number, dt: number, tau: number) {
  return previous + (tau <= 0 ? 1 : 1 - Math.exp(-dt / tau)) * (next - previous);
}
export function angularVelocity(previous: number, current: number, dtMs: number): number {
  return dtMs > 0 ? (current - previous) * 1000 / dtMs : 0;
}
export class KinematicsEngine {
  private last: KinematicSample | null = null;
  constructor(private filter: ExercisePrescription['filter'], private facing: 'left' | 'right') {}
  reset() { this.last = null; }
  process(p: ProcessedLandmarks, timestamp: number): KinematicSample | null {
    const pixel = (v: Landmark) => ({ x: v.x * p.width, y: v.y * p.height });
    const shoulder = pixel(p.shoulder), hip = pixel(p.hip), knee = pixel(p.knee), ankle = pixel(p.ankle);
    const kneeFlexion = flexion(hip, knee, ankle), hipFlexion = flexion(shoulder, hip, knee), trunk = trunkInclination(hip, shoulder, this.facing);
    if (kneeFlexion === null || hipFlexion === null || trunk === null || !Number.isFinite(timestamp)) return null;
    const prev = this.last;
    if (prev && timestamp <= prev.timestamp) return null;
    const dt = prev ? timestamp - prev.timestamp : 0;
    const continuous = prev && dt <= this.filter.maxGapMs;
    const sample: KinematicSample = { timestamp, kneeFlexion, hipFlexion, trunkInclination: trunk, kneeVelocity: 0, quality: p.quality, side: p.side };
    if (continuous) {
      sample.kneeFlexion = smooth(prev.kneeFlexion, kneeFlexion, dt, this.filter.angleTauMs);
      sample.hipFlexion = smooth(prev.hipFlexion, hipFlexion, dt, this.filter.angleTauMs);
      sample.trunkInclination = smooth(prev.trunkInclination, trunk, dt, this.filter.angleTauMs);
      sample.kneeVelocity = smooth(prev.kneeVelocity, angularVelocity(prev.kneeFlexion, sample.kneeFlexion, dt), dt, this.filter.velocityTauMs);
    }
    this.last = sample;
    return sample;
  }
}
