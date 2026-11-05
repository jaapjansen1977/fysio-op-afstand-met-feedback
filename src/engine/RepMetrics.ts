import type { KinematicSample, Repetition } from '../domain/types';
export type DetectedRepetition = Omit<Repetition, 'index' | 'set' | 'feedback'>;
export interface RepetitionStrategy {
  phase: 'seeking' | 'ready' | 'eccentric' | 'concentric';
  reset(): void;
  update(sample: KinematicSample): DetectedRepetition | null;
}
export function repMetrics(frames: KinematicSample[], concentric: KinematicSample[]): Repetition['metrics'] {
  const knees = frames.map(s => s.kneeFlexion);
  return {
    maxKneeFlexion: Math.max(...knees), kneeROM: Math.max(...knees) - Math.min(...knees),
    maxHipFlexion: Math.max(...frames.map(s => s.hipFlexion)),
    maxTrunkInclination: Math.max(...frames.map(s => s.trunkInclination)),
    maxExtensionVelocity: Math.max(0, ...concentric.map(s => -s.kneeVelocity)),
    duration: (frames.at(-1)!.timestamp - frames[0].timestamp) / 1000,
  };
}
