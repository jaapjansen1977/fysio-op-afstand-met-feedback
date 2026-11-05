import { mkdir, cp, access, writeFile, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

await mkdir('public/models', { recursive: true });
await cp('node_modules/@mediapipe/tasks-vision/wasm', 'public/wasm', { recursive: true });
const path = join('public', 'models', 'pose_landmarker_lite.task');
try { await access(path); console.log('Local pose model present.'); }
catch {
  const url = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length < 1000000) throw new Error('Unexpected model size');
    await writeFile(path + '.tmp', bytes);
    await rename(path + '.tmp', path);
    console.log('Official MediaPipe Lite model downloaded over verified HTTPS.');
  } catch (error) {
    console.warn('Pose model not available. Run npm run assets after network access is available. Demo, tests and build still work.');
    console.warn(error.message, error.cause?.code ?? '');
    if (process.argv.includes('--required')) process.exitCode = 1;
  }
}
try {
  const { readFile } = await import('node:fs/promises');
  const bytes = await readFile(path);
  console.log(`Model SHA-256: ${createHash('sha256').update(bytes).digest('hex')}`);
} catch { /* Missing model is explicitly reported above. */ }
