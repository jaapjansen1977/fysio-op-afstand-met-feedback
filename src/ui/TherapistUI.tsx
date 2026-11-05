import { useState } from 'react';
import { ExerciseLibrary } from '../domain/ExerciseLibrary';
import { prescriptionSchema, type ExercisePrescription } from '../domain/ExercisePrescription';
import { download } from '../session/SessionRecorder';
interface Props { prescription: ExercisePrescription; onSave: (p: ExercisePrescription) => void; onStart: () => void }
export function TherapistUI({ prescription, onSave, onStart }: Props) {
  const [draft, setDraft] = useState(() => structuredClone(prescription));
  const [notice, setNotice] = useState('');
  const exercise = ExerciseLibrary.exercises.find(e => e.id === draft.exerciseId)!;
  const tempoKeys = exercise.instructions.tempoOrder;
  const update = <K extends keyof ExercisePrescription>(key: K, value: ExercisePrescription[K]) => setDraft(d => ({ ...d, [key]: value }));
  function save(start = false) {
    const result = prescriptionSchema.safeParse(draft);
    if (!result.success) { setNotice(result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(' · ')); return; }
    try { onSave(result.data); setNotice('Voorschrift lokaal opgeslagen.'); if (start) onStart(); }
    catch { setNotice('Opslag niet beschikbaar. Exporteer het voorschrift als JSON.'); }
  }
  async function importFile(file?: File) {
    if (!file) return;
    try { setDraft(prescriptionSchema.parse(JSON.parse(await file.text()))); setNotice('Voorschrift geladen. Sla op om het te gebruiken.'); }
    catch { setNotice('Ongeldig voorschrift. Controleer versie, meetparameters en grenzen.'); }
  }
  return <div className="therapist-layout">
    <section className="card"><div className="section-title"><span className="step">01</span><div><h2>Trainingsvoorschrift</h2><p>Stel de oefening af op je behandeldoel.</p></div></div>
      <div className="field-grid">
        <label>Sets<input type="number" min="1" max="20" value={draft.sets} onChange={e => update('sets', +e.target.value)}/></label>
        <label>Herhalingen per set<input type="number" min="1" max="100" value={draft.reps} onChange={e => update('reps', +e.target.value)}/></label>
      </div>
      <h3>Bewegingstempo <span className="muted">seconden</span></h3><div className="field-grid three">
        {tempoKeys.map((key, i) => <label key={key}>{exercise.instructions.cycle[i]}<input type="number" min={key === 'hold' ? 0 : 0.2} step="0.5" value={draft.tempo[key]} onChange={e => update('tempo', { ...draft.tempo, [key]: +e.target.value })}/></label>)}
      </div>
      <div className="field-grid"><label>Externe belasting<select value={draft.load.type} onChange={e => update('load', { ...draft.load, type: e.target.value as ExercisePrescription['load']['type'] })}><option value="bodyweight">Lichaamsgewicht</option><option value="kg">Gewicht (kg)</option><option value="band">Elastiek</option></select></label>
        {draft.load.type === 'kg' && <label>Kilogram<input type="number" min="0" value={draft.load.value} onChange={e => update('load', { ...draft.load, value: +e.target.value })}/></label>}
        {draft.load.type === 'band' && <label>Elastiek / weerstand<input maxLength={150} value={draft.load.note} onChange={e => update('load', { ...draft.load, note: e.target.value })}/></label>}
      </div>
      <h3>Camera-opstelling</h3><div className="field-grid"><label>Camerapositie<select value={draft.camera} onChange={() => {}}><option value="sagittal">Sagittaal · zijaanzicht</option></select></label><label>Kijkrichting in beeld<select value={draft.facing} onChange={e => update('facing', e.target.value as 'left' | 'right')}><option value="right">Naar rechts →</option><option value="left">← Naar links</option></select></label></div>
      <p className="hint">Plaats de camera op heuphoogte, loodrecht op de zijkant. Houd het hele lichaam in beeld. Links of rechts kijken mag; stel de overeenkomstige kijkrichting in. Het beeld is niet gespiegeld.</p>
    </section>
    <section className="card"><div className="section-title"><span className="step">02</span><div><h2>Metingen & doelbereiken</h2><p>Kies wat je meet en waarop je feedback geeft.</p></div></div>
      <div className="table-scroll"><table className="parameters"><thead><tr><th>Parameter</th><th>Meten</th><th>Feedback</th><th>Van</th><th>Tot</th><th>±</th></tr></thead><tbody>
        {draft.parameters.map((p, i) => { const m = ExerciseLibrary.metrics.find(m => m.id === p.metric)!; const change = (v: Partial<typeof p>) => update('parameters', draft.parameters.map((x, j) => i === j ? { ...x, ...v } : x)); return <tr key={p.metric}><td>{m.label}<small>{m.unit}</small></td><td><input aria-label={`${m.label} meten`} type="checkbox" checked={p.measure} onChange={e => change({ measure: e.target.checked, feedback: e.target.checked && p.feedback })}/></td><td><input aria-label={`${m.label} feedback`} type="checkbox" checked={p.feedback} disabled={!p.measure} onChange={e => change({ feedback: e.target.checked })}/></td>{(['lower','upper','tolerance'] as const).map(key => <td key={key}><input aria-label={`${m.label} ${key}`} type="number" step="0.5" value={p[key]} onChange={e => change({ [key]: +e.target.value })}/></td>)}</tr>; })}
      </tbody></table></div><p className="hint">70–90° is een voorbeeld, geen klinische norm. Tolerantie verruimt beide grenzen. Kniehoek blijft intern nodig voor cyclusdetectie.</p>
      <h3>Feedback</h3><div className="field-grid"><label>Moment<select value={draft.timing} onChange={e => update('timing', e.target.value as ExercisePrescription['timing'])}><option value="live">Tijdens de beweging</option><option value="rep">Na iedere herhaling</option><option value="set">Na iedere set (gemiddelden)</option></select></label><div className="check-stack"><label><input type="checkbox" checked={draft.visual} onChange={e => update('visual', e.target.checked)}/>Visueel</label><label><input type="checkbox" checked={draft.speech} onChange={e => update('speech', e.target.checked)}/>Gesproken (browser)</label></div></div>
      <details><summary>Tracking & filtering</summary><div className="field-grid">{(['angleTauMs','velocityTauMs','minConfidence','maxGapMs'] as const).map((key, i) => <label key={key}>{['Hoekfilter τ (ms)', 'Snelheidsfilter τ (ms)', 'Min. betrouwbaarheid (0–1)', 'Max. meetinterval (ms)'][i]}<input type="number" step={key === 'minConfidence' ? 0.05 : 10} value={draft.filter[key]} onChange={e => update('filter', { ...draft.filter, [key]: +e.target.value })}/></label>)}</div><p className="hint">Meer filtering geeft meer vertraging. Te weinig meetfrequentie of zichtbaarheid onderbreekt de herhaling. ROM en duur krijgen pas na afronding feedback.</p></details>
    </section>
    <div className="action-bar"><div className="inline-actions"><button className="secondary" onClick={() => save()}>Voorschrift opslaan</button><button className="quiet" onClick={() => download('voorschrift.json', JSON.stringify(draft, null, 2), 'application/json')}>JSON export</button><label className="file-button">JSON laden<input type="file" accept=".json,application/json" onChange={e => { void importFile(e.target.files?.[0]); e.target.value = ''; }}/></label></div><button className="primary" onClick={() => save(true)}>Naar oefenomgeving →</button>{notice && <p role="status">{notice}</p>}</div>
  </div>;
}
