import type { PoseFrame } from '../domain/types';
export interface PoseEstimator {
  initialize(): Promise<void>;
  estimate(video: HTMLVideoElement, timestamp: number): PoseFrame | null;
  dispose(): void;
}
