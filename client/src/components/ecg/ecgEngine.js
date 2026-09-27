// ECG engine: builds rhythm strips and 12/15-lead tracings as one continuous signal.
//
// Every wave (P, Q, R, S, ST, T, flutter, fibrillation) is a smooth shape added onto one timeline, then the
// timeline is sampled left to right. Nothing is drawn by joining hand-placed points, so a P wave that lands
// on a QRS or a T wave simply adds to it, the way it does on a real tracing, and the line never doubles back.
//
// Timing comes from the rhythm (the patient's ECG label). Shape comes from the lead: a 12-lead pattern's
// values for that lead, or a plain lead II when there is no pattern. Drawn to true scale: 25 mm/s, 10 mm/mV.
//
// Units: time in ms, amplitude in mV.

import { _TL_PATTERNS } from "./ecgPatterns";

export const MM_PER_SEC = 25;
export const MM_PER_MV = 10;

// ── Rhythm names ────────────────────────────────────────────────────────────
export const RHYTHMS = [
  "Normal Sinus Rhythm", "Sinus Bradycardia", "Sinus Tachycardia", "Sinus Rhythm with PVCs",
  "Atrial Fibrillation", "Atrial Flutter", "SVT", "Junctional Rhythm",
  "Ventricular Tachycardia", "Ventricular Fibrillation", "Asystole", "Pulseless Electrical Activity",
  "Idioventricular Rhythm", "Paced Rhythm",
  "First Degree AV Block", "Second Degree AV Block Type I", "Second Degree AV Block Type II", "Third Degree AV Block",
];

export function normalizeRhythm(label) {
  const r = String(label || "").toLowerCase().replace(/[\s_-]+/g, " ").trim();
  if (!r) return "";
  if (r.includes("pvc") || r.includes("premature ventricular")) return "Sinus Rhythm with PVCs";
  if (r.includes("ventricular tach") || r === "vtach" || r === "v tach") return "Ventricular Tachycardia";
  if (r.includes("ventricular fib") || r === "vfib" || r === "v fib") return "Ventricular Fibrillation";
  if (r.includes("idioventricular")) return "Idioventricular Rhythm";
  if (r.includes("paced") || r.includes("pacemaker")) return "Paced Rhythm";
  if (r.includes("junctional")) return "Junctional Rhythm";
  if (r.includes("atrial fib") || r === "afib" || r === "a fib") return "Atrial Fibrillation";
  if (r.includes("flutter")) return "Atrial Flutter";
  if (r.includes("pulseless electrical") || r === "pea") return "Pulseless Electrical Activity";
  if (r.includes("asystole") || r === "flatline") return "Asystole";
  if (r.includes("third degree") || r.includes("complete heart block") || r.includes("3rd degree")) return "Third Degree AV Block";
  if (r.includes("second degree") && (r.includes("type ii") || r.includes("mobitz ii") || r.includes("mobitz 2"))) return "Second Degree AV Block Type II";
  if (r.includes("second degree") || r.includes("wenckebach") || r.includes("mobitz i") || r.includes("mobitz 1")) return "Second Degree AV Block Type I";
  if (r.includes("first degree") || r.includes("1st degree")) return "First Degree AV Block";
  if (r.includes("supraventricular") || r === "svt") return "SVT";
  if (r.includes("sinus tach")) return "Sinus Tachycardia";
  if (r.includes("sinus brad")) return "Sinus Bradycardia";
  if (r.includes("normal sinus") || r.includes("nsr") || r === "sinus rhythm") return "Normal Sinus Rhythm";
  return "";
}

// Rhythm-only 12-lead patterns imply a rhythm when the patient's label doesn't give one.
const PATTERN_RHYTHM = {
  afib12: "Atrial Fibrillation", atrialFlutter12: "Atrial Flutter", svt12: "SVT", vtach12: "Ventricular Tachycardia",
  firstDegreeAVBlock: "First Degree AV Block", secondDegreeTypeI: "Second Degree AV Block Type I",
  secondDegreeTypeII: "Second Degree AV Block Type II", thirdDegreeAVBlock: "Third Degree AV Block",
};
export const isRhythmOnlyPattern = (key) => Boolean(PATTERN_RHYTHM[key]);
export const rhythmForPattern = (key) => PATTERN_RHYTHM[key] || "";

