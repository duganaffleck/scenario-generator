// Maps a Scenario Generator scenario (the JSON that /api/generate-scenario returns) to the shape the reviewer uses.
// Everything that knows the generator's field names is in this file, so a schema change is a change here only.
//
// Handles the current generator format (vitalSigns.firstSet / secondSet / additionalSets, expectedTreatment as a
// list of plain-language actions) and the older few-shot format (vitalSigns as one flat object).

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DIR = process.env.ACR_SCENARIO_DIR || path.join(__dirname, '..', 'scenarios');

const str = (v) => (v === undefined || v === null ? '' : Array.isArray(v) ? v.map(str).filter(Boolean).join('; ') : typeof v === 'object' ? Object.values(v).map(str).filter(Boolean).join(', ') : String(v).trim());
const list = (v) => (Array.isArray(v) ? v : v ? [v] : []).map((x) => (x && typeof x === 'object' ? str(x.name || x.item || x.text || x) : str(x))).filter(Boolean);
const NONE = /^(none|nil|nka|nkda|n\/a|no known( drug)? allergies|none known|no allergies|-)\.?$/i;

function vitalSet(raw, label) {
  if (!raw || typeof raw !== 'object') return null;
  const g = (...k) => { for (const x of k) if (raw[x] !== undefined && raw[x] !== null && raw[x] !== '') return String(raw[x]); return ''; };
  const s = {
    label: g('context', 'label') || label,
    hr: g('hr', 'HR', 'pulse'), rr: g('rr', 'RR', 'resp'), bp: g('bp', 'BP'), spo2: g('spo2', 'SpO2', 'spO2'),
    etco2: g('etco2', 'EtCO2'), temp: g('temp', 'Temp'), gcs: g('gcs', 'GCS'), bgl: g('bgl', 'Bgl', 'BGL', 'glucose'),
    pain: g('pain'), ecg: g('ecgInterpretation', 'ecg'),
  };
  return Object.entries(s).some(([k, v]) => k !== 'label' && v) ? s : null;
}

function vitalSets(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v.map((x, i) => vitalSet(x, i === 0 ? 'Initial' : `Set ${i + 1}`)).filter(Boolean);
  if (v.firstSet || v.secondSet || v.additionalSets) {
    return [vitalSet(v.firstSet, 'Initial'), vitalSet(v.secondSet, 'Second'),
      ...(Array.isArray(v.additionalSets) ? v.additionalSets.map((x, i) => vitalSet(x, `Set ${i + 3}`)) : [])].filter(Boolean);
  }
  return [vitalSet(v, 'Initial')].filter(Boolean);
}

