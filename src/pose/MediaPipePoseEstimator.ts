import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';
import type { PoseEstimator } from './PoseEstimator';
import type { PoseFrame } from '../domain/types';
export class MediaPipePoseEstimator implements PoseEstimator {
  private model?: PoseLandmarker;
  async initialize() {
    const response = await fetch('/models/pose_landmarker_lite.task', { method: 'HEAD' });
    if (!response.ok || response.headers.get('content-type')?.includes('text/html')) throw new Error('Pose-model ontbreekt. Voer npm run assets uit en probeer opnieuw.');
    const files = await FilesetResolver.forVisionTasks('/wasm');
    this.model = await PoseLandmarker.createFromOptions(files, {
      baseOptions: { modelAssetPath: '/models/pose_landmarker_lite.task', delegate: 'CPU' },
      runningMode: 'VIDEO', numPoses: 1, minPoseDetectionConfidence: 0.5, minPosePresenceConfidence: 0.5, minTrackingConfidence: 0.5,
    });
  }
  estimate(video: HTMLVideoElement, timestamp: number): PoseFrame | null {
    if (!this.model) return null;
    const result = this.model.detectForVideo(video, timestamp);
    return { timestamp, landmarks: result.landmarks[0] ?? [], width: video.videoWidth, height: video.videoHeight };
  }
  dispose() { this.model?.close(); this.model = undefined; }
}