// ── Small maths ─────────────────────────────────────────────────────────────
const gauss = (t, mu, sd) => Math.exp(-0.5 * ((t - mu) / sd) ** 2);
const plateau = (t, a, b, edge) => 0.5 * (Math.tanh((t - a) / edge) - Math.tanh((t - b) / edge));
// Asymmetric bump: slower rise, quicker fall, like a T wave.
const skewBump = (t, mu, sdL, sdR) => (t < mu ? gauss(t, mu, sdL) : gauss(t, mu, sdR));
function seeded(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}
const hashStr = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i += 1) h = Math.imul(h ^ str.charCodeAt(i), 16777619); return h >>> 0; };

// ── Lead shapes ─────────────────────────────────────────────────────────────
const LEAD_II = { pr: 160, pA: 0.15, rA: 1.0, qD: 0.06, sD: 0.14, tA: 0.30, st: 0 };

// Ventricular-origin beats (PVCs, idioventricular, wide escape) per lead: sign of the main deflection.
const WIDE_SIGN = { I: 1, II: 1, III: 1, aVR: -1, aVL: -1, aVF: 1, V1: -1, V2: -1, V3: -1, V4: 1, V5: 1, V6: 1, V4R: -1, V8: 1, V9: 1 };
// Right ventricular paced beats: LBBB-like with a superior axis.
const PACED_SIGN = { I: 1, II: -1, III: -1, aVR: 1, aVL: 1, aVF: -1, V1: -1, V2: -1, V3: -1, V4: -1, V5: -1, V6: 1, V4R: -1, V8: 1, V9: 1 };

// Flutter and fibrillation amplitude by lead (inferior leads show the sawtooth best, V1 the fib waves).
const FLUTTER_AMP = { I: 0.07, II: 0.32, III: 0.32, aVR: -0.16, aVL: -0.06, aVF: 0.32, V1: 0.14, V2: 0.10, V3: 0.08, V4: 0.07, V5: 0.06, V6: 0.05, V4R: 0.1, V8: 0.05, V9: 0.05 };
const FIB_AMP = { I: 0.04, II: 0.06, III: 0.06, aVR: 0.04, aVL: 0.03, aVF: 0.06, V1: 0.10, V2: 0.08, V3: 0.06, V4: 0.05, V5: 0.04, V6: 0.04, V4R: 0.06, V8: 0.03, V9: 0.03 };

export function leadShape(patternKey, lead) {
  const p = _TL_PATTERNS[patternKey];
  if (p && p.leads && p.leads[lead]) return { ...p.leads[lead], rbbb: Boolean(p.rbbb), vtach: Boolean(p.vtach) };
  const normal = _TL_PATTERNS.normal && _TL_PATTERNS.normal.leads[lead];
  return normal ? { ...normal } : { ...LEAD_II };
}

// ── Beats ───────────────────────────────────────────────────────────────────
function qtFor(rr, wide) {
  const qt = 400 * Math.sqrt(Math.max(300, rr) / 1000);
  return Math.min(470, Math.max(270, qt)) + (wide ? 50 : 0);
}

