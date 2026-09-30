// Reads a generated scenario into what live run needs: each vitals set as numbers, in the order the scenario gives them.
import { normalizeRhythm } from "../ecg/ecgEngine";

export const num = (v) => {
  const m = String(v ?? "").match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
};

// Sets that describe what happens if care goes wrong are branches the instructor can pick, not the next step.
const BRANCH = /^\s*(if|without|when care|had the crew)\b|delay|missed|not (done|given|treated)/i;
const NO_PULSE = /^(ventricular fibrillation|asystole|pulseless)/i;

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
        etco2: num(s.etco2),
        temp: num(s.temp),
        bgl: num(s.bgl),
        gcs: num(s.gcs),
        rhythm,
        noPulse: NO_PULSE.test(rhythm) || /pulseless|absent|no pulse/i.test(String(s.hr || "")) || num(s.hr) === 0,
      };
    });
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
