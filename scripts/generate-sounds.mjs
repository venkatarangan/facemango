// Generates FaceMango's short UI sounds as small WAV files (original, synthesised, no licence
// strings attached). Run once: node scripts/generate-sounds.mjs
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const RATE = 22050;

function wav(samples) {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((s, i) => data.writeInt16LE(Math.max(-1, Math.min(1, s)) * 32767, i * 2));
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

/** Sum of decaying sine partials. notes: [freqHz, startSec, durSec, gain] */
function synth(totalSec, notes) {
  const out = new Float32Array(Math.round(totalSec * RATE));
  for (const [freq, start, dur, gain] of notes) {
    const s0 = Math.round(start * RATE);
    const n = Math.round(dur * RATE);
    for (let i = 0; i < n && s0 + i < out.length; i++) {
      const t = i / RATE;
      const env = Math.min(1, t / 0.005) * Math.exp(-t / (dur / 4));
      out[s0 + i] +=
        gain * env * (Math.sin(2 * Math.PI * freq * t) + 0.25 * Math.sin(4 * Math.PI * freq * t));
    }
  }
  return Array.from(out);
}

const sounds = {
  // Soft "pop" for a like.
  pop: synth(0.18, [
    [880, 0, 0.16, 0.5],
    [1320, 0.01, 0.1, 0.2],
  ]),
  // Gentle two-note ping for a new comment/notification.
  ping: synth(0.45, [
    [1046.5, 0, 0.3, 0.35],
    [1568, 0.09, 0.35, 0.3],
  ]),
  // Rising major arpeggio for milestones.
  chime: synth(0.9, [
    [659.25, 0, 0.5, 0.3],
    [783.99, 0.1, 0.5, 0.3],
    [1046.5, 0.2, 0.6, 0.32],
    [1318.5, 0.32, 0.55, 0.22],
  ]),
};
for (const [name, samples] of Object.entries(sounds)) {
  await writeFile(path.join(root, 'public', 'sounds', `${name}.wav`), wav(samples));
}
console.log('Sounds written to public/sounds/');