// Plain-language treatment -> ACR procedure codes (current Ontario list). Only confident matches.
const TREATMENT_CODES = [
  [/\b(asa|aspirin|acetylsalicylic)\b/i, ['504'], 'ASA'],
  [/\b(nitro(glycerin)?|ntg)\b/i, ['615'], 'Nitroglycerin'],
  [/\b(salbutamol|ventolin)\b/i, ['650'], 'Salbutamol'],
  [/\bglucagon\b/i, ['560'], 'Glucagon'],
  [/\b(oral glucose|glucose gel|insta-?glucose|dextrose gel)\b/i, ['561'], 'Oral glucose'],
  [/\b(d10w?|d50w?|iv dextrose|dextrose (iv|10))\b/i, ['528', '529', '530'], 'Dextrose'],
  [/\b(epinephrine|epi-?pen|adrenaline)\b/i, ['540', '541'], 'Epinephrine'],
  [/\b(diphenhydramine|benadryl)\b/i, ['534'], 'Diphenhydramine'],
  [/\b(dimenhydrinate|gravol)\b/i, ['533'], 'Dimenhydrinate'],
  [/\b(ondansetron|zofran)\b/i, ['728'], 'Ondansetron'],
  [/\b(naloxone|narcan)\b/i, ['610'], 'Naloxone'],
  [/\b(acetaminophen|tylenol)\b/i, ['498'], 'Acetaminophen'],
  [/\b(ibuprofen|advil|motrin)\b/i, ['704'], 'Ibuprofen'],
  [/\bketorolac\b/i, ['706'], 'Ketorolac'],
  [/\b1[25][- ]?lead\b/i, ['313', '313.1'], '12-lead'],
  [/\bcpap\b/i, ['383', '384'], 'CPAP'],
  [/\b(oxygen|o2)\b/i, ['129', '130', '131', '132', '133', '141', '144'], 'Oxygen'],
  [/\b(glucometr|blood glucose|capillary glucose|bgl|glucose (check|level|reading|determination))\b/i, ['25'], 'Glucose check'],
  [/\b(defib|aed|shock(able)? advised|pads? on)\b/i, ['298', '305', '306', '307', '308'], 'Defibrillation'],
  [/\b(cpr|chest compressions)\b/i, ['300', '299'], 'CPR'],
  [/\b(supraglottic|i-?gel|king lt)\b/i, ['318', '319'], 'Supraglottic airway'],
  [/\b(iv (access|cannulation|start|line)|establish (an )?iv|intravenous access)\b/i, ['341', '350'], 'IV'],
  [/\bpelvic binder\b/i, ['110.01'], 'Pelvic binder'],
  [/\btourniquet\b/i, ['102'], 'Tourniquet'],
  [/\b(c-?collar|cervical collar)\b/i, ['111'], 'Cervical collar'],
  [/\btraction splint\b/i, ['114'], 'Traction splint'],
  [/\b(stemi|pci)\b.*\b(notif|pre-?alert|patch)|\b(notif\w*|pre-?alert)\b.*\bstemi\b/i, ['401.4', '401', '400'], 'STEMI notification'],
  [/\bstroke\b.*\b(notif|pre-?alert|patch)|\b(notif\w*|pre-?alert)\b.*\bstroke\b/i, ['401.3', '401', '405.02', '400'], 'Stroke notification'],
];
// Items the student is expected NOT to do, or may or may not do, are not compared.
const SKIP = /\b(do not|don't|withhold|avoid|contraindicated|not indicated|hold off|consider|anticipate|prepare|be ready|if needed|if required|prn)\b/i;

function expectedCodes(items) {
  const out = [];
  for (const item of items) {
    if (SKIP.test(item)) continue;
    for (const [re, codes, label] of TREATMENT_CODES) {
      if (re.test(item) && !out.some((o) => o.label === label)) out.push({ item, codes, label });
    }
  }
  return out;
}

function normalizeScenario(raw) {
  raw = raw && typeof raw === 'object' ? raw : {};
  const demo = raw.patientDemographics || {};
  const call = raw.callInformation || {};
  const sample = raw.sample || {};
  const expectedTreatment = list(raw.expectedTreatment || raw.expectedManagement);
  const allergies = [...list(raw.allergies), ...list(sample.allergies)].filter((a) => !NONE.test(a));
  const medications = list(raw.medications).length ? list(raw.medications) : list(sample.medications);
  const reasoning = raw.clinicalReasoning || {};
  return {
    id: raw.id || '',
    title: str(raw.title) || 'Untitled scenario',
    summary: str(raw.scenarioIntro),
    dispatch: {
      type: str(call.type), location: str(call.location), time: str(call.time), dispatchCode: str(call.dispatchCode),
      notes: str(call.dispatchNotes), hazards: str(call.hazardsOrFlags),
    },
    patient: {
      name: str(demo.name || demo.fullName), age: str(demo.age), sex: str(demo.sex), height: str(demo.height),
      weight: str(demo.weight || demo.weightKg), appearance: str(demo.appearance), chiefComplaint: str(demo.chiefComplaint),
    },
    presentation: str(raw.patientPresentation),
    incidentNarrative: str(raw.incidentNarrative),
    opqrst: raw.opqrst || null,
    sample: {
      signsAndSymptoms: str(sample.signsAndSymptoms), lastOralIntake: str(sample.lastOralIntake), eventsLeadingUp: str(sample.eventsLeadingUp),
    },
    allergies: [...new Set(allergies)],
    medications,
    pastMedicalHistory: list(raw.pastMedicalHistory).length ? list(raw.pastMedicalHistory) : list(sample.pastMedicalHistory),
    physicalExam: raw.physicalExam || {},
    vitalSets: vitalSets(raw.vitalSigns),
    ecg: str(raw.ecgFindings && (raw.ecgFindings.twelveLeadFindings || raw.ecgFindings.rhythmInterpretation)),
    caseProgression: raw.caseProgression || {},
    expectedTreatment,
    expectedCodes: expectedCodes(expectedTreatment),
    protocolNotes: list(raw.protocolNotes),
    learningObjectives: list(raw.learningObjectives),
    teachingPoints: str(raw.teachersPoints),
    clinicalReasoning: str(reasoning.summary || reasoning),
    // Optional, for hand-written sample scenarios: findings the chart should show, with keywords to look for.
    keyFindings: (Array.isArray(raw.acrKeyFindings) ? raw.acrKeyFindings : [])
      .map((f) => ({ finding: str(f.finding), keywords: list(f.keywords) })).filter((f) => f.finding && f.keywords.length),
  };
}

function listScenarios() {
  if (!fs.existsSync(DIR)) return [];
  return fs.readdirSync(DIR).filter((f) => f.endsWith('.json')).map((f) => {
    const s = normalizeScenario(JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')));
    return { id: s.id || f.replace(/\.json$/, ''), title: s.title, summary: s.summary };
  });
}

function loadScenario(id) {
  if (!id) return null;
  if (!/^[\w.-]+$/.test(id)) return null;
  const file = path.join(DIR, id + '.json');
  if (!fs.existsSync(file)) return null;
  const s = normalizeScenario(JSON.parse(fs.readFileSync(file, 'utf8')));
  return { ...s, id: s.id || id };
}

export { normalizeScenario, listScenarios, loadScenario, expectedCodes };
