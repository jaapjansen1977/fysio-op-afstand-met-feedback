import { useState } from 'react';
import { ExerciseLibrary } from './domain/ExerciseLibrary';
import { defaultPrescription, prescriptionSchema, type ExercisePrescription } from './domain/ExercisePrescription';
import type { Session } from './domain/types';
import { loadSessions, saveSession } from './session/SessionRecorder';
import { TherapistUI } from './ui/TherapistUI';
import { PatientUI } from './ui/PatientUI';
import { ResultsUI } from './ui/ResultsUI';
function loadPrescription() { try { return prescriptionSchema.parse(JSON.parse(localStorage.getItem('physio.prescription.v1') ?? 'null')); } catch { return defaultPrescription; } }
export default function App() {
  const [tab, setTab] = useState<'therapist' | 'patient' | 'results'>('therapist');
  const [prescription, setPrescription] = useState<ExercisePrescription>(loadPrescription);
  const [sessions, setSessions] = useState(loadSessions), [selected, setSelected] = useState<Session | null>(() => loadSessions()[0] ?? null);
  const [category, setCategory] = useState('strength'), [storageError, setStorageError] = useState('');
  const exercise = ExerciseLibrary.exercises[0];
  function finish(s: Session) {
    setSelected(s); setSessions(old => [s, ...old].slice(0,5)); setTab('results');
    try { saveSession(s); } catch { setStorageError('Lokale opslag is vol of niet beschikbaar. Exporteer deze sessie naar JSON of CSV.'); }
  }
  function navigate(target: typeof tab) {
    if (tab === 'patient' && target !== 'patient' && !window.confirm('Oefenomgeving verlaten? Een lopende sessie wordt niet opgeslagen. Gebruik Stoppen om resultaten te bewaren.')) return;
    setTab(target);
  }
  return <><header className="app-header"><a className="brand" href="#" onClick={e=>{e.preventDefault();navigate('therapist');}}><span className="brand-mark">p<span>+</span></span><span>physio<span className="brand-sub">exercise feedback</span></span></a><div className="header-right"><span className="local-tag"><span className="dot"/> Lokaal & privé</span><span className="prototype">MVP 1</span></div></header>
    <div className="app-shell"><aside className="sidebar"><span className="eyebrow">WERKOMGEVING</span><nav aria-label="Werkstappen">{([['therapist','01','Voorschrijven'],['patient','02','Oefenen'],['results','03','Resultaten']] as const).map(([key,number,label]) => <button key={key} className={tab===key?'nav-item active':'nav-item'} onClick={()=>navigate(key)}><span>{number}</span>{label}<b>→</b></button>)}</nav><div className="sidebar-library"><span className="eyebrow">OEFENBIBLIOTHEEK</span>{ExerciseLibrary.categories.map(c=><button key={c.id} className={`category ${category===c.id?'selected':''}`} onClick={()=>{setCategory(c.id);navigate('therapist');}}>{c.name}<span>{ExerciseLibrary.exercises.filter(e=>e.categories.includes(c.id)).length}</span></button>)}</div><div className="sidebar-note"><span className="small-icon">⌁</span><strong>Beweging in beeld.</strong><p>Inzicht voor de therapeut.<br/>Duidelijkheid voor de patiënt.</p></div></aside>
    <main><div className="breadcrumb">Oefenbibliotheek <span>/</span> {tab==='therapist'?'Voorschrijven':tab==='patient'?'Oefenomgeving':'Resultaten'}</div><div className="page-heading"><div><span className="eyebrow">{tab==='therapist'?'OEFENING VOORSCHRIJVEN':tab==='patient'?'BEWEEG MET VERTROUWEN':'INZICHT IN JE BEWEGING'}</span><h1>{tab==='results'?'Jouw trainingsresultaten':exercise.name}</h1><p>{tab==='therapist'?'Een helder voorschrift. Persoonlijke bewegingsfeedback.':tab==='patient'?'Zak rustig, beweeg gecontroleerd en volg de feedback.':'Bekijk iedere herhaling en neem de resultaten mee.'}</p></div><span className="exercise-code">EX001 <span>·</span> {tab==='patient'?'Live analyse':'Tweebenige squat'}</span></div>
      <div className="notice"><span>ⓘ</span><p>Prototype voor testen met fictieve gegevens. Doelbereiken worden door de therapeut bepaald; metingen zijn nog niet klinisch gevalideerd.</p></div>
      {storageError && <p role="alert" className="error">{storageError}</p>}
      {tab==='therapist' && (exercise.categories.includes(category as typeof exercise.categories[number]) ? <><div className="exercise-intro"><span className="pill">Spierkracht en weerstand</span><p>{exercise.description}</p></div><TherapistUI prescription={prescription} onSave={p=>{localStorage.setItem('physio.prescription.v1',JSON.stringify(p));setPrescription(p);}} onStart={()=>setTab('patient')}/></> : <section className="card empty"><h2>Deze categorie is klaar voor uitbreiding</h2><p>In MVP 1 is EX001 beschikbaar onder Spierkracht en weerstand.</p><button className="primary" onClick={()=>setCategory('strength')}>Bekijk de squat</button></section>)}
      {tab==='patient' && <PatientUI prescription={prescription} onFinish={finish}/>}
      {tab==='results' && <>{sessions.length>0 && <label className="session-select">Opgeslagen sessie<select value={selected?.id ?? ''} onChange={e=>setSelected(sessions.find(s=>s.id===e.target.value)??null)}>{sessions.map(s=><option value={s.id} key={s.id}>{new Date(s.createdAt).toLocaleString('nl-NL')} · {s.source==='demo'?'Demo':'Webcam'} · {s.repetitions.length} herhalingen</option>)}</select></label>}{selected?<ResultsUI session={selected}/>:<section className="card empty"><h2>Je eerste sessie begint hier</h2><p>Voltooi een oefening of probeer de demonstratie om resultaten te bekijken.</p><button className="primary" onClick={()=>setTab('patient')}>Naar oefenomgeving →</button></section>}</>}
      <footer>PHYSIO EXERCISE FEEDBACK <span>Alle analyse op je eigen apparaat · Geen video-opslag</span></footer>
    </main></div></>;
}
