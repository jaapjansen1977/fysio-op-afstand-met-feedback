import { ExerciseLibrary } from '../domain/ExerciseLibrary';
import type { ExercisePrescription } from '../domain/ExercisePrescription';
import type { Feedback, KinematicSample, PoseFrame, Session } from '../domain/types';
import { LandmarkProcessor } from '../engine/LandmarkProcessor';
import { KinematicsEngine } from '../engine/KinematicsEngine';
import { RepetitionDetector } from '../engine/RepetitionDetector';
import { FeedbackEngine } from '../engine/FeedbackEngine';
import { SessionRecorder } from './SessionRecorder';
export class ExerciseSession {
  readonly landmarks = new LandmarkProcessor();
  readonly kinematics: KinematicsEngine;
  readonly detector: RepetitionDetector;
  readonly feedback = new FeedbackEngine();
  readonly recorder: SessionRecorder;
  set = 1;
  rest = false;
  complete = false;
  private previousTime: number | null = null;
  constructor(readonly prescription: ExercisePrescription, source: Session['source']) {
    const exercise = ExerciseLibrary.exercises.find(e => e.id === prescription.exerciseId)!;
    this.kinematics = new KinematicsEngine(prescription.filter, prescription.facing);
    this.detector = new RepetitionDetector(exercise.detector, prescription.filter.maxGapMs);
    this.recorder = new SessionRecorder(prescription, source);
  }
  interrupt() { this.kinematics.reset(); this.detector.reset(); this.previousTime = null; }
  nextSet() { this.set++; this.rest = false; this.landmarks.reset(); this.interrupt(); }
  process(frame: PoseFrame): { sample: KinematicSample | null; feedback: Feedback[]; repAdded: boolean } {
    if (this.rest || this.complete) return { sample: null, feedback: [], repAdded: false };
    const elapsed = this.previousTime === null ? 0 : frame.timestamp - this.previousTime;
    this.previousTime = frame.timestamp;
    const points = this.landmarks.process(frame, this.prescription.filter.minConfidence);
    const sample = points ? this.kinematics.process(points, frame.timestamp) : null;
    this.recorder.attempt(!!sample, elapsed);
    if (!sample) {
      this.kinematics.reset(); this.detector.reset();
      return { sample: null, feedback: [], repAdded: false };
    }
    this.recorder.addSample(sample);
    const rep = this.detector.update(sample);
    let messages: Feedback[] = [];
    if (this.prescription.timing === 'live' && this.detector.phase !== 'seeking' && this.detector.phase !== 'ready') {
      // Live feedback is provisional; speed is only evaluated while extending, duration only on completion.
      const metrics = { maxKneeFlexion: sample.kneeFlexion, kneeROM: null, maxHipFlexion: sample.hipFlexion, maxTrunkInclination: sample.trunkInclination, maxExtensionVelocity: sample.kneeVelocity < 0 ? -sample.kneeVelocity : null, duration: null };
      messages = this.feedback.evaluate(metrics, this.prescription, sample.quality);
    }
    if (rep) {
      for (const p of this.prescription.parameters) if (!p.measure) rep.metrics[p.metric] = null;
      const r = { ...rep, index: this.recorder.session.repetitions.filter(r => r.set === this.set).length + 1, set: this.set, feedback: this.feedback.evaluate(rep.metrics, this.prescription, rep.quality) };
      this.recorder.addRep(r);
      if (this.prescription.timing === 'rep') messages = r.feedback;
      if (r.index >= this.prescription.reps) {
        if (this.prescription.timing === 'set') messages = this.feedback.forSet(this.recorder.session.repetitions.filter(r => r.set === this.set), this.prescription);
        if (this.set >= this.prescription.sets) this.complete = true; else this.rest = true;
      }
    }
    return { sample, feedback: messages, repAdded: !!rep };
  }
}
