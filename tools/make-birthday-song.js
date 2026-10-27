// The 生日惊喜 film's song: 「生日快乐歌」 as a music box, built from code.
//   node tools/make-birthday-song.js        → happy-birthday-musicbox.m4a (repo root)
//
// Why built and not downloaded: the melody is public domain (Hill sisters,
// out of copyright everywhere since 2017), but every RECORDING of it is
// somebody's performance, and this repo deploys publicly. A rendering made
// here is ours outright. It is also small, loops cleanly (the film's <audio>
// has `loop`), and can be re-voiced by changing a number.
//
// Shape (98 bpm, 3/4, ~55s): a sparkle and a little arpeggio as the candles go
// out → verse 1 music box over a soft waltz → verse 2 celesta an octave up over
// broken chords → a D7 lift into G → verse 3 both together, fuller, slowing into
// a held chord, then a quiet tail so the loop restarts from silence.
//
// Phone speakers drop everything under ~250 Hz, so the bass carries its own
// harmonics or it would vanish on the device this is played on.
// Needs macOS `afconvert` for the AAC step (WAV is kept in /tmp if it fails).

const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const SR = 44100, BPM = 98, NYQ = SR * 0.45;
const OUT = path.join(__dirname, '..', 'happy-birthday-musicbox.m4a');

let seed = 20261101;
const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

/* ── the score, in beats ─────────────────────────────────────────────── */
const notes = [];
const add = (inst, t, m, d, vel = 1, pan = 0) => notes.push({ inst, t, m, d, vel, pan });

// Melody relative to the key's tonic T (T = F4 in F): pickup "Hap-py" on the 5th.
const MEL = [[7, .75], [7, .25], [9, 1], [7, 1], [12, 1], [11, 2],
             [7, .75], [7, .25], [9, 1], [7, 1], [14, 1], [12, 2],
             [7, .75], [7, .25], [19, 1], [16, 1], [12, 1], [11, 1], [9, 1],
             [17, .75], [17, .25], [16, 1], [12, 1], [14, 1], [12, 3]];
// Chords relative to T: bass note + three voices in the C4–B4 band (under the tune).
const CH = {
  I:   { b: -12, v: [-5, 0, 4] },
  V7:  { b: -17, v: [-7, -1, 2] },
  I7:  { b: -12, v: [-5, -2, 4] },
  IV:  { b: -19, v: [-3, 0, 5] },
  V7V: { b: -15, v: [-5, 1, 4] },       // D7 in F: the lift into G
};
// Bar by bar: I | V7 | V7 | I | I7 | IV | I . V7 | I
const BARS = [['I'], ['V7'], ['V7'], ['I'], ['I7'], ['IV'], ['I', 'I', 'V7'], ['I']];

function accomp(style, t, T, bar, vel) {
  const at = (beat) => CH[bar[Math.min(beat, bar.length - 1)]];
  const c0 = at(0);
  add('bass', t, T + c0.b, 2.2, .95 * vel, -.05);
  if (style === 'waltz' || style === 'full') {
    for (const beat of [1, 2]) {
      const c = at(beat);
      if (beat === 2 && bar.length > 2) add('bass', t + 2, T + c.b, .9, .7 * vel, -.05);
      c.v.forEach((v, k) => add('ep', t + beat + k * .012, T + v, .75, (beat === 1 ? .5 : .42) * vel, [-.35, .05, .35][k]));
    }
    if (style === 'full') c0.v.forEach((v, k) => add('ep', t + k * .03, T + v + 12, 2.6, .22 * vel, [.4, -.4, .1][k]));
  } else if (style === 'broken') {
    [[1, 0], [1.5, 1], [2, 2], [2.5, 1]].forEach(([beat, k]) => {
      const c = at(Math.floor(beat));
      add('ep', t + beat, T + c.v[k], .6, .4 * vel, [-.3, .1, .35][k]);
    });
  }
}

function sparkle(t, T, len = .75, from = 12, n = 9, vel = .5) {
  const PENTA = [0, 2, 4, 7, 9];
  for (let i = 0; i < n; i++) {
    const oct = Math.floor(i / 5), m = T + from + PENTA[i % 5] + 12 * oct;
    add('glock', t + (i / n) * len, m, .5, vel * (.55 + .45 * i / n), -.4 + .8 * i / n);
  }
}

// One verse. t0 = the beat the pickup starts on. Returns the beat after its last note.
function verse(t0, T, { lead, double, style, last = 2, vel = 1 }) {
  let t = t0;
  MEL.forEach(([iv, d], i) => {
    const isLast = i === MEL.length - 1;
    const dd = isLast ? last : d;
    const bar = Math.floor((t - t0 - 1 + 1e-6) / 3);
    const climax = bar === 4 || bar === 5 ? 1.08 : 1;
    const accent = Math.abs(((t - t0 - 1) % 3)) < 1e-6 ? 1.06 : .97;
    const v = vel * climax * accent;
    add(lead.inst, t, T + iv + lead.oct, dd, lead.vel * v, .05);
    if (double) add(double.inst, t + .01, T + iv + double.oct, dd, double.vel * v, -.1);
    t += dd;
  });
  BARS.forEach((bar, b) => accomp(style, t0 + 1 + 3 * b, T, bar, vel));
  return t;
}

