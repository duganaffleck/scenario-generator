// Reads a generated scenario into what live run needs: each vitals set as numbers, in the order the scenario gives them.
import { normalizeRhythm } from "../ecg/ecgEngine";

export const num = (v) => {
  const m = String(v ?? "").match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
};

// Sets that describe what happens if care goes wrong are branches the instructor can pick, not the next step.
const BRANCH = /^\s*(if|without|when care|had the crew)\b|delay|missed|not (done|given|treated)/i;
const NO_PULSE = /^(ventricular fibrillation|asystole|pulseless)/i;

// When a set has no EtCO2, estimate one from the breathing so the capnography still means something:
// slow breathing retains CO2, fast breathing blows it off, no breathing is a flat line.
function estimateCo2(rr, noPulse) {
  if (rr === null || rr === undefined) return noPulse ? 12 : 38;
  if (rr <= 0) return 0;
  if (rr < 10) return 52;
  if (rr > 28) return 28;
  if (rr > 22) return 32;
  return 38;
}

// Bronchospasm shows as a "shark fin" capnogram. Read the exam for it; the instructor can change it.
// Only the exam counts (a history of teenage asthma is not today's airway), only affirmed findings count
// ("no wheeze, crackles or stridor" must not turn it on), and wet lungs win: the wheeze in pulmonary edema
// is usually the distractor, and a shark fin would back the wrong answer.
const findIn = (text, term) =>
  text.split(/[.;"[\]{}]/).some((sentence) => {
    const m = sentence.match(term);
    if (!m) return false;
    const before = sentence.slice(0, m.index);
    return !/\b(no|not|without|denies|denied|negative for|absent|nil|free of)\b/.test(before) && !/does not dominate|not dominant/.test(sentence);
  });

export function suggestedCo2Shape(scenario) {
  const exam = JSON.stringify((scenario && scenario.physicalExam) || {}).toLowerCase();
  const tight = findIn(exam, /wheez|bronchospasm|prolonged expir|silent chest/);
  const wet = findIn(exam, /crackle|rales|crepitation|frothy|pink sputum/);
  return tight && !wet ? "shark" : "normal";
}

export function vitalSets(scenario) {
  const vs = (scenario && scenario.vitalSigns) || {};
  const raw = [vs.firstSet, vs.secondSet, ...(Array.isArray(vs.additionalSets) ? vs.additionalSets : [])];
  let last = "";
  return raw
    .filter((s) => s && typeof s === "object" && Object.values(s).some((v) => v !== "" && v !== null && v !== undefined))
    .map((s, i) => {
      const rhythm = normalizeRhythm(s.ecgInterpretation || "") || last || "";
      last = rhythm || last;
      const bp = String(s.bp || "");
      const m = bp.match(/(\d{2,3})\s*\/\s*(\d{2,3})/);
      return {
        i,
        label: s.context || (i === 0 ? "On arrival" : `Set ${i + 1}`),
        branch: BRANCH.test(s.context || ""),
        hr: num(s.hr),
        hrText: s.hr || "",
        rr: num(s.rr),
        rrText: s.rr || "",
        bp,
        sys: m ? Number(m[1]) : null,
        dia: m ? Number(m[2]) : null,
        spo2: num(s.spo2),
        etco2: num(s.etco2) ?? estimateCo2(num(s.rr), NO_PULSE.test(rhythm)),
        etco2Estimated: num(s.etco2) === null,
        temp: num(s.temp),
        bgl: num(s.bgl),
        gcs: num(s.gcs),
        rhythm,
        noPulse: NO_PULSE.test(rhythm) || /pulseless|absent|no pulse/i.test(String(s.hr || "")) || num(s.hr) === 0,
      };
    });
}

// Chest compressions on the ECG: a big rolling artifact at about 110 a minute that buries the real rhythm.
// Returns millivolts, like the ECG samples, so the monitor and the printed strip draw it the same way.
export const CPR_RATE = 110;
export function cprArtifact(t) {
  const period = 60000 / CPR_RATE;
  const phase = (((t % period) + period) % period) / period;
  const depth = 0.9 + 0.1 * Math.sin(t / 1700);
  const v = phase < 0.45 ? 1.6 * Math.sin((Math.PI * phase) / 0.45) : -0.35 * Math.sin((Math.PI * (phase - 0.45)) / 0.55);
  return v * depth;
}

export const clock = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

export const progressionNotes = (scenario) => {
  const cp = (scenario && scenario.caseProgression) || {};
  const list = (v) => (Array.isArray(v) ? v : v ? [v] : []).map(String).filter(Boolean);
  return [
    ["With good care", list(cp.withProperTreatment)],
    ["If care is delayed or missing", list(cp.withoutProperTreatment)],
    ["If care is wrong", list(cp.withIncorrectTreatment)],
    ["Moving and transport", list(cp.movementOrTransportChanges)],
  ].filter(([, items]) => items.length);
};
