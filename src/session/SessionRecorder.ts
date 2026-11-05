import type { ExercisePrescription } from '../domain/ExercisePrescription';
import type { KinematicSample, Repetition, Session } from '../domain/types';
export class SessionRecorder {
  session: Session;
  constructor(prescription: ExercisePrescription, source: Session['source']) {
    this.session = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), prescription: structuredClone(prescription), source, repetitions: [], samples: [], tracking: { validFrames: 0, attemptedFrames: 0, activeMs: 0, effectiveHz: 0 }, status: 'interrupted' };
  }
  attempt(valid: boolean, elapsedMs: number) {
    const t = this.session.tracking;
    t.attemptedFrames++; if (valid) t.validFrames++;
    t.activeMs += Math.max(0, elapsedMs);
    t.effectiveHz = t.activeMs > 0 ? t.validFrames * 1000 / t.activeMs : 0;
  }
  addSample(sample: KinematicSample) { this.session.samples.push(sample); }
  addRep(rep: Repetition) { this.session.repetitions.push(rep); }
}
const STORAGE_KEY = 'physio.sessions.v1';
export function loadSessions(): Session[] {
  try { const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]'); return Array.isArray(raw) ? raw.filter(s => s && s.id && Array.isArray(s.repetitions) && Array.isArray(s.samples) && s.tracking && s.prescription?.version === 1) : []; } catch { return []; }
}
export function saveSession(session: Session) {
  // Bound local storage; never store webcam frames. Quota failures are surfaced by the UI.
  localStorage.setItem(STORAGE_KEY, JSON.stringify([session, ...loadSessions().filter(s => s.id !== session.id)].slice(0, 5)));
}
export function exportJSON(session: Session) { return JSON.stringify(session, null, 2); }
export function exportCSV(session: Session) {
  const header = ['exerciseId','set','rep','maxKneeFlexion_deg','kneeROM_deg','maxHipFlexion_deg','maxTrunkInclination_deg','maxExtensionVelocity_deg_s','duration_s','eccentric_s','concentric_s','quality','targets'];
  const quote = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  return [header, ...session.repetitions.map(r => [session.prescription.exerciseId, r.set, r.index, r.metrics.maxKneeFlexion, r.metrics.kneeROM, r.metrics.maxHipFlexion, r.metrics.maxTrunkInclination, r.metrics.maxExtensionVelocity, r.metrics.duration, r.eccentricDuration, r.concentricDuration, r.quality, r.feedback.map(f => `${f.metric}:${f.outcome}`).join(';')])].map(row => row.map(quote).join(',')).join('\r\n');
}
export function download(name: string, contents: string, type: string) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
