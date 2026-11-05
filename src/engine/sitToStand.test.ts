import { describe, it, expect } from 'vitest';
import { ExerciseLibrary, exerciseSchema } from '../domain/ExerciseLibrary';
import { defaultPrescription } from '../domain/ExercisePrescription';
import type { KinematicSample } from '../domain/types';
import { SitToStandDetector } from './SitToStandDetector';
import { ExerciseSession } from '../session/ExerciseSession';
import { demoFrame } from '../pose/demo';
import { exportCSV } from '../session/SessionRecorder';
const exercise = ExerciseLibrary.exercises.find(e => e.id === 'EX002')!;
const config = exercise.detector;
const sample = (timestamp: number, kneeFlexion: number, velocity = 0): KinematicSample => ({ timestamp, kneeFlexion, hipFlexion: kneeFlexion, trunkInclination: 20, kneeVelocity: velocity, quality: .95, side: 'right' });
function run(detector: SitToStandDetector, keys: [number, number][], offset = 0, gap?: number) {
  const reps = [];
  let previous = keys[0][1];
  for (let t = 0; t <= keys.at(-1)![0]; t += 40) {
    if (gap !== undefined && t >= gap && t < gap + 500) continue;
    let index = keys.findIndex(([time]) => time >= t); if (index <= 0) index = 1;
    const a = keys[index-1], b = keys[index];
    const angle = a[1] + (b[1]-a[1]) * (t-a[0]) / (b[0]-a[0]);
    const rep = detector.update(sample(t + offset, angle, (angle-previous)/.04)); previous = angle;
    if (rep) reps.push(rep);
  }
  return reps;
}
const full: [number, number][] = [[0,82],[800,82],[2800,0],[3400,0],[5400,82],[6200,82]];
describe('EX002 sit-to-stand strategy', () => {
  it('belongs to both functional movement and strength categories', () => {
    expect(exercise.categories).toEqual(['functional', 'strength']);
    expect(exerciseSchema.safeParse(exercise).success).toBe(true);
    expect(exerciseSchema.safeParse({...exercise,detector:{...config,seatedMin:undefined}}).success).toBe(false);
  });
  it('counts seated → standing → seated and computes phase metrics', () => {
    const reps = run(new SitToStandDetector(config,350),full);
    expect(reps).toHaveLength(1);
    const rep = reps[0];
    expect(rep.turnPosition).toBe('standing'); expect(rep.bottom).toBeUndefined();
    expect(rep.start).toBeLessThan(rep.turn!); expect(rep.turn!).toBeLessThan(rep.end);
    expect(rep.metrics.kneeROM).toBeGreaterThan(70);
    expect(rep.metrics.maxKneeFlexion).toBeGreaterThan(77);
    expect(rep.metrics.maxExtensionVelocity).toBeCloseTo(41);
    expect(rep.concentricDuration).toBeGreaterThan(1.5);
    expect(rep.eccentricDuration).toBeGreaterThan(1.5);
  });
  it('requires a seated start and does not count a squat from standing', () => {
    expect(run(new SitToStandDetector(config,350),[[0,0],[800,0],[2800,82],[3400,82],[5400,0],[6200,0]])).toHaveLength(0);
  });
  it('does not count a partial rise or combine it into the next full rise', () => {
    const detector = new SitToStandDetector(config,350);
    expect(run(detector,[[0,82],[800,82],[1800,40],[2800,82],[3600,82]])).toHaveLength(0);
    expect(run(detector,full,3640)).toHaveLength(1);
  });
  it('requires sustained standing instead of a one-frame extension spike', () => {
    expect(run(new SitToStandDetector(config,350),[[0,82],[800,82],[2000,30],[2040,0],[2080,30],[3400,82],[4000,82]])).toHaveLength(0);
  });
  it('requires return close to the initial seated angle', () => {
    expect(run(new SitToStandDetector(config,350),[[0,82],[800,82],[2800,0],[3400,0],[5400,67],[6200,67]])).toHaveLength(0);
  });
  it('does not count seated noise as a repetition', () => {
    expect(run(new SitToStandDetector(config,350),[[0,82],[800,82],[1600,79],[2400,84],[3200,81]])).toHaveLength(0);
  });
  it('invalidates a repetition spanning a timestamp gap', () => {
    expect(run(new SitToStandDetector(config,350),full,0,2000)).toHaveLength(0);
  });
  it('rejects overlong cycles', () => {
    const slow = full.map(([t,a])=>[t*5,a] as [number,number]);
    expect(run(new SitToStandDetector(config,350),slow)).toHaveLength(0);
  });
  it('explicit reset prevents completion of an interrupted cycle', () => {
    const d = new SitToStandDetector(config,350);
    run(d,[[0,82],[800,82],[2800,0],[3400,0]]);d.reset();
    expect(run(d,[[0,0],[800,0],[2800,82],[3400,82]],3440)).toHaveLength(0);
  });
  it.each(['left','right'] as const)('completes two sets through the full pose pipeline facing %s', facing => {
    const p = structuredClone(defaultPrescription);p.exerciseId='EX002';p.sets=2;p.reps=2;p.facing=facing;
    const e = new ExerciseSession(p,'demo');let t=0;
    for(let set=1;set<=2;set++){
      const start=t;
      while(!e.rest&&!e.complete&&t-start<18000){e.process(demoFrame(t,t-start,'sitToStand',facing));t+=40;}
      if(set===1){expect(e.rest).toBe(true);e.nextSet();}
    }
    expect(e.complete).toBe(true);expect(e.recorder.session.repetitions).toHaveLength(4);
    for(const r of e.recorder.session.repetitions){
      expect(r.turnPosition).toBe('standing');expect(r.metrics.maxExtensionVelocity).toBeGreaterThan(30);
      expect(r.metrics.maxTrunkInclination).toBeGreaterThan(20);
      expect(r.feedback[0].outcome).toBe('within');
    }
    expect(exportCSV(e.recorder.session).split('\r\n')).toHaveLength(5);
  });
});
