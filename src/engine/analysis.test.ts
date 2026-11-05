import { describe, it, expect } from 'vitest';
import { angularVelocity, flexion, trunkInclination, KinematicsEngine, smooth } from './KinematicsEngine';
import { LandmarkProcessor } from './LandmarkProcessor';
import { RepetitionDetector } from './RepetitionDetector';
import { FeedbackEngine } from './FeedbackEngine';
import { ExerciseLibrary, exerciseSchema } from '../domain/ExerciseLibrary';
import { defaultPrescription, prescriptionSchema } from '../domain/ExercisePrescription';
import { demoFrame } from '../pose/demo';
import { ExerciseSession } from '../session/ExerciseSession';
import { exportCSV } from '../session/SessionRecorder';
import type { KinematicSample, PoseFrame, Repetition } from '../domain/types';
const config = ExerciseLibrary.exercises[0].detector;
const s = (timestamp: number, kneeFlexion: number): KinematicSample => ({ timestamp, kneeFlexion, hipFlexion: kneeFlexion * 0.8, trunkInclination: kneeFlexion * 0.3, kneeVelocity: 0, quality: 0.95, side: 'right' });
function cycle(detector: RepetitionDetector, offset = 0, amplitude = 80, interval = 50) {
  const reps = [];
  let prev = 0;
  for (let t = 0; t <= 5000; t += interval) {
    const a = t < 500 || t > 4500 ? 0 : amplitude * (1 - Math.cos(2 * Math.PI * (t - 500) / 4000)) / 2;
    const sample = s(offset + t, a); sample.kneeVelocity = angularVelocity(prev, a, interval); prev = a;
    const rep = detector.update(sample); if (rep) reps.push(rep);
  }
  return reps;
}
describe('Biomechanical conventions', () => {
  it('knee extension = 0 degrees', () => expect(flexion({x:0,y:0},{x:0,y:1},{x:0,y:2})).toBeCloseTo(0));
  it('knee flexion = 90 degrees for a right angle', () => expect(flexion({x:0,y:0},{x:0,y:1},{x:1,y:1})).toBeCloseTo(90));
  it('hip: shoulder/hip/knee standing = 0, seated = 90', () => {
    expect(flexion({x:0,y:0},{x:0,y:1},{x:0,y:2})).toBeCloseTo(0);
    expect(flexion({x:0,y:0},{x:0,y:1},{x:1,y:1})).toBeCloseTo(90);
  });
  it('vertical trunk = 0 degrees', () => expect(trunkInclination({x:0,y:1},{x:0,y:0},'right')).toBe(0));
  it('forward trunk is positive for both facing directions', () => {
    expect(trunkInclination({x:0,y:1},{x:1,y:0},'right')).toBeCloseTo(45);
    expect(trunkInclination({x:0,y:1},{x:-1,y:0},'left')).toBeCloseTo(45);
    expect(trunkInclination({x:0,y:1},{x:-1,y:0},'right')).toBeCloseTo(-45);
  });
  it('rejects coincident landmarks', () => expect(flexion({x:0,y:0},{x:0,y:0},{x:1,y:1})).toBeNull());
  it('uses timestamps in milliseconds for degrees per second', () => {
    expect(angularVelocity(10,30,200)).toBe(100);
    expect(angularVelocity(30,10,100)).toBe(-200);
    expect(angularVelocity(10,30,0)).toBe(0);
  });
  it('time-based lowpass has the same response at different frame rates', () => {
    const oneStep = smooth(0, 100, 100, 100);
    const halfStep = smooth(smooth(0,100,50,100),100,50,100);
    expect(oneStep).toBeCloseTo(halfStep);
  });
});
describe('Landmarks and filtering', () => {
  it('chooses and locks the best visible leg', () => {
    const p = new LandmarkProcessor(), frame = demoFrame(0,0);
    expect(p.process(frame,.65)?.side).toBe('right');
    frame.landmarks[26].visibility = .2;
    expect(p.process(frame,.65)).toBeNull();
    expect(p.side).toBe('right');
    p.reset(); expect(p.process(frame,.65)?.side).toBe('left');
  });
  it('handles missing landmarks without an exception', () => {
    const p = new LandmarkProcessor();
    expect(p.process({timestamp:0,landmarks:[],width:640,height:480},.65)).toBeNull();
  });
  it('rejects offscreen and low presence landmarks', () => {
    const f = demoFrame(0,0);
    f.landmarks[25].x = -0.1; f.landmarks[26].presence = .1;
    expect(new LandmarkProcessor().process(f,.65)).toBeNull();
  });
  it('rejects nonfinite landmark confidence', () => {
    const f = demoFrame(0,0); f.landmarks[25].visibility = NaN; f.landmarks[26].presence = Infinity;
    expect(new LandmarkProcessor().process(f,.65)).toBeNull();
  });
  it('uses pixel aspect ratio and resets velocity after a gap', () => {
    const engine = new KinematicsEngine(defaultPrescription.filter,'right');
    const p = new LandmarkProcessor().process(demoFrame(0,0),.65)!;
    expect(engine.process(p,0)?.kneeFlexion).toBeCloseTo(0);
    expect(engine.process(p,0)).toBeNull();
    const next = new LandmarkProcessor().process(demoFrame(1000,4200),.65)!;
    const afterGap = engine.process(next,1000)!;
    expect(afterGap.kneeFlexion).toBeCloseTo(82);
    expect(afterGap.kneeVelocity).toBe(0);
  });
});
describe('Squat state machine', () => {
  it('detects a full cycle with extrema, phases and extension velocity', () => {
    const reps = cycle(new RepetitionDetector(config,350));
    expect(reps).toHaveLength(1);
    const rep = reps[0];
    expect(rep.metrics.maxKneeFlexion).toBeCloseTo(80);
    expect(rep.metrics.kneeROM!).toBeGreaterThan(65);
    expect(rep.metrics.maxExtensionVelocity!).toBeGreaterThan(50);
    expect(rep.eccentricDuration).toBeGreaterThan(.25);
    expect(rep.concentricDuration).toBeGreaterThan(.25);
    expect(rep.start).toBeLessThan(rep.bottom); expect(rep.bottom).toBeLessThan(rep.end);
  });
  it('detects consecutive reps without double counting', () => {
    const detector = new RepetitionDetector(config,350);
    expect([...cycle(detector),...cycle(detector,5050)]).toHaveLength(2);
  });
  it('rejects shallow movement and noise around extension', () => {
    expect(cycle(new RepetitionDetector(config,350),0,25)).toHaveLength(0);
    expect(cycle(new RepetitionDetector(config,350),0,5)).toHaveLength(0);
  });
  it('rejects excessively fast movements and sparse samples', () => {
    expect(cycle(new RepetitionDetector(config,350),0,80,500)).toHaveLength(0);
    const d = new RepetitionDetector(config,350);
    [s(0,0),s(250,0),s(300,50),s(350,90),s(400,50),s(450,0)].forEach(x=>expect(d.update(x)).toBeNull());
  });
  it('does not count an incomplete or interrupted rep', () => {
    const d = new RepetitionDetector(config,350);
    [s(0,0),s(250,0),s(500,30),s(750,80)].forEach(x=>expect(d.update(x)).toBeNull());
    d.reset(); expect(d.update(s(1000,0))).toBeNull();
  });
});
describe('Generic feedback', () => {
  const engine = new FeedbackEngine();
  const metrics = (value: number): Repetition['metrics'] => ({maxKneeFlexion:value,kneeROM:60,maxHipFlexion:70,maxTrunkInclination:30,maxExtensionVelocity:80,duration:5});
  it.each([[60,'below'],[80,'within'],[100,'above'],[67,'within'],[93,'within']])('classifies %s including tolerance as %s', (v, expected) => {
    expect(engine.evaluate(metrics(v as number),defaultPrescription,.9)[0].outcome).toBe(expected);
  });
  it('suppresses feedback for poor quality, unmeasured and nonfinite values', () => {
    expect(engine.evaluate(metrics(80),defaultPrescription,.1)).toEqual([]);
    expect(engine.evaluate(metrics(NaN),defaultPrescription,.9)).toEqual([]);
    const p = structuredClone(defaultPrescription);p.parameters[0].feedback=false;
    expect(engine.evaluate(metrics(80),p,.9)).toEqual([]);
  });
});
describe('JSON definitions', () => {
  it('validates exercise and prescription JSON', () => {
    expect(exerciseSchema.safeParse(ExerciseLibrary.exercises[0]).success).toBe(true);
    expect(prescriptionSchema.safeParse(defaultPrescription).success).toBe(true);
  });
  it('rejects reversed ranges, unknown exercises, duplicate metrics and invalid filters', () => {
    for (const mutate of [
      (p: typeof defaultPrescription)=>{p.parameters[0].lower=100;},
      (p: typeof defaultPrescription)=>{p.exerciseId='bad';},
      (p: typeof defaultPrescription)=>{p.parameters[1].metric=p.parameters[0].metric;},
      (p: typeof defaultPrescription)=>{p.filter.angleTauMs=-1;},
      (p: typeof defaultPrescription)=>{p.parameters[0].measure=false;},
    ]) { const p=structuredClone(defaultPrescription);mutate(p);expect(prescriptionSchema.safeParse(p).success).toBe(false); }
  });
});
describe('Session integration with synthetic landmark sequence', () => {
  it('completes two sets, preserves metrics and exports six reps', () => {
    const p = structuredClone(defaultPrescription); p.reps = 3;
    const e = new ExerciseSession(p,'demo');
    let t=0;
    for (let set=1;set<=2;set++) {
      const start=t;
      while(!e.rest && !e.complete && t-start<25000) { e.process(demoFrame(t,t-start));t+=40; }
      if(set===1) { expect(e.rest).toBe(true);expect(e.landmarks.side).toBe('right');e.nextSet();expect(e.landmarks.side).toBeNull(); }
    }
    expect(e.complete).toBe(true);
    const session=e.recorder.session;
    expect(session.repetitions).toHaveLength(6);
    expect(session.repetitions[0].metrics.maxKneeFlexion).toBeGreaterThan(78);
    expect(session.repetitions[0].feedback[0].outcome).toBe('within');
    expect(session.tracking.effectiveHz).toBeGreaterThan(20);
    expect(exportCSV(session).split('\r\n')).toHaveLength(7);
  });
  it('tracking loss invalidates the current rep and suppresses feedback', () => {
    const p = structuredClone(defaultPrescription);p.sets=1;p.reps=1;
    const e = new ExerciseSession(p,'demo');
    for(let t=0;t<4500;t+=40)e.process(demoFrame(t,t));
    const missing:PoseFrame={timestamp:4500,landmarks:[],width:640,height:480};
    expect(e.process(missing).sample).toBeNull();expect(e.process({...missing,timestamp:4540}).feedback).toEqual([]);
    for(let t=4580;t<7400;t+=40)e.process(demoFrame(t,t));
    expect(e.recorder.session.repetitions).toHaveLength(0);
  });
});