const F = 65, G = 67;
// Intro: the candles go out — a sparkle up, the I chord rolled, a little arpeggio, V7, then "Hap-py".
sparkle(0, F, .8, 12, 10, .55);
add('bass', 0, F - 12, 2.5, .9);
CH.I.v.forEach((v, k) => add('ep', .05 + k * .06, F + v, 2.6, .42, [-.35, .05, .35][k]));
[[1, 16], [1.5, 19], [2, 24], [2.5, 19]].forEach(([b, iv]) => add('box', b, F + iv, .5, .62, .15));
add('bass', 3, F + CH.V7.b, 1.8, .85);
CH.V7.v.forEach((v, k) => add('ep', 4 + k * .012, F + v, .8, .45, [-.35, .05, .35][k]));
add('box', 3, F + 14, 1, .55, .15); add('box', 4, F + 11, 1, .5, .15);

let t = verse(5, F, { lead: { inst: 'box', oct: 0, vel: 1 }, style: 'waltz', last: 2 });
const v2 = t;
t = verse(v2, F, { lead: { inst: 'cel', oct: 12, vel: .85 }, double: { inst: 'box', oct: 0, vel: .4 }, style: 'broken', last: 3, vel: .95 });
sparkle(v2 + 1 + 21, F, .9, 12, 9, .4);
// Lift: D7, a sparkle, then verse 3's pickup lands on D — the 5th of G.
const lift = t;
add('bass', lift, F + CH.V7V.b, 2, .95);
CH.V7V.v.forEach((v, k) => add('ep', lift + k * .05, F + v, 1.9, .5, [-.35, .05, .35][k]));
sparkle(lift + .2, G, 1.2, 12, 11, .45);
const v3 = lift + 2;
const end = verse(v3, G, { lead: { inst: 'box', oct: 0, vel: 1.05 }, double: { inst: 'cel', oct: 12, vel: .5 }, style: 'full', last: 3, vel: 1.05 });
[3, 9, 15].forEach(b => sparkle(v3 + 1 + b + 2.2, G, .6, 19, 6, .3));
// The held ending: a slow roll up through G major, a high chime, the bass under it.
const fin = v3 + 1 + 21;
[-12, -5, 0, 4, 7, 12].forEach((iv, k) => add('ep', fin + k * .09, G + iv, 4.5, .45, -.5 + k * .2));
add('bass', fin, G - 12, 4.5, 1);
add('glock', fin + .7, G + 24, 2, .4, .3);
add('cel', fin + 1, G + 31, 2, .3, -.2);

/* ── time: steady, then a ritardando over the last two bars ─────────── */
const RIT_FROM = fin - 3, RIT_TO = fin + 2, SLOW = .55;
function sec(beat) {
  const spb = 60 / BPM;
  if (beat <= RIT_FROM) return beat * spb;
  let s = RIT_FROM * spb, b = RIT_FROM;
  const step = 1 / 64;
  while (b < beat) {
    const k = Math.min(1, (b - RIT_FROM) / (RIT_TO - RIT_FROM));
    const tempo = BPM * (1 - (1 - SLOW) * k);
    const db = Math.min(step, beat - b);
    s += db * 60 / tempo; b += db;
  }
  return s;
}

/* ── instruments ─────────────────────────────────────────────────────── */
// Each: (f, vel, durSec) → { partials: [[ratio, amp, tau]], att, rel, len, fm? }
const INST = {
  // music box: bright, plucked, rings on its own; higher combs die faster
  box: (f) => { const tau = Math.min(1.9, Math.max(.55, 1.35 * Math.sqrt(523 / f)));
    return { gain: .30, att: .0015, ring: true, tau, parts: [[1, 1, tau], [2, .32, tau * .55], [3, .1, tau * .35], [4.2, .05, tau * .2], [6.8, .1, .018]] }; },
  // celesta: rounder, sweeter, longer
  cel: (f) => { const tau = Math.min(2.2, Math.max(.7, 1.7 * Math.sqrt(784 / f)));
    return { gain: .27, att: .004, ring: true, tau, parts: [[1, 1, tau], [2, .16, tau * .5], [4, .07, tau * .3], [3, .04, tau * .3]] }; },
  // glockenspiel: bar partials, very short
  glock: () => ({ gain: .13, att: .001, ring: true, tau: .8, parts: [[1, 1, .8], [2.76, .28, .35], [5.4, .1, .15], [8.93, .04, .08]] }),
  // soft electric piano: FM with a decaying index, damped at note-off
  ep: (f) => ({ gain: .15, att: .005, ring: false, tau: 1.6 * Math.sqrt(262 / f), fm: true, rel: .14 }),
  // bass: a pluck with its own harmonics so a phone speaker still shows it
  bass: () => ({ gain: .26, att: .006, ring: false, tau: .95, rel: .16, parts: [[1, 1, .95], [2, .55, .7], [3, .28, .5], [4, .14, .35]] }),
};

