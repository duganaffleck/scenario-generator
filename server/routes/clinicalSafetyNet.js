// A last check on three rules the prompt states but the faster model sometimes skips. Each one only acts when the
// scenario's own findings meet the rule and the expected treatment misses it, and it fixes the treatment list in
// place with a line written from those findings:
//   1. High-concentration oxygen whatever the SpO2 for diving injuries, CO, cyanide, smoke inhalation, airway burns.
//   2. Hypoglycemia (BGL under 4.0) with an altered level of awareness gets the Hypoglycemia directive, by name.
//   3. A trauma patient who meets Field Trauma Triage step 1 or 2 gets a destination decision.

const text = (v) => {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return v.map(text).join(' ');
  if (typeof v === 'object') return Object.values(v).map(text).join(' ');
  return String(v);
};
const num = (v) => { const m = String(v ?? '').match(/-?\d+(\.\d+)?/); return m ? Number(m[0]) : null; };

// A finding counts only when it is stated, not ruled out: "no chest wall instability" is not a flail chest.
const NEGATION = /\b(no|not|without|denies|denied|negative for|absent|rather than|rules? out|ruled out|unlikely)\b[^.;]*$/i;
function affirmed(re, str) {
  const flags = re.flags.includes('g') ? re.flags : `${re.flags}g`;
  return String(str).split(/[.;\n]/).some((sentence) => {
    const g = new RegExp(re.source, flags);
    let m;
    while ((m = g.exec(sentence))) {
      if (!NEGATION.test(sentence.slice(Math.max(0, m.index - 80), m.index))) return true;
      if (m[0] === '') g.lastIndex += 1;
    }
    return false;
  });
}

// Sets that describe what happens if care goes wrong are teaching branches, not the patient in front of the crew.
const HYPOTHETICAL = /^\s*(if|without|when care|had the crew)\b|delay|missed|not (done|given|treated)/i;
function realSets(vs = {}) {
  return [vs.firstSet, vs.secondSet, ...(Array.isArray(vs.additionalSets) ? vs.additionalSets : [])]
    .filter((s) => s && typeof s === 'object' && !HYPOTHETICAL.test(String(s.context || '')));
}

function firstName(scenario) {
  const name = String(scenario?.patientDemographics?.name || '').trim().split(/\s+/)[0];
  return name && !/unknown|patient/i.test(name) ? name : 'the patient';
}

// Put a line after the last line that matches `after`, or before the transport line, or at the end.
function insertLine(list, line, after) {
  let i = -1;
  if (after) list.forEach((t, k) => { if (after.test(t)) i = k; });
  if (i === -1) {
    const transport = list.findIndex((t) => /^\s*(package|transport|prepare for (timely )?transport)/i.test(t));
    i = transport === -1 ? list.length - 1 : transport - 1;
  }
  list.splice(i + 1, 0, line);
}

// ---------------------------------------------------------------------------------------------------------------
// 1. High-concentration oxygen
const O2_TRIGGERS = [
  { re: /\bscuba\b|\b(dive|diving) (trip|boat|charter|computer|buddy)|after (a |the |her |his )?dive\b|\bdiv(e|ed|ing)\b[^.]{0,80}\b(deep|depth|charter|tank|ascent)|decompression (illness|sickness)|\bthe bends\b|gas embol/i,
    not: /\b(dove|dived|diving|dive) (head ?first )?into|shallow (end|water)|diving board/i,
    why: 'suspected decompression illness or arterial gas embolism after a dive' },
  { re: /carbon monoxide|\bCO (poisoning|exposure|alarm|detector)|\bcyanide\b/i,
    why: 'suspected carbon monoxide or cyanide exposure, where the SpO2 can read normal and still be wrong' },
  { re: /smoke inhal|inhaled (smoke|fumes|gas)|noxious (gas|fumes)|toxic (gas|fumes)|chlorine|ammonia (gas|fumes)/i,
    why: 'inhalation of smoke or a noxious gas' },
  { re: /airway burn|singed (nasal|nose|facial|eyebrow)|soot (in|around|inside) (the |his |her |their )?(mouth|nose|nares|airway|sputum)|carbonaceous sputum|stridor[^.]{0,60}burn/i,
    why: 'signs of an upper airway burn' },
];
const HIGH_CONC = /high[- ]concentration|high[- ]flow|non-?rebreather|\bNRB\b|100 ?%|15 ?L/i;
const O2_RESTRAINT = /over-?oxygenat|oxygen (is )?not (routine|indicated|needed)|oxygen without (a clear )?need|oxygen only if|blanket oxygen|not higher than needed/i;

function highConcentrationOxygen(s, notes) {
  const story = text([s.incidentNarrative, s.sample, s.physicalExam, s.callInformation, s.patientDemographics?.chiefComplaint, s.patientPresentation]);
  const hit = O2_TRIGGERS.find((t) => affirmed(t.re, story) && !(t.not && t.not.test(story) && !/scuba|decompression|gas embol/i.test(story)));
  if (!hit) return;
  const tx = s.expectedTreatment;
  if (HIGH_CONC.test(text(tx))) return;
  const line = `Give high-concentration oxygen by non-rebreather whatever the SpO2 reads: ${hit.why} is one of the exceptions to oxygen titration. Titrating to 92-96% is not the plan for this patient.`;
  const o2 = tx.findIndex((t) => /\boxygen\b|\bO2\b|nasal cannula|SpO2 (of )?9\d/i.test(t));
  if (o2 !== -1) tx[o2] = line;
  else insertLine(tx, line, /primary (survey|assessment)|scene safety/i);
  // Oxygen-restraint teaching elsewhere in the case now contradicts the treatment, so it goes.
  if (Array.isArray(s.protocolNotes)) s.protocolNotes = s.protocolNotes.filter((t) => !O2_RESTRAINT.test(t));
  const cp = s.caseProgression || {};
  ['withProperTreatment', 'withoutProperTreatment', 'withIncorrectTreatment'].forEach((k) => {
    if (Array.isArray(cp[k])) cp[k] = cp[k].filter((t) => !O2_RESTRAINT.test(t));
  });
  notes.push('high-concentration oxygen');
}

