import type { Exercise } from '../domain/ExerciseLibrary';
import type { KinematicSample, Repetition } from '../domain/types';
export class RepetitionDetector {
  phase: 'seeking' | 'ready' | 'eccentric' | 'concentric' = 'seeking';
  private baseline: KinematicSample | null = null;
  private standingSince: number | null = null;
  private samples: KinematicSample[] = [];
  private peak: KinematicSample | null = null;
  private lastTime: number | null = null;
  constructor(private config: Exercise['detector'], private maxGapMs: number) {}
  reset() { this.phase = 'seeking'; this.baseline = null; this.standingSince = null; this.samples = []; this.peak = null; this.lastTime = null; }
  update(s: KinematicSample): Omit<Repetition, 'index' | 'set' | 'feedback'> | null {
    if (this.lastTime !== null && (s.timestamp <= this.lastTime || s.timestamp - this.lastTime > this.maxGapMs)) this.reset();
    this.lastTime = s.timestamp;
    const c = this.config;
    if (this.phase === 'seeking') {
      if (s.kneeFlexion <= c.extension) {
        this.standingSince ??= s.timestamp;
        this.baseline = s;
        if (s.timestamp - this.standingSince >= c.minPhaseMs) this.phase = 'ready';
      } else this.standingSince = null;
      return null;
    }
    if (this.phase === 'ready') {
      if (s.kneeFlexion <= c.extension) this.baseline = s;
      if (s.kneeFlexion >= c.start && this.baseline) {
        this.samples = [this.baseline, s]; this.peak = s; this.phase = 'eccentric';
      }
      return null;
    }
    this.samples.push(s);
    if (s.timestamp - this.samples[0].timestamp > c.maxRepMs) { this.reset(); return null; }
    if (!this.peak || s.kneeFlexion > this.peak.kneeFlexion) this.peak = s;
    if (this.phase === 'eccentric' && this.peak.kneeFlexion - s.kneeFlexion >= c.reversal && this.peak.timestamp - this.samples[0].timestamp >= c.minPhaseMs) this.phase = 'concentric';
    if (s.kneeFlexion > c.extension) return null;
    const frames = this.samples, peak = this.peak, start = frames[0].timestamp;
    const rom = peak.kneeFlexion - Math.min(...frames.map(x => x.kneeFlexion));
    const valid = this.phase === 'concentric' && rom >= c.minROM && s.timestamp - start >= c.minRepMs && s.timestamp - peak.timestamp >= c.minPhaseMs;
    const result = valid ? {
      start, bottom: peak.timestamp, end: s.timestamp,
      eccentricDuration: (peak.timestamp - start) / 1000, concentricDuration: (s.timestamp - peak.timestamp) / 1000,
      metrics: {
        maxKneeFlexion: peak.kneeFlexion, kneeROM: rom,
        maxHipFlexion: Math.max(...frames.map(x => x.hipFlexion)),
        maxTrunkInclination: Math.max(...frames.map(x => x.trunkInclination)),
        maxExtensionVelocity: Math.max(0, ...frames.filter(x => x.timestamp >= peak.timestamp).map(x => -x.kneeVelocity)),
        duration: (s.timestamp - start) / 1000,
      },
      quality: Math.min(...frames.map(x => x.quality)),
    } : null;
    this.reset();
    return result;
  }
}