// A conducted (supraventricular) beat for this lead, QRS onset at t0.
function conductedBeat(t, t0, m, rr, gain) {
  const sgn = m.flip ? -1 : 1;
  const f = m.wide ? 1.75 : 1;
  let v = 0;
  if (m.rbbb && m.rsrPattern) {
    // rSR' in V1-V2
    v += (m.rA || 0.35) * gauss(t, t0 + 20, 7);
    v -= (m.sA || 0.7) * gauss(t, t0 + 42, 8);
    v += (m.rPrime || 0.9) * gauss(t, t0 + 78, 11);
  } else if (m.rbbb) {
    // Lateral leads: tall R then a broad, slurred S
    v -= 0.05 * gauss(t, t0 + 8, 4);
    v += (m.rA || 1) * gauss(t, t0 + 24, 8);
    v -= (m.sLate || 0.3) * gauss(t, t0 + 82, 18);
  } else if (m.notch) {
    // Broad notched R (LBBB lateral leads)
    v += (m.rA || 1) * 0.82 * gauss(t, t0 + 30 * f, 9 * f);
    v += (m.rA || 1) * gauss(t, t0 + 58 * f, 10 * f);
    v -= (m.sD || 0) * gauss(t, t0 + 90 * f, 8 * f);
  } else {
    v -= (m.qD || 0) * gauss(t, t0 + 9 * f, 4.5 * f);
    v += (m.rA || 0) * gauss(t, t0 + 24 * f, 7.5 * f);
    v -= (m.sD || 0) * gauss(t, t0 + 42 * f, 8 * f);
  }
  const qrsEnd = t0 + (m.rbbb ? 125 : m.wide ? 135 : 70);
  const qt = qtFor(rr, m.wide || m.rbbb);
  const tPeak = t0 + qt - 70;
  // ST: flat, or downsloping into the T wave
  const st = m.st || 0;
  if (st) {
    const shape = m.stSlope === "down" ? (1 - 0.45 * Math.min(1, Math.max(0, (t - qrsEnd) / (tPeak - qrsEnd)))) : 1;
    v += st * shape * plateau(t, qrsEnd - 6, tPeak - 10, 9);
  }
  // T wave (a T is broader on the way up than on the way down)
  const tA = m.tA === undefined ? 0.3 : m.tA;
  const peaked = Math.abs(tA) > 0.45;
  v += tA * skewBump(t, tPeak, peaked ? 26 : 48, peaked ? 20 : 30);
  return sgn * v * gain;
}

// A wide ventricular-origin beat (PVC, VT, idioventricular, wide escape). sign/amp per lead.
function wideBeat(t, t0, sign, amp, rr) {
  const qt = qtFor(rr, true);
  let v = 0;
  v += amp * 0.25 * gauss(t, t0 + 20, 14);
  v += amp * gauss(t, t0 + 62, 24);
  v -= amp * 0.35 * gauss(t, t0 + 120, 18);
  // Discordant ST-T: opposite to the main deflection
  v -= amp * 0.12 * plateau(t, t0 + 150, t0 + qt - 110, 14);
  v -= amp * 0.38 * skewBump(t, t0 + qt - 80, 55, 38);
  return sign * v;
}

function pacedBeat(t, t0, sign, rr) {
  // Pacer spike, then a wide LBBB-like complex with discordant T
  let v = 1.1 * gauss(t, t0 - 2, 1.2);
  v += sign * 0.95 * gauss(t, t0 + 55, 26);
  v -= sign * 0.18 * gauss(t, t0 + 120, 20);
  v -= sign * 0.32 * skewBump(t, t0 + qtFor(rr, true) - 80, 55, 38);
  return v;
}

function pWave(t, tp, amp, sign) {
  // P onset at tp; peak about 45 ms later; roughly 100 ms wide
  return sign * amp * gauss(t, tp + 45, 20);
}

