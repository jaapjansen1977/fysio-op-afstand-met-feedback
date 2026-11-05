import type { ExercisePrescription } from './ExercisePrescription';
import type { MetricKey } from './ExerciseLibrary';
export interface Landmark { x: number; y: number; z?: number; visibility: number; presence?: number }
export interface PoseFrame { timestamp: number; landmarks: Landmark[]; width: number; height: number }
export type Side = 'left' | 'right';
export interface ProcessedLandmarks { shoulder: Landmark; hip: Landmark; knee: Landmark; ankle: Landmark; quality: number; side: Side; width: number; height: number }
export interface KinematicSample { timestamp: number; kneeFlexion: number; hipFlexion: number; trunkInclination: number; kneeVelocity: number; quality: number; side: Side }
export interface Feedback { metric: MetricKey; value: number; outcome: 'below' | 'within' | 'above'; tone: 'positive' | 'neutral' | 'corrective'; text: string }
export interface Repetition { index: number; set: number; start: number; bottom: number; end: number; eccentricDuration: number; concentricDuration: number; metrics: Record<MetricKey, number | null>; quality: number; feedback: Feedback[] }
export interface Session { id: string; createdAt: string; source: 'camera' | 'demo'; prescription: ExercisePrescription; repetitions: Repetition[]; samples: KinematicSample[]; tracking: { validFrames: number; attemptedFrames: number; activeMs: number; effectiveHz: number }; status: 'completed' | 'stopped' | 'interrupted' }
