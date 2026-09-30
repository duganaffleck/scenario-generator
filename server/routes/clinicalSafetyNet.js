// A last check on three rules the prompt states but the faster model sometimes skips. Each one only acts when the
// scenario's own findings meet the rule and the expected treatment misses it, and it fixes the treatment list in
// place with a line written from those findings:
//   1. High-concentration oxygen whatever the SpO2 for diving injuries, CO, cyanide, smoke inhalation, airway burns.
//   2. Hypoglycemia (BGL under 4.0) with an altered level of awareness gets the Hypoglycemia directive, by name.
//   3. A trauma patient who meets Field Trauma Triage step 1 or 2 gets a destination decision.
//   4. Oxytocin is 10 units IM for a PCP. Wherever the scenario gives it an IV route, the route becomes IM.
//   5. Age and weight limits in the PCP directives (server/data/als-standards.txt). A child isn't offered a medication
//      or procedure whose directive starts at an older age or a higher weight: the line says why instead.

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
// A fire, flash or blast with smoke around it, and a patient who is coughing, hoarse or short of breath afterwards,
// is a smoke inhalation until proven otherwise, even with no soot in the mouth.
// An event, not a campfire: a fire pit or fireplace nearby is not smoke exposure on its own.
const FIRE_EVENT = /\b(caught fire|on fire|(house|structure|kitchen|grease|vehicle|car|shop|flash) fire|fire (broke out|in the)|flared( up)?|flash (burn|of flame)|explosion|exploded|blast|ignited|engulfed|burning (building|house|room|car|vehicle|apartment))\b/i;
const SMOKE_AROUND = /\bsmoke\b|fumes|enclosed|indoors|small room|hallway|kitchen|garage|basement|bakery|workshop/i;
const AIRWAY_SYMPTOM = /\bcough\w*|hoarse\w*|raspy|voice (change|is changed|sounds)|wheez\w*|stridor|short(ness)? of breath|difficulty breathing|dyspn\w*/i;
function smokeExposure(story) {
  return FIRE_EVENT.test(story) && SMOKE_AROUND.test(story) && affirmed(AIRWAY_SYMPTOM, story);
}

const HIGH_CONC = /high[- ]concentration|high[- ]flow|non-?rebreather|\bNRB\b|100 ?%|15 ?L/i;
const O2_RESTRAINT = /over-?oxygenat|oxygen (is )?not (routine|indicated|needed)|oxygen without (a clear )?need|oxygen only if|blanket oxygen|not higher than needed/i;