// ── Rhythm timing ───────────────────────────────────────────────────────────
// Returns atrial events (P waves), ventricular events (QRS onsets with a kind) and an atrial baseline.
// Events start before 0 so the first beat on the page isn't a clean start.
export function rhythmEvents(rhythm, hr, totalMs, seed = 1) {
  const rand = seeded(seed);
  const rate = Math.max(15, Math.min(250, Number(hr) || 75));
  const rr = 60000 / rate;
  const A = []; // { t (P onset), sign }
  const V = []; // { t (QRS onset), kind: 'conducted' | 'wide' | 'paced' | 'junctional' }
  let base = null;
  const from = -1600, to = totalMs + 400;
  const sinus = (pr, every = null, pvc = false) => {
    let i = 0;
    for (let a = from + rand() * rr; a < to; a += rr, i += 1) {
      if (pvc && i % 5 === 3) {
        // PVC arrives early; the sinus P still fires on time and is buried; the next sinus beat is on schedule
        A.push({ t: a, sign: 1 });
        V.push({ t: a + pr - rr * 0.4, kind: "wide" });
        continue;
      }
      A.push({ t: a, sign: 1 });
      if (!every || every(i)) V.push({ t: a + pr, kind: "conducted" });
    }
  };
  switch (rhythm) {
    case "First Degree AV Block": sinus(280); break;
    case "Sinus Rhythm with PVCs": sinus(160, null, true); break;
    case "Second Degree AV Block Type I": {
      // 4:3 Wenckebach: PR lengthens, then a P isn't conducted. Ventricular rate is the pulse.
      const arr = rr * 3 / 4;
      const prs = [170, 260, 320, null];
      let i = 0;
      for (let a = from; a < to; a += arr, i += 1) {
        A.push({ t: a, sign: 1 });
        const pr = prs[i % 4];
        if (pr) V.push({ t: a + pr, kind: "conducted" });
      }
      break;
    }
    case "Second Degree AV Block Type II": {
      // 3:2, constant PR, then a dropped beat
      const arr = Math.max(400, rr * 2 / 3);
      let i = 0;
      for (let a = from; a < to; a += arr, i += 1) {
        A.push({ t: a, sign: 1 });
        if (i % 3 !== 2) V.push({ t: a + 190, kind: "conducted" });
      }
      break;
    }
    case "Third Degree AV Block": {
      // Atria and ventricles on their own clocks
      const arr = 60000 / 82;
      for (let a = from + rand() * arr; a < to; a += arr) A.push({ t: a, sign: 1 });
      const kind = rate < 42 ? "wide" : "junctional";
      for (let v = from + 300 + rand() * rr; v < to; v += rr) V.push({ t: v, kind });
      break;
    }
    case "Junctional Rhythm":
      for (let v = from + rand() * rr; v < to; v += rr) { A.push({ t: v - 70, sign: -0.6 }); V.push({ t: v, kind: "junctional" }); }
      break;
    case "SVT":
      for (let v = from + rand() * rr; v < to; v += rr) V.push({ t: v, kind: "junctional" });
      break;
    case "Idioventricular Rhythm":
      for (let v = from + rand() * rr; v < to; v += rr) V.push({ t: v, kind: "wide" });
      break;
    case "Paced Rhythm":
      for (let v = from + rand() * rr; v < to; v += rr) V.push({ t: v, kind: "paced" });
      break;
    case "Ventricular Tachycardia": {
      for (let v = from + rand() * rr; v < to; v += rr) V.push({ t: v, kind: "vt" });
      // AV dissociation: sinus P waves march through at their own rate
      const arr = 60000 / 78;
      for (let a = from + rand() * arr; a < to; a += arr) A.push({ t: a, sign: 0.8 });
      break;
    }
    case "Atrial Fibrillation": {
      base = "fib";
      let v = from + rand() * rr;
      while (v < to) {
        V.push({ t: v, kind: "junctional" });
        v += rr * (0.62 + rand() * 0.76);
      }
      break;
    }
    case "Atrial Flutter": {
      base = "flutter";
      const ratio = Math.max(2, Math.min(4, Math.round(300 / rate)));
      for (let v = from; v < to; v += 200 * ratio) V.push({ t: v + 120, kind: "junctional" });
      break;
    }
    case "Ventricular Fibrillation": base = "vf"; break;
    case "Asystole": base = "flat"; break;
    case "Pulseless Electrical Activity": sinus(180); V.forEach((e) => { e.kind = "pea"; }); break;
    default: sinus(160); // sinus rhythms
  }
  return { A, V, base, rr };
}

