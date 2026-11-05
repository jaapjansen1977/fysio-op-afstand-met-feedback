import { useEffect, useRef, useState } from 'react';
import { ExerciseLibrary } from '../domain/ExerciseLibrary';
import type { ExercisePrescription } from '../domain/ExercisePrescription';
import type { Feedback, KinematicSample, PoseFrame, Session } from '../domain/types';
import { ExerciseSession } from '../session/ExerciseSession';
import { MediaPipePoseEstimator } from '../pose/MediaPipePoseEstimator';
import { demoFrame } from '../pose/demo';
import { confidence, sideIndices } from '../engine/LandmarkProcessor';
interface Props { prescription: ExercisePrescription; onFinish: (s: Session) => void }
type Status = 'idle' | 'loading' | 'running' | 'paused' | 'rest';
export function PatientUI({ prescription, onFinish }: Props) {
  const video = useRef<HTMLVideoElement>(null), canvas = useRef<HTMLCanvasElement>(null);
  const engine = useRef<ExerciseSession | null>(null), estimator = useRef<MediaPipePoseEstimator | null>(null), stream = useRef<MediaStream | null>(null);
  const raf = useRef(0), mounted = useRef(true), state = useRef<Status>('idle'), generation = useRef(0);
  const [status, setStatus] = useState<Status>('idle'), [error, setError] = useState(''), [sample, setSample] = useState<KinematicSample | null>(null);
  const [messages, setMessages] = useState<Feedback[]>([]), [count, setCount] = useState(0), [set, setSet] = useState(1), [hz, setHz] = useState(0), [phase, setPhase] = useState('seeking');
  const [source, setSource] = useState<Session['source']>('camera');
  function change(s: Status) { state.current = s; setStatus(s); }
  function release() {
    cancelAnimationFrame(raf.current); stream.current?.getTracks().forEach(t => t.stop()); stream.current = null;
    estimator.current?.dispose(); estimator.current = null;
    if (video.current) video.current.srcObject = null;
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  }
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; generation.current++; release(); }; }, []);
  function finish(completed = false) {
    const e = engine.current;
    change('idle'); generation.current++; release();
    if (e) { e.recorder.session.status = completed ? 'completed' : 'stopped'; onFinish(structuredClone(e.recorder.session)); }
  }
  function draw(frame: PoseFrame, demo: boolean) {
    const c = canvas.current; if (!c) return;
    c.width = frame.width; c.height = frame.height;
    const ctx = c.getContext('2d'); if (!ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    if (demo) { ctx.fillStyle = '#162d32'; ctx.fillRect(0, 0, c.width, c.height); ctx.strokeStyle = '#345056'; ctx.beginPath(); ctx.moveTo(0, 423); ctx.lineTo(640, 423); ctx.stroke(); }
    ctx.strokeStyle = '#8aabb090'; ctx.lineWidth = 2;
    const links = [[11,12],[11,13],[13,15],[12,14],[14,16],[11,23],[12,24],[23,24],[23,25],[25,27],[27,29],[29,31],[24,26],[26,28],[28,30],[30,32]];
    for (const [a,b] of links) {
      const p = frame.landmarks[a], q = frame.landmarks[b];
      if (confidence(p) < prescription.filter.minConfidence || confidence(q) < prescription.filter.minConfidence) continue;
      ctx.beginPath(); ctx.moveTo(p.x*c.width,p.y*c.height); ctx.lineTo(q.x*c.width,q.y*c.height); ctx.stroke();
    }
    for (const side of ['left', 'right'] as const) {
      const points = sideIndices[side].map(i => frame.landmarks[i]);
      const selected = engine.current?.landmarks.side === side;
      ctx.strokeStyle = selected ? '#68efbb' : '#8aabb0'; ctx.fillStyle = ctx.strokeStyle; ctx.lineWidth = selected ? 5 : 2;
      for (let i = 0; i < points.length; i++) {
        const p = points[i]; if (confidence(p) < prescription.filter.minConfidence) continue;
        ctx.beginPath(); ctx.arc(p.x * c.width, p.y * c.height, selected ? 6 : 4, 0, Math.PI * 2); ctx.fill();
        const next = points[i + 1]; if (next && confidence(next) >= prescription.filter.minConfidence) { ctx.beginPath(); ctx.moveTo(p.x * c.width, p.y * c.height); ctx.lineTo(next.x * c.width, next.y * c.height); ctx.stroke(); }
      }
    }
  }
  async function start(mode: Session['source']) {
    if (state.current !== 'idle') return;
    change('loading'); setError(''); setSource(mode); setMessages([]); setSample(null); setCount(0); setSet(1); setHz(0);
    const token = ++generation.current;
    const isCurrent = () => mounted.current && generation.current === token;
    try {
      if (mode === 'camera') {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('Webcam vereist localhost of HTTPS en een ondersteunde browser.');
        const media = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30, max: 30 } } });
        if (!isCurrent()) { media.getTracks().forEach(t => t.stop()); return; }
        stream.current = media;
        const v = video.current; if (!v) throw new Error('Videovenster niet beschikbaar.');
        v.srcObject = media; await v.play();
        if (!isCurrent()) return;
        const pose = new MediaPipePoseEstimator(); estimator.current = pose;
        await pose.initialize();
        if (!isCurrent()) { pose.dispose(); return; }
        media.getVideoTracks()[0].onended = () => { if (isCurrent()) { setError('Camera gestopt. Start een nieuwe sessie.'); change('idle'); release(); } };
      }
      if (!isCurrent()) return;
      engine.current = new ExerciseSession(structuredClone(prescription), mode);
      change('running');
      let lastVideoTime = -1, lastProcess = 0, demoElapsed = 0, lastTick = performance.now(), lastRender = 0, lastSpeech = 0;
      const started = performance.now();
      const tick = (now: number) => {
        if (!isCurrent()) return;
        try {
          const delta = now - lastTick; lastTick = now;
          if (state.current === 'running') {
            demoElapsed += delta;
            const v = video.current;
            if (now - started > 30 * 60 * 1000) { setError('Maximale sessieduur bereikt (30 minuten).'); finish(); return; }
            if (now - lastProcess >= 30 && (mode === 'demo' || (v && v.readyState >= 2 && v.currentTime !== lastVideoTime))) {
              lastProcess = now; if (v) lastVideoTime = v.currentTime;
              const frame = mode === 'demo' ? demoFrame(now, demoElapsed) : estimator.current?.estimate(v!, now);
              if (frame) {
                const e = engine.current!;
                const result = e.process(frame);
                draw(frame, mode === 'demo');
                if (now - lastRender >= 100 || result.repAdded) {
                  lastRender = now; setSample(result.sample); setHz(e.recorder.session.tracking.effectiveHz); setPhase(e.detector.phase);
                  if (!result.sample) setMessages([]);
                  else if (result.feedback.length) setMessages(result.feedback);
                  setCount(e.recorder.session.repetitions.filter(r => r.set === e.set).length);
                }
                if (prescription.speech && result.feedback.length && (prescription.timing !== 'live' || now - lastSpeech > 5000) && 'speechSynthesis' in window) {
                  lastSpeech = now;
                  const speech = new SpeechSynthesisUtterance(result.feedback[0].text); speech.lang = 'nl-NL'; window.speechSynthesis.cancel(); window.speechSynthesis.speak(speech);
                }
                if (e.complete) { finish(true); return; }
                if (e.rest) { e.interrupt(); change('rest'); }
              }
            }
          }
          raf.current = requestAnimationFrame(tick);
        } catch (err) { setError(err instanceof Error ? err.message : 'Tracking mislukt.'); change('idle'); generation.current++; release(); }
      };
      raf.current = requestAnimationFrame(tick);
    } catch (err) {
      if (isCurrent()) { setError(err instanceof Error ? err.message : 'Camera kon niet starten.'); change('idle'); release(); }
    }
  }
  const phaseLabel: Record<string, string> = { seeking: 'Ga rechtop staan', ready: 'Klaar voor de volgende squat', eccentric: 'Zakken', concentric: 'Omhoog' };
  const active = status !== 'idle' && status !== 'loading';
  return <div className="patient-layout"><section className="camera-card">
    <div className="camera-top"><span className="camera-label"><span className={active ? 'dot live' : 'dot'}/>{source === 'demo' && active ? 'SYNTHETISCHE DEMO' : 'SAGITTAAL · ZIJAANZICHT'}</span><span>{hz.toFixed(1)} Hz effectief</span></div>
    <div className="camera-stage"><video ref={video} muted playsInline style={{ visibility: source === 'demo' ? 'hidden' : 'visible' }}/><canvas ref={canvas}/>
      {status === 'idle' && <div className="camera-placeholder"><div className="camera-icon">◉</div><h2>Klaar om te bewegen?</h2><p>Zet je camera op heuphoogte.<br/>Sta met je zijkant naar de camera.</p><button className="primary" onClick={() => void start('camera')}>Webcam starten</button><button className="demo-link" onClick={() => void start('demo')}>Probeer de demonstratie →</button></div>}
      {status === 'loading' && <div className="camera-placeholder"><h2>Camera & pose-model laden…</h2><p>Geef toestemming voor je webcam.</p></div>}
      {(status === 'paused' || status === 'rest') && <div className="camera-placeholder"><h2>{status === 'rest' ? 'Set afgerond' : 'Gepauzeerd'}</h2><p>{status === 'rest' ? 'Neem rust en start wanneer je klaar bent.' : 'De lopende herhaling is onderbroken.'}</p></div>}
      {status === 'running' && <span className={`tracking-badge ${sample ? '' : 'warning'}`}>{sample ? `Tracking actief · ${sample.side === 'left' ? 'linker' : 'rechter'}been · ${Math.round(sample.quality * 100)}%` : 'Meting gepauzeerd · ga volledig in beeld staan'}</span>}
    </div>
    <div className="camera-controls"><span>Video blijft op dit apparaat</span><div className="inline-actions">{status === 'running' && <button className="secondary" onClick={() => { engine.current?.interrupt(); setSample(null); setMessages([]); change('paused'); }}>Ⅱ Pauzeren</button>}{status === 'paused' && <button className="primary" onClick={() => change('running')}>Hervatten</button>}{status === 'rest' && <button className="primary" onClick={() => { engine.current?.nextSet(); setSet(engine.current!.set); setCount(0); setSample(null); setMessages([]); change('running'); }}>Start set {set + 1}</button>}{active && <button className="quiet" onClick={() => finish()}>Stoppen</button>}</div></div>
    {error && <p className="error" role="alert">{error}</p>}
  </section><aside className="session-side">
    <section className="card progress-card"><span className="eyebrow">JE TRAINING</span><div className="set-heading"><h2>Set {set} <span>/ {prescription.sets}</span></h2><span>{prescription.reps} herhalingen</span></div><div className="rep-number">{count}<span> / {prescription.reps}</span></div><progress max={prescription.reps} value={count}/><p>{status === 'running' ? phaseLabel[phase] : status === 'rest' ? 'Rustmoment' : 'Beweeg op jouw tempo'}</p></section>
    <section className="card angle-card"><span className="eyebrow">ACTUELE KNIEFLEXIE</span><div className="angle-value">{sample ? Math.round(sample.kneeFlexion) : '—'}<span>°</span></div><p>0° = volledige knie-extensie</p></section>
    <section className={`card feedback-card ${messages[0]?.tone ?? ''}`} aria-live="polite"><span className="eyebrow">BEWEGINGSFEEDBACK</span>{prescription.visual && messages.length ? messages.map(m => <p key={m.metric}><strong>{ExerciseLibrary.metrics.find(metric => metric.id === m.metric)?.label}: {m.value.toFixed(1)} {ExerciseLibrary.metrics.find(metric => metric.id === m.metric)?.unit}</strong><br/>{m.text}</p>) : <p>{prescription.visual ? 'Je feedback verschijnt hier zodra een geldige meting beschikbaar is.' : 'Visuele feedback is uitgeschakeld.'}</p>}{prescription.timing === 'live' && <small>Momentopname; maxima, ROM en duur staan in de resultaten.</small>}</section>
    <section className="tempo-strip"><span>TEMPO</span><strong>{prescription.tempo.eccentric} – {prescription.tempo.hold} – {prescription.tempo.concentric}</strong><small>Zakken · vasthouden · omhoog (s)<br/>Tempo is een instructie, geen automatische beoordeling.</small></section>
  </aside></div>;
}