function highConcentrationOxygen(s, notes) {
  const story = text([s.incidentNarrative, s.sample, s.physicalExam, s.callInformation, s.patientDemographics?.chiefComplaint, s.patientPresentation]);
  const hit = O2_TRIGGERS.find((t) => affirmed(t.re, story) && !(t.not && t.not.test(story) && !/scuba|decompression|gas embol/i.test(story)))
    || (smokeExposure(story) ? { why: 'smoke exposure from a fire or flash with cough, hoarseness or breathing symptoms afterwards; carbon monoxide and airway injury are both possible' } : null);
  if (!hit) return;
  const tx = s.expectedTreatment;
  if (HIGH_CONC.test(text(tx))) return;
  const line = `Give high-concentration oxygen by non-rebreather whatever the SpO2 reads (${hit.why}). This is one of the exceptions to oxygen titration, so titrating to 92-96% is not the plan for this patient.`;
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

// Oxytocin's PCP route is IM (Emergency Childbirth directive). "IM or IV", "IM/IV", "10 units IV", "oxytocin IV":
// every string in the scenario that names oxytocin gets IM, and the rest of the sentence is left alone.
const OXY_ROUTE = [
  [/\b(IM\s*(?:or|\/)\s*IV|IV\s*(?:or|\/)\s*IM)\b/g, 'IM'],
  [/\b(oxytocin[^.;\n]{0,40}?\b\d+\s*(?:units?|U|IU))\s+(?:IV|intravenous(?:ly)?)\b/gi, '$1 IM'],
  [/\b(oxytocin)\s+(?:IV|intravenous(?:ly)?)\b/gi, '$1 IM'],
];
function fixOxytocinRoute(value, fixed) {
  if (typeof value === 'string') {
    if (!/oxytocin/i.test(value)) return value;
    const out = value.split(/(?<=[.;\n])/).map((sentence) => {
      // "IV oxytocin is not a PCP route" is already right; only sentences that give it IV are changed.
      if (!/oxytocin/i.test(sentence) || /\b(not|never|no|isn'?t|cannot|can'?t)\b/i.test(sentence)) return sentence;
      return OXY_ROUTE.reduce((t, [re, to]) => t.replace(re, to), sentence);
    }).join('');
    if (out !== value) fixed.count += 1;
    return out;
  }
  if (Array.isArray(value)) return value.map((v) => fixOxytocinRoute(v, fixed));
  if (value && typeof value === 'object') {
    for (const k of Object.keys(value)) value[k] = fixOxytocinRoute(value[k], fixed);
    return value;
  }
  return value;
}

// Age in years and weight in kg from the demographics: "4 months", "3 days", "2 minutes", "Newborn", "7", "26 kg".
const AGE_UNIT_YEARS = { minute: 1 / 525600, min: 1 / 525600, hour: 1 / 8760, hr: 1 / 8760, day: 1 / 365, week: 7 / 365, wk: 7 / 365, month: 1 / 12, mo: 1 / 12, year: 1, yr: 1, y: 1 };
function ageYears(text) {
  const t = String(text ?? '').toLowerCase();
  const m = t.match(/(\d+(?:\.\d+)?)\s*(minutes?|mins?|hours?|hrs?|days?|weeks?|wks?|months?|mo|years?|yrs?|y)?\b/);
  if (m) return Number(m[1]) * (AGE_UNIT_YEARS[(m[2] || 'year').replace(/s$/, '')] ?? 1);
  return /newborn|neonate/.test(t) ? 0 : null;
}
const LIMITS = [
  { re: /\b(tranexamic acid|TXA)\b/i, name: 'Tranexamic acid', minAge: 16, directive: 'Traumatic Hemorrhage' },
  { re: /\b(ketorolac|ibuprofen|acetaminophen)\b/i, name: 'PCP analgesia (acetaminophen, ibuprofen, ketorolac)', minAge: 12, directive: 'Analgesia' },
  { re: /\b(ASA|aspirin)\b/, name: 'ASA', minAge: 18, directive: 'Cardiac Ischemia' },
  { re: /\bnitro(glycerin)?\b/i, name: 'Nitroglycerin', minAge: 18, directive: 'Cardiac Ischemia' },
  { re: /\bCPAP\b/, name: 'CPAP', minAge: 18, directive: 'CPAP' },
  { re: /\bvalsalva\b/i, name: 'Modified Valsalva', minAge: 18, directive: 'Tachydysrhythmia' },
  { re: /\bbuprenorphine\b/i, name: 'Buprenorphine/naloxone', minAge: 16, directive: 'Opioid Toxicity and Withdrawal' },
  { re: /\b(D10W|D50W|dextrose (IV|10|50)|IV dextrose)\b/i, name: 'IV dextrose', minAge: 2, directive: 'Hypoglycemia' },
  { re: /\b(fluid|NaCl|saline) bolus\b|\bbolus of (0\.9% NaCl|normal saline)\b/i, name: 'A fluid bolus', minAge: 2, directive: 'IV and Fluid Therapy' },
  { re: /\b(dimenhydrinate|gravol|ondansetron)\b/i, name: 'An antiemetic (dimenhydrinate, ondansetron)', minKg: 25, directive: 'Nausea / Vomiting' },
  { re: /\bdiphenhydramine\b/i, name: 'Diphenhydramine', minKg: 25, directive: 'Moderate to Severe Allergic Reaction' },
  { re: /\btreat(ment)?[- ]and[- ](discharge|release)\b|\bT&D\b/i, name: 'Treat and discharge', minAge: 18, keep: /\b(adults? only|only (for )?adults?|adults? \(?18)/i,
    why: 'hypoglycemia and seizure treat and discharge are for adults 18 or older only. This child is transported' },
];
function ageAndWeightLimits(scenario, notes) {
  const pd = scenario.patientDemographics || {};
  const age = ageYears(pd.age);
  const kg = Number(String(pd.weight ?? '').match(/(\d+(?:\.\d+)?)\s*kg/i)?.[1] ?? NaN);
  if (age === null && Number.isNaN(kg)) return;
  const under = (l) => (l.minAge && age !== null && age < l.minAge) || (l.minKg && !Number.isNaN(kg) && kg < l.minKg);
  const fixList = (list) => {
    if (!Array.isArray(list)) return list;
    const out = [];
    for (const line of list) {
      const hit = typeof line === 'string' && LIMITS.find((l) => l.re.test(line) && under(l));
      if (!hit) { out.push(line); continue; }
      // A line that already explains the limit ("applies to age 16 and older, so it does not fit") stays.
      const limit = hit.minAge ? `(age|aged)\\s*(of\\s*)?${hit.minAge}|${hit.minAge}\\s*(years|yrs|and older|or older)` : `${hit.minKg}\\s*kg`;
      if ((new RegExp(limit, 'i').test(line) || (hit.keep && hit.keep.test(line))) && !/^\s*(give|administer|consider|start)\b/i.test(line)) { out.push(line); continue; }
      // Anything else that talks about it as an option is replaced with the reason it isn't one.
      const named = hit.name || line.match(hit.re)[0].replace(/^./, (c) => c.toUpperCase());
      const why = hit.why || (hit.minAge ? `the ${hit.directive} directive starts at age ${hit.minAge}` : `the ${hit.directive} directive starts at ${hit.minKg} kg`);
      const text = `${named} is not an option for this patient: ${why}.`;
      if (!out.includes(text)) out.push(text);
      const note = `${named.split(' (')[0].toLowerCase()} held: patient under the directive's age or weight limit`;
      if (!notes.includes(note)) notes.push(note);
    }
    return out;
  };
  scenario.expectedTreatment = fixList(scenario.expectedTreatment);
  scenario.protocolNotes = fixList(scenario.protocolNotes);
}

export function clinicalSafetyNet(scenario, { semester, type } = {}) {
  const notes = [];
  if (!scenario || typeof scenario !== 'object') return notes;
  if (!Array.isArray(scenario.expectedTreatment)) scenario.expectedTreatment = [];
  highConcentrationOxygen(scenario, notes);
  hypoglycemia(scenario, semester, notes);
  fieldTraumaTriage(scenario, type, notes);
  ageAndWeightLimits(scenario, notes);
  const fixed = { count: 0 };
  fixOxytocinRoute(scenario, fixed);
  if (fixed.count) notes.push('oxytocin route IM');
  return notes;
}