// ── Signal for one lead ─────────────────────────────────────────────────────
function leadValue(t, lead, shape, ev, seed) {
  const { A, V, base, rr } = ev;
  let v = 0;
  const pAmp = shape.pA === undefined ? 0.15 : shape.pA;
  const pSign = shape.pFlip ? -1 : 1;
  const hasP = base === null;
  if (hasP) {
    for (const a of A) if (t > a.t - 60 && t < a.t + 160) v += pWave(t, a.t, pAmp, pSign * a.sign);
  }
  for (const e of V) {
    if (t < e.t - 40 || t > e.t + 700) continue;
    if (e.kind === "conducted") {
      v += conductedBeat(t, e.t, { ...shape }, rr, 1);
    } else if (e.kind === "junctional") {
      v += conductedBeat(t, e.t, { ...shape }, rr, 1);
    } else if (e.kind === "pea") {
      v += conductedBeat(t, e.t, { ...shape, wide: true }, rr, 0.55);
    } else if (e.kind === "wide") {
      v += wideBeat(t, e.t, WIDE_SIGN[lead] || 1, 1.05, rr);
    } else if (e.kind === "vt") {
      const amp = shape.vtach ? (shape.rA || 1) * 1.1 : 1.15;
      const sign = shape.vtach ? (shape.flip ? -1 : 1) : (WIDE_SIGN[lead] || 1);
      v += wideBeat(t, e.t, sign, amp, Math.max(rr, 380));
    } else if (e.kind === "paced") {
      v += pacedBeat(t, e.t, PACED_SIGN[lead] || 1, rr);
    }
  }
  if (base === "flutter") {
    const amp = FLUTTER_AMP[lead] === undefined ? 0.2 : FLUTTER_AMP[lead];
    const ph = ((t % 200) + 200) % 200 / 200;
    // Negative sawtooth: slow drift down, quick return
    v += -amp * (ph < 0.72 ? (ph / 0.72) - 0.5 : 0.5 - (ph - 0.72) / 0.28);
  } else if (base === "fib") {
    const amp = FIB_AMP[lead] === undefined ? 0.05 : FIB_AMP[lead];
    const r = seeded(seed + 11);
    const f1 = 5.2 + r() * 1.5, f2 = 6.8 + r() * 1.5, f3 = 8.4 + r() * 1.2;
    v += amp * (Math.sin(2 * Math.PI * f1 * t / 1000 + r() * 6) * 0.6 + Math.sin(2 * Math.PI * f2 * t / 1000 + r() * 6) * 0.3 + Math.sin(2 * Math.PI * f3 * t / 1000 + r() * 6) * 0.25);
  } else if (base === "vf") {
    const r = seeded(seed + 23);
    const env = 0.55 + 0.35 * Math.sin(2 * Math.PI * 0.35 * t / 1000 + r() * 6);
    v += env * (Math.sin(2 * Math.PI * 4.6 * t / 1000) * 0.55 + Math.sin(2 * Math.PI * 6.3 * t / 1000 + 1.3) * 0.35 + Math.sin(2 * Math.PI * 3.1 * t / 1000 + 2.1) * 0.25);
  }
  // A little baseline wander keeps it from looking computer-drawn
  v += 0.015 * Math.sin(2 * Math.PI * 0.28 * t / 1000 + (seed % 7));
  return v;
}

// Samples a lead from startMs for durationMs. Extra samples around pacer spikes keep them sharp.
export function sampleLead({ rhythm, hr, lead = "II", patternKey = "", startMs = 0, durationMs = 6000, step = 3, events = null, seed = 7 }) {
  const shape = leadShape(patternKey, lead);
  const ev = events || rhythmEvents(rhythm, hr, startMs + durationMs, seed);
  const leadSeed = seed + hashStr(lead);
  const times = [];
  for (let t = 0; t <= durationMs; t += step) times.push(t);
  ev.V.filter((e) => e.kind === "paced").forEach((e) => {
    const local = e.t - startMs;
    if (local > 2 && local < durationMs - 2) for (let d = -4; d <= 3; d += 1) times.push(local + d);
  });
  times.sort((a, b) => a - b);
  return times.map((t) => [t, leadValue(t + startMs, lead, shape, ev, leadSeed)]);
}

// ── Drawing ─────────────────────────────────────────────────────────────────
// geom: { pxPerMm, baselineMm, heightMm }. Values are clipped to the box, like a paper edge.
export function toPath(samples, geom) {
  const { pxPerMm, baselineMm, heightMm } = geom;
  const pxPerMs = (pxPerMm * MM_PER_SEC) / 1000;
  const maxY = heightMm * pxPerMm;
  return samples.map(([t, mv], i) => {
    const x = t * pxPerMs;
    const y = Math.min(maxY - 0.5, Math.max(0.5, (baselineMm - mv * MM_PER_MV) * pxPerMm));
    return (i === 0 ? "M" : "L") + x.toFixed(1) + " " + y.toFixed(1);
  }).join(" ");
}

// Grid lines every 1 mm, heavier every 5 mm (one small box = 40 ms by 0.1 mV).
export function gridLines(widthMm, heightMm, pxPerMm) {
  const minor = [], major = [];
  for (let x = 0; x <= widthMm + 0.01; x += 1) (Math.round(x) % 5 === 0 ? major : minor).push(["v", x * pxPerMm]);
  for (let y = 0; y <= heightMm + 0.01; y += 1) (Math.round(y) % 5 === 0 ? major : minor).push(["h", y * pxPerMm]);
  return { minor, major };
}