// ---------------------------------------------------------------------------------------------------------------
// 2. Hypoglycemia with an altered level of awareness
function hypoglycemia(s, semester, notes) {
  const low = realSets(s.vitalSigns).find((v) => num(v.bgl) != null && num(v.bgl) < 4 && num(v.gcs) != null && num(v.gcs) < 15);
  if (!low) return;
  const tx = s.expectedTreatment;
  if (/glucagon|dextrose|D10W|D50W/i.test(text(tx))) return;
  const bgl = num(low.bgl), gcs = num(low.gcs);
  let line;
  if (String(semester) === '2') {
    line = `Recognize hypoglycemia with an altered level of awareness (BGL ${bgl}, GCS ${gcs}) and consider glucagon or dextrose by name under the Hypoglycemia directive. Oral glucose is only for a patient who is alert and able to swallow safely.`;
  } else {
    const kg = num(s.patientDemographics?.weight);
    const glucagon = kg != null && kg < 25 ? 'glucagon 0.5 mg IM' : 'glucagon 1 mg IM';
    line = `Treat hypoglycemia with an altered level of awareness (BGL ${bgl}, GCS ${gcs}) under the Hypoglycemia directive: ${glucagon}, repeat in 20 minutes if needed (max 2 doses), or dextrose IV if authorized for the IV and Fluid Therapy auxiliary directive and a line is in place (D10W 0.2 g/kg, max 25 g per dose). Oral glucose is only for a patient who is alert and able to swallow safely. Recheck the BGL after each treatment.`;
  }
  const glucoseLine = tx.findIndex((t) => /\b(oral glucose|low glucose|low sugar|treat the (low )?glucose|glucose gel)\b/i.test(t) && !/check|obtain|measure/i.test(t));
  if (glucoseLine !== -1) tx[glucoseLine] = line;
  else insertLine(tx, line, /\bBGL\b|glucose/i);
  notes.push('hypoglycemia directive');
}

// ---------------------------------------------------------------------------------------------------------------
// 3. Field Trauma Triage destination
const ANATOMIC = [
  [/flail|paradoxical (chest|movement|motion)|chest wall (instability|unstable)|segment that moves opposite/i, 'chest wall instability (flail segment)'],
  [/\b(stab(bed| wound)|gunshot|penetrating|impaled)\b/i, 'a penetrating injury'],
  [/amputat/i, 'an amputation'],
  [/pelvic fracture|unstable pelvis|pelvis (is )?unstable/i, 'a suspected pelvic fracture'],
  [/open skull|depressed skull/i, 'an open or depressed skull fracture'],
  [/paralys|paraplegi|quadriplegi|no movement (in|of) (both|the) (legs|lower)/i, 'paralysis'],
  [/degloved|mangled|crush(ed)? (injury to|the) (arm|leg|hand|foot|limb)/i, 'a crushed, degloved or mangled extremity'],
];

function fieldTraumaTriage(s, type, notes) {
  const isTrauma = /trauma/i.test(String(type || '')) || /trauma/i.test(String(s.callInformation?.type || ''));
  if (!isTrauma) return;
  const tx = s.expectedTreatment;
  if (/field trauma triage|lead trauma|trauma (centre|center|hospital)|trauma destination/i.test(text(tx))) return;
  const reasons = [];
  realSets(s.vitalSigns).forEach((v) => {
    const g = num(v.gcs), rr = num(v.rr), sbp = num(String(v.bp || '').split('/')[0]);
    if (g != null && g <= 13 && !reasons.some((r) => r.startsWith('GCS'))) reasons.push(`GCS ${g}`);
    if (sbp != null && sbp < 90 && !reasons.some((r) => r.startsWith('SBP'))) reasons.push(`SBP ${sbp}`);
    if (rr != null && (rr < 10 || rr > 29) && !reasons.some((r) => r.startsWith('RR'))) reasons.push(`RR ${rr}`);
  });
  const exam = text([s.physicalExam, s.incidentNarrative]);
  const anat = ANATOMIC.filter(([re]) => affirmed(re, exam)).map(([, label]) => label);
  if (!reasons.length && !anat.length) return;
  const parts = [];
  if (reasons.length) parts.push(`step 1 (${reasons.join(', ')})`);
  if (anat.length) parts.push(`step 2 (${anat.join(', ')})`);
  const who = firstName(s);
  const line = `Apply the Field Trauma Triage Standard: ${who === 'the patient' ? 'the patient meets' : `${who} meets`} ${parts.join(' and ')}. Transport to the lead trauma hospital if it is within 30 minutes by land; otherwise go to the closest appropriate emergency department and patch the Base Hospital or consider air ambulance. Name the triage step in the handoff.`;
  insertLine(tx, line);
  notes.push('field trauma triage');
}

export function clinicalSafetyNet(scenario, { semester, type } = {}) {
  const notes = [];
  if (!scenario || typeof scenario !== 'object') return notes;
  if (!Array.isArray(scenario.expectedTreatment)) scenario.expectedTreatment = [];
  highConcentrationOxygen(scenario, notes);
  hypoglycemia(scenario, semester, notes);
  fieldTraumaTriage(scenario, type, notes);
  return notes;
}
