// Rule-based comparison of the chart against the scenario. Produces "possible mismatches":
// things the scenario had that the chart doesn't seem to show. They go to the reviewer as leads to check,
// and to the student as questions, never as accusations. Live runs drift from the script, so this stays conservative:
// expected treatments with a confident ACR code, allergies, home medications, first vitals, and (for hand-written
// sample scenarios) key findings with keywords.

function norm(code) { return String(code || '').replace(/\s/g, '').replace(/^0+(?=\d)/, ''); }

function chartText(chart) {
  const parts = [chart.chiefComplaint, chart.incidentHistory, chart.remarks,
    chart.pastHistory.details, chart.medications.details, chart.allergies.details, chart.treatmentPriorToArrival.details,
    chart.physicalExam.generalAppearance, chart.physicalExam.skinColour, chart.physicalExam.skinCondition,
    ...['headNeck', 'chest', 'abdomen', 'backPelvis', 'extremities'].map((k) => `${chart.physicalExam[k].details} ${chart.physicalExam[k].ticked.join(' ')}`),
    chart.medications.ticked.join(' '), chart.allergies.ticked.join(' '), chart.treatmentPriorToArrival.ticked.join(' '),
    ...chart.treatmentGrid.map((r) => `${r.procedure_line || ''} ${r.result_line || ''}`)];
  return parts.filter(Boolean).join(' \n ').toLowerCase();
}

function firstVitals(chart) {
  return chart.treatmentGrid.find((r) => r.Pulse || r.BP || r.SpO2) || null;
}

// The words worth looking for in a drug or allergy entry: "Tiotropium (Spiriva) daily" -> ["tiotropium", "spiriva"].
const FILLER = new Set(['daily', 'twice', 'tablet', 'tablets', 'puffer', 'inhaler', 'spray', 'patch', 'with', 'meals', 'every', 'morning',
  'night', 'bedtime', 'last', 'dose', 'none', 'today', 'taken', 'reaction', 'rash', 'hives', 'allergy', 'allergic', 'drugs', 'drug', 'unknown']);
function names(entry) {
  return String(entry).toLowerCase().replace(/\d+(\.\d+)?\s*(mg|mcg|g|ml|units?|%)/g, ' ').split(/[^a-z]+/)
    .filter((w) => w.length >= 4 && !FILLER.has(w)).slice(0, 3)
    .map((w) => w.slice(0, 5)); // charts abbreviate: "nitro" for nitroglycerin, "salbu" for salbutamol
}

function compareToScenario(chart, scenario) {
  if (!scenario) return [];
  const out = [];
  const text = chartText(chart);
  const codes = new Set(chart.treatmentGrid.map((r) => norm(r.code)));

  for (const m of scenario.expectedCodes || []) {
    if (!m.codes.some((c) => codes.has(norm(c)))) {
      out.push({ kind: 'expected_treatment', scenario: m.item,
        question: `The scenario expected this: ${m.item}. I can't find ${m.label} in your treatment grid. Did you do it and not chart it, or decide against it? Either way, the chart should say.` });
    }
  }

  const allergyText = `${chart.allergies.details} ${chart.allergies.ticked.join(' ')} ${chart.remarks}`.toLowerCase();
  for (const a of scenario.allergies || []) {
    const n = names(a);
    if (n.length && !n.some((w) => allergyText.includes(w))) {
      out.push({ kind: 'allergy', scenario: `allergy: ${a}`,
        question: `The patient in this scenario has an allergy: ${a}. It isn't on your chart. Did you ask, and did they tell you?` });
    }
  }

  const medText = `${chart.medications.details} ${chart.remarks} ${chart.incidentHistory}`.toLowerCase();
  const missing = (scenario.medications || []).filter((m) => { const n = names(m); return n.length && !n.some((w) => medText.includes(w)); });
  if (missing.length) {
    out.push({ kind: 'medications', scenario: `home medications: ${missing.join('; ')}`,
      question: `The scenario patient takes ${missing.slice(0, 3).join('; ')}${missing.length > 3 ? ` and ${missing.length - 3} more` : ''}. ${missing.length === 1 ? 'It isn\'t' : 'They aren\'t'} in your Medications section. Did you get a full medication list?` });
  }

  for (const f of scenario.keyFindings || []) {
    if (!f.keywords.some((k) => text.includes(String(k).toLowerCase()))) {
      out.push({ kind: 'finding', scenario: f.finding,
        question: `The scenario had this: ${f.finding}. I can't find it on your chart. Did you find it?` });
    }
  }

  const sv = (scenario.vitalSets || [])[0];
  const cv = firstVitals(chart);
  if (sv && cv) {
    const diffs = [];
    const num = (x) => parseFloat(String(x).split('/')[0]);
    const cmp = (s, c, tol, label) => { if (s && c && !Number.isNaN(num(s)) && !Number.isNaN(num(c)) && Math.abs(num(s) - num(c)) > tol) diffs.push(`${label} ${c} (scenario ${s})`); };
    cmp(sv.hr, cv.Pulse, 15, 'HR');
    cmp(sv.bp, cv.BP, 20, 'BP');
    cmp(sv.spo2, cv.SpO2, 4, 'SpO2');
    cmp(sv.rr, cv.Resp, 6, 'RR');
    if (diffs.length) {
      out.push({ kind: 'vitals', scenario: 'initial vitals',
        question: `Your first vitals differ from the scenario's: ${diffs.join(', ')}. If your instructor changed them during the run, fine. If not, check what you transcribed.` });
    }
  }
  return out;
}

export { compareToScenario, names };
