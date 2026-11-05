import type { Exercise } from '../domain/ExerciseLibrary';
import type { KinematicSample } from '../domain/types';
import { repMetrics, type DetectedRepetition, type RepetitionStrategy } from './RepMetrics';

/** Seated → rise → confirmed standing → controlled return to seated.
 * Knee flexion estimates the positions; this does not detect contact with a chair.
 */
export class SitToStandDetector implements RepetitionStrategy {
  phase: RepetitionStrategy['phase'] = 'seeking';
  private seatedSince: number | null = null;
  private standingSince: number | null = null;
  private returnSince: number | null = null;
  private baseline: KinematicSample | null = null;
  private seatedAngle = 0;
  private lastTime: number | null = null;
  private samples: KinematicSample[] = [];
  private standing: KinematicSample | null = null;
  private standingConfirmed = false;
  constructor(private config: Exercise['detector'], private maxGapMs: number) {}
  reset() {
    this.phase = 'seeking'; this.seatedSince = null; this.standingSince = null;
    this.returnSince = null; this.baseline = null; this.lastTime = null;
    this.samples = []; this.standing = null; this.standingConfirmed = false; this.seatedAngle = 0;
  }
  update(s: KinematicSample): DetectedRepetition | null {
    if (this.lastTime !== null && (s.timestamp <= this.lastTime || s.timestamp - this.lastTime > this.maxGapMs)) this.reset();
    this.lastTime = s.timestamp;
    const c = this.config, seatedMin = c.seatedMin!;
    if (this.phase === 'seeking') {
      if (s.kneeFlexion >= seatedMin) {
        this.seatedSince ??= s.timestamp; this.baseline = s; this.seatedAngle = s.kneeFlexion;
        if (s.timestamp - this.seatedSince >= c.minPhaseMs) this.phase = 'ready';
      } else this.seatedSince = null;
      return null;
    }
    if (this.phase === 'ready') {
      if (this.baseline && this.seatedAngle - s.kneeFlexion >= c.reversal) {
        this.samples = [this.baseline, s]; this.phase = 'concentric';
      } else { this.baseline = s; this.seatedAngle = Math.max(this.seatedAngle, s.kneeFlexion); }
      return null;
    }
    this.samples.push(s);
    if (s.timestamp - this.samples[0].timestamp > c.maxRepMs) { this.reset(); return null; }
    if (this.phase === 'concentric') {
      // A failed rise that returns to the seat must not merge into the next attempt.
      if (!this.standingConfirmed && s.kneeFlexion >= this.seatedAngle - c.reversal &&
          Math.min(...this.samples.map(f => f.kneeFlexion)) < this.seatedAngle - 2 * c.reversal) {
        this.reset(); return null;
      }
      if (s.kneeFlexion <= c.extension) {
        this.standingSince ??= s.timestamp;
        if (!this.standing || s.kneeFlexion < this.standing.kneeFlexion) this.standing = s;
        if (s.timestamp - this.standingSince >= c.minPhaseMs) this.standingConfirmed = true;
      } else if (!this.standingConfirmed) { this.standingSince = null; this.standing = null; }
      if (this.standingConfirmed && s.kneeFlexion >= c.start) this.phase = 'eccentric';
      else return null;
    }
    if (s.kneeFlexion >= Math.max(seatedMin, this.seatedAngle - c.reversal)) this.returnSince ??= s.timestamp;
    else this.returnSince = null;
    if (this.returnSince === null || s.timestamp - this.returnSince < c.minPhaseMs) return null;
    const frames = this.samples, standing = this.standing!, start = frames[0].timestamp;
    const metrics = repMetrics(frames, frames.filter(f => f.timestamp <= standing.timestamp));
    const valid = metrics.kneeROM! >= c.minROM && metrics.duration! * 1000 >= c.minRepMs &&
      standing.timestamp - start >= c.minPhaseMs && s.timestamp - standing.timestamp >= c.minPhaseMs;
    const result: DetectedRepetition | null = valid ? {
      start, end: s.timestamp,
      turn: standing.timestamp, turnPosition: 'standing',
      eccentricDuration: (s.timestamp - standing.timestamp) / 1000,
      concentricDuration: (standing.timestamp - start) / 1000,
      metrics, quality: Math.min(...frames.map(f => f.quality)),
    } : null;
    this.reset();
    return result;
  }
}