/* ── render ──────────────────────────────────────────────────────────── */
const lastSec = Math.max(...notes.map(n => sec(n.t + n.d))) + 3.2;
const N = Math.ceil(lastSec * SR);
const L = new Float32Array(N), R = new Float32Array(N);
const TWO_PI = Math.PI * 2;

for (const n of notes) {
  const jitter = n.inst === 'ep' || n.inst === 'bass' ? 0 : (rnd() - .5) * .012;
  const start = Math.max(0, Math.round((sec(n.t) + jitter) * SR));
  const durS = sec(n.t + n.d) - sec(n.t);
  const f = mtof(n.m), I = INST[n.inst](f);
  const vel = n.vel * (.94 + rnd() * .1) * I.gain;
  const life = I.ring ? I.tau * 6.5 : durS + I.rel * 6;
  const len = Math.min(N - start, Math.ceil(life * SR));
  const a = (n.pan + 1) * Math.PI / 4, gl = Math.cos(a), gr = Math.sin(a);
  for (let i = 0; i < len; i++) {
    const tt = i / SR;
    let env = Math.min(1, tt / I.att);
    if (!I.ring && tt > durS) env *= Math.exp(-(tt - durS) / I.rel);
    let s = 0;
    if (I.fm) {
      const idx = 1.25 * Math.exp(-tt / .22) + .18;
      s = Math.sin(TWO_PI * f * tt + idx * Math.sin(TWO_PI * f * tt)) * Math.exp(-tt / I.tau)
        + .12 * Math.sin(TWO_PI * 2 * f * tt) * Math.exp(-tt / (I.tau * .4));
    } else {
      for (const [r, amp, tau] of I.parts) {
        if (f * r > NYQ) continue;
        s += amp * Math.sin(TWO_PI * f * r * tt) * Math.exp(-tt / tau);
      }
    }
    const fadeEnd = Math.min(1, (len - i) / (SR * .005));        // no click where the note is cut
    const v = s * env * vel * fadeEnd;
    L[start + i] += v * gl; R[start + i] += v * gr;
  }
}

/* ── room: a small Freeverb so it sounds played, not printed ─────────── */
function reverb(mono, spread) {
  const combs = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617].map(d => ({ b: new Float32Array(d + spread), i: 0, st: 0 }));
  const aps = [556, 441, 341, 225].map(d => ({ b: new Float32Array(d + spread), i: 0 }));
  const out = new Float32Array(mono.length), fb = .8, damp = .32;
  for (let s = 0; s < mono.length; s++) {
    const x = mono[s] * .015; let acc = 0;
    for (const c of combs) { const y = c.b[c.i]; c.st = y * (1 - damp) + c.st * damp; c.b[c.i] = x + c.st * fb; if (++c.i >= c.b.length) c.i = 0; acc += y; }
    for (const p of aps) { const bo = p.b[p.i]; const y = -acc + bo; p.b[p.i] = acc + bo * .5; if (++p.i >= p.b.length) p.i = 0; acc = y; }
    out[s] = acc;
  }
  return out;
}
const mono = new Float32Array(N);
for (let i = 0; i < N; i++) mono[i] = (L[i] + R[i]) / 2;
const wl = reverb(mono, 0), wr = reverb(mono, 23);
const rms = a => Math.sqrt(a.reduce((s, x) => s + x * x, 0) / a.length);
const wet = .42 * rms(mono) / Math.max(1e-9, (rms(wl) + rms(wr)) / 2);
for (let i = 0; i < N; i++) { L[i] += wl[i] * wet; R[i] += wr[i] * wet; }

// Peak to -1 dBFS, and fade the very end so the loop restarts from silence.
let peak = 0; for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
const g = .89 / peak, fade = Math.round(1.2 * SR);
for (let i = 0; i < N; i++) { const k = i > N - fade ? (N - i) / fade : 1; L[i] *= g * k; R[i] *= g * k; }

/* ── write ───────────────────────────────────────────────────────────── */
const wav = Buffer.alloc(44 + N * 4);
wav.write('RIFF', 0); wav.writeUInt32LE(36 + N * 4, 4); wav.write('WAVEfmt ', 8);
wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(2, 22); wav.writeUInt32LE(SR, 24);
wav.writeUInt32LE(SR * 4, 28); wav.writeUInt16LE(4, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) {
  wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i])) * 32767), 44 + i * 4);
  wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i])) * 32767), 46 + i * 4);
}
const tmp = path.join(require('os').tmpdir(), 'happy-birthday-musicbox.wav');
fs.writeFileSync(tmp, wav);
execFileSync('afconvert', ['-f', 'm4af', '-d', 'aac', '-b', '128000', tmp, OUT]);
console.log(`${notes.length} notes, ${lastSec.toFixed(1)}s, rms ${(20 * Math.log10(rms(L.map((x, i) => (x + R[i]) / 2)))).toFixed(1)} dBFS → ${path.relative(process.cwd(), OUT)} (${(fs.statSync(OUT).size / 1024).toFixed(0)} KB)`);
