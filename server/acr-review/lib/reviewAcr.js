// The review step: build the input, get feedback (OpenAI or the offline mock), then check it.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { schema, DOMAINS } from './feedbackSchema.js';

const PROMPTS = path.join(__dirname, '..', 'prompts');
const RUBRIC = JSON.parse(fs.readFileSync(path.join(PROMPTS, 'rubric.json'), 'utf8'));

function systemPrompt() {
  const voice = fs.readFileSync(path.join(PROMPTS, 'instructor_voice.md'), 'utf8');
  return fs.readFileSync(path.join(PROMPTS, 'reviewer_system.md'), 'utf8').replace('{{VOICE}}', voice);
}

function buildInput({ chart, checker, scenario, mismatches, previousFeedback }) {
  return {
    chart,
    checker: { issues: checker.issues, questions: checker.questions, intervals: checker.intervals, vitals_trend: checker.trend },
    _issueDetails: checker.issueDetails || [],
    scenario,
    possible_mismatches: mismatches.map((m) => ({ scenario_fact: m.scenario, lead: m.question })),
    rubric: RUBRIC,
    previous_feedback: previousFeedback || null,
  };
}

async function reviewWithOpenAI(input) {
  let OpenAI;
  try { ({ default: OpenAI } = await import('openai')); } catch (e) { throw new Error('The openai package is not installed (npm install openai).'); }
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not set. Set it, or run with ACR_REVIEW_MODE=mock.');
  const client = new OpenAI();
  // Same model family as scenario generation unless ACR_REVIEW_MODEL says otherwise. Newer reasoning models only accept
  // their default temperature, so temperature is sent only when ACR_REVIEW_TEMPERATURE is set.
  const params = {
    model: process.env.ACR_REVIEW_MODEL || process.env.OPENAI_MODEL_DETAILED || 'gpt-5.5',
    max_completion_tokens: Number(process.env.ACR_REVIEW_MAX_TOKENS || 16000),
    messages: [
      { role: 'system', content: systemPrompt() },
      { role: 'user', content: JSON.stringify(input) },
    ],
    response_format: { type: 'json_schema', json_schema: { name: 'acr_feedback', strict: true, schema } },
  };
  if (process.env.ACR_REVIEW_TEMPERATURE) params.temperature = Number(process.env.ACR_REVIEW_TEMPERATURE);
  const resp = await client.chat.completions.create(params);
  const choice = resp.choices[0];
  const msg = choice.message;
  if (msg.refusal) throw new Error('The model declined to review this chart: ' + msg.refusal);
  if (!msg.content) throw new Error(`The model returned no feedback (finish reason: ${choice.finish_reason}). If it is "length", raise ACR_REVIEW_MAX_TOKENS.`);
  return JSON.parse(msg.content);
}

// ---------------------------------------------------------------- offline mock reviewer
// Rule-based stand-in so the whole app can be tested without an API key. It uses only the checker,
// the scenario comparison and simple chart facts. The UI labels its output as rule-based.
const SEVERITY = [
  [/NKA is ticked|allergy/i, 1], [/Nothing charted after it shows/i, 1], [/no blood glucose|glucose was checked/i, 2],
  [/CTAS Arrive Patient is|receiving hospital was notified|no ventilation rate/i, 3], [/with no name|pill bottle/i, 4], [/no vitals charted after|response isn't shown/i, 2], [/has no unit|has no route|has no dose/i, 2],
  [/is earlier than|before Patient Contact/i, 3], [/doesn't match|isn't on the current/i, 3], [/Only one set of vitals|No vitals/i, 3],
  [/contradict|Unremarkable, but/i, 4], [/Refusal/i, 2], [/who took over care/i, 4], [/Blank:/i, 5],
];
function severity(msg) { for (const [re, s] of SEVERITY) if (re.test(msg)) return s; return 6; }

const DOMAIN_SIGNS = {
  Completeness: /Blank|nothing ticked|no box|no blood glucose|was notified|no ventilation rate|pill bottle|CNO|is empty/i,
  'Accuracy and consistency': /ticked but|Unremarkable, but|doesn't match|works out to|before the call date|contradict|CTAS Arrive Patient is/i,
  'Chronology and reassessment': /earlier than|before Patient Contact|vitals charted after|Only one set|No vitals|glucose was checked|Nothing charted after it shows/i,
  'Clinical reasoning in the narrative': /Remarks|narrative|Nothing charted after it shows/i,
  'Codes, times and format': /has no unit|has no route|has no dose|isn't on the current|problem code|designation|Age needs|time/i,
  'Handover, disposition and refusal': /refusal|took over care|CTAS Arrive Patient is|was notified|with no name/i,
};
function plainIssue(m) { const t = m.replace(/\s*\((ODS 4\.0|ACR Manual)\)$/, ''); return t.length > 160 ? `${t.slice(0, 157)}...` : t; }

function mockReview(input) {
  const { chart, checker } = input;
  const rows = chart.treatmentGrid;
  const vitals = rows.filter((r) => r.Pulse || r.BP || r.SpO2);
  const strengths = [];
  const reasonSentence = (chart.remarks.match(/[^.]*\b(because|so |rather than|after confirming|asked specifically)[^.]*\./i) || [])[0];
  if (reasonSentence) strengths.push({ point: 'Your Remarks explain a decision, not just what you did. Keep doing that.', evidence: reasonSentence.trim() });
  const quoted = (chart.remarks.match(/"[^"]{10,}"/) || [])[0];
  if (quoted) strengths.push({ point: "You recorded the patient's own words. On a refusal or a history, that is the strongest evidence you can put on the page.", evidence: quoted });
  if (strengths.length < 2 && vitals.length >= 3) strengths.push({ point: 'You kept charting vitals through the call, so the reader can see the trend.', evidence: `Row ${vitals[vitals.length - 1].row}: ${vitals[vitals.length - 1].code}` });
  const details = input._issueDetails || [];
  const evidenceFor = (m) => {
    const row = m.match(/Row \d+/);
    if (row) return row[0];
    const d = details.find((x) => x.msg === m);
    if (d) { const k = d.values.findIndex((v) => v && v !== 'Off'); if (k >= 0) return d.values[k]; if (d.fields[0]) return `Blank: ${d.fields[0]}`; }
    return m.split(':')[0];
  };
  const narrativeWeak = !/because|so |rather than|decid|reason|after confirming/i.test(chart.remarks);
  const nChecker = narrativeWeak ? 2 : 3;
  const fixes = checker.issues.map((m) => ({ m, s: severity(m) })).sort((a, b) => a.s - b.s).slice(0, nChecker).map((x, i) => ({
    priority: i + 1, issue: x.m.replace(/\s*\((ODS 4\.0|ACR Manual)\)$/, ''), evidence: evidenceFor(x.m),
    why_it_matters: x.s <= 2 ? 'On a real call this is the kind of gap that reaches the patient: the next person caring for them works from your chart.' : 'Anyone reading this chart later has to guess at what happened here.',
    what_to_do: 'Fix it on the chart and run Check my ACR again.',
  }));
  if (fixes.length < 3 && narrativeWeak) {
    fixes.push({ priority: fixes.length + 1, issue: "Your Remarks say what you did but not why. There isn't a single decision explained.", evidence: chart.remarks ? chart.remarks.split(/(?<=\.)\s/)[0] : 'Blank: Remarks',
      why_it_matters: 'The reasoning is the part an instructor, a base hospital reviewer or a coroner will look for first.', what_to_do: 'Pick the biggest decision on this call and write the reason next to it.' });
  }
  const scenario_questions = input.possible_mismatches.slice(0, 4).map((m) => ({ question: m.lead, scenario_fact: m.scenario_fact }));
  const q = checker.questions.find((x) => !/ODS 4\.0|ACR Manual/.test(x)) || checker.questions[0] || '';
  const n = checker.issues.length;
  const clamp = (x) => Math.max(1, Math.min(7, x));
  const has = (re) => checker.issues.some((m) => re.test(m));
  // The in-form checker's findings cost 2 points in their domain; the server's documentation rules cost 1, since a
  // chart can have the care roughly right and still miss several of them. An unanswered deterioration costs 2 more.
  const count = (re) => checker.issues.filter((m) => re.test(m)).length;
  const missingExpected = input.possible_mismatches.filter((m) => /expected this|isn't on your chart|Did you find it/i.test(m.lead)).length;
  const unanswered = count(/Nothing charted after it shows/i);
  const rubric = [
    ['Completeness', clamp(7 - 2 * count(/Blank|nothing ticked|no box/i) - count(/no blood glucose|was notified|no ventilation rate|pill bottle/i) - (has(/CNO/) ? 1 : 0) - Math.min(2, missingExpected))],
    ['Accuracy and consistency', clamp(7 - 2 * count(/ticked but|Unremarkable, but|doesn't match|works out to|before the call date/i) - count(/CTAS Arrive Patient is/i))],
    ['Chronology and reassessment', clamp(7 - 2 * count(/earlier than|before Patient Contact|vitals charted after|Only one set/i) - count(/glucose was checked/i) - 2 * unanswered)],
    ['Clinical reasoning in the narrative', /because|so |rather than|decid|reason/i.test(chart.remarks) ? clamp(6 - unanswered) : 3],
    ['Codes, times and format', clamp(7 - 2 * count(/has no unit|has no route|has no dose|isn't on the current|problem code|designation|Age needs|time.*(before|earlier)/i))],
    ['Handover, disposition and refusal', chart.refusal || chart.callEvents.TOC || chart.callEvents['Arrive Destination'] ? clamp(7 - 2 * count(/refusal|took over care/i) - count(/CTAS Arrive Patient is|was notified|with no name/i)) : null],
  ].map(([domain, score]) => {
    if (score === null) return { domain, score, evidence: 'Nothing on this call needed it.' };
    // Name the finding that cost the most here, so the student can see why the score is what it is.
    const hit = checker.issues.find((m) => DOMAIN_SIGNS[domain].test(m));
    const evidence = hit ? plainIssue(hit) : score >= 6 ? 'The checker found nothing wrong here.' : 'No single finding; see the fixes above.';
    return { domain, score, evidence };
  });
  const prev = input.previous_feedback;
  const plain = (m) => m.replace(/\s*\((ODS 4\.0|ACR Manual)\)$/, '');
  const improvement_since_last = prev ? (prev.fixes || []).map((f) => {
    if (/^Your Remarks say what you did but not why/.test(f.issue)) return `${narrativeWeak ? 'Still open' : 'Fixed'}: ${f.issue}`;
    const fromChecker = (prev._checkerIssues || []).includes(f.issue) || SEVERITY.some(([re]) => re.test(f.issue));
    if (!fromChecker) return `Can't tell from the rules alone: ${f.issue}`;
    const still = checker.issues.some((m) => plain(m) === f.issue);
    return `${still ? 'Still open' : 'Fixed'}: ${f.issue}`;
  }) : [];
  return {
    summary: n === 0 && !input.possible_mismatches.length
      ? 'The checker found nothing missing on this chart and it lines up with the scenario. Read the questions below; they are about what the checker can\'t see.'
      : `There ${n === 1 ? 'is' : 'are'} ${n} documentation gap${n === 1 ? '' : 's'} on this chart${input.possible_mismatches.length ? ` and ${input.possible_mismatches.length} place${input.possible_mismatches.length === 1 ? '' : 's'} where it doesn't match the scenario` : ''}. Start with the first fix below.`,
    strengths: strengths.slice(0, 2), fixes, scenario_questions, question_to_think_about: q, rubric, improvement_since_last,
    model_sentence: { offered: false, text: '', note: '' }, instructor_flags: [],
  };
}

// ---------------------------------------------------------------- score ceilings from what is on the chart
// Both reviewers score by subtracting for problems they find, so a blank chart, with nothing to find wrong, used to
// score 7 for accuracy and chronology. A score has to be earned by what is on the page. These limits come from the
// chart itself and apply to the AI and the rule-based review alike. max 1 means the domain scores 1 whatever the
// reviewer said; max null means there is too little to judge it at all.
const words = (t) => String(t || '').trim().split(/\s+/).filter(Boolean).length;
const hasAny = (o) => !!o && ((Array.isArray(o.ticked) && o.ticked.length > 0) || words(o.details) > 0);
function chartFacts(chart) {
  const grid = chart.treatmentGrid || [];
  const vitals = grid.filter((r) => r.Pulse || r.BP || r.SpO2 || r.Resp);
  const exam = Object.values(chart.physicalExam || {}).some((v) => (Array.isArray(v) ? v.length > 0 : v && v !== 'Off'));
  const sections = [words(chart.chiefComplaint) >= 2, words(chart.incidentHistory) >= 5, words(chart.remarks) >= 5, vitals.length > 0,
    exam, hasAny(chart.medications), hasAny(chart.allergies), hasAny(chart.pastHistory)].filter(Boolean).length;
  return {
    grid: grid.length, vitals: vitals.length, coded: grid.filter((r) => r.code).length, timed: grid.filter((r) => r.time).length,
    events: Object.values(chart.callEvents || {}).filter(Boolean).length, remarksWords: words(chart.remarks), sections,
    ended: !!(chart.refusal || (chart.callEvents || {}).TOC || (chart.callEvents || {})['Arrive Destination']),
  };
}
function isNearlyBlank(chart) { const f = chartFacts(chart); return f.sections <= 1 && f.grid === 0; }
function scoreCeilings(chart) {
  const f = chartFacts(chart);
  const c = {};
  if (f.sections <= 2) c.Completeness = { max: 1, why: 'Most of the chart is blank.' };
  if (f.sections < 3) c['Accuracy and consistency'] = { max: null, why: 'There isn\'t enough on the chart to check it against itself.' };
  else if (f.sections < 5) c['Accuracy and consistency'] = { max: 5, why: 'Only part of the chart is filled in, so only part of it could be checked for consistency.' };
  if (f.vitals === 0) c['Chronology and reassessment'] = { max: 1, why: 'No vitals in the treatment grid.' };
  else if (f.vitals === 1) c['Chronology and reassessment'] = { max: 1, why: 'Only one set of vitals, so there is no reassessment to follow.' };
  else if (f.grid > 0 && f.timed === 0) c['Chronology and reassessment'] = { max: 3, why: 'None of the treatment grid rows has a time.' };
  else if (f.vitals === 2) c['Chronology and reassessment'] = { max: 5, why: 'Two sets of vitals: the trend is there, but thin.' };
  if (f.remarksWords === 0) c['Clinical reasoning in the narrative'] = { max: 1, why: 'Remarks is empty.' };
  else if (f.remarksWords < 25) c['Clinical reasoning in the narrative'] = { max: 3, why: 'Remarks is too short to explain a decision.' };
  // Call times alone don't earn this: a pre-filled ACR arrives with the dispatch times already in.
  if (f.coded === 0 && (f.grid === 0 || f.events === 0)) c['Codes, times and format'] = { max: 1, why: f.grid === 0 ? 'Nothing in the treatment grid, so no procedure codes to read.' : 'No procedure codes and no call times on the chart.' };
  else if (f.coded === 0 || f.events < 3) c['Codes, times and format'] = { max: 3, why: f.coded === 0 ? 'No procedure codes in the treatment grid.' : 'Most call event times are blank.' };
  if (!f.ended) c['Handover, disposition and refusal'] = { max: 1, why: 'No transfer of care, destination or refusal on the chart.' };
  return c;
}
function applyCeilings(rubric, chart) {
  const c = scoreCeilings(chart);
  return rubric.map((r) => {
    const cap = c[r.domain];
    if (!cap) return r;
    if (cap.max === null) return { ...r, score: null, evidence: cap.why };
    if (cap.max === 1) return { ...r, score: 1, evidence: cap.why };
    if (r.score !== null && r.score > cap.max) return { ...r, score: cap.max, evidence: `${r.evidence} ${cap.why}`.trim() };
    return r;
  });
}

// ---------------------------------------------------------------- checks on whatever came back
function flatText(chart) {
  const bits = [];
  (function walk(v) {
    if (v == null) return;
    if (typeof v === 'string' || typeof v === 'number') bits.push(String(v));
    else if (Array.isArray(v)) v.forEach(walk);
    else if (typeof v === 'object') Object.values(v).forEach(walk);
  })(chart);
  chart.treatmentGrid.forEach((r) => bits.push(`Row ${r.row}: ${[r.code, r['Dose/Unit'], r.Route].filter(Boolean).join(' ')}`, `Row ${r.row}`));
  return bits.join(' \n ').toLowerCase().replace(/\s+/g, ' ');
}

const FIELD_NAMES = ['remarks', 'incident history', 'chief complaint', 'medications', 'allergies', 'treatment prior to arrival', 'relevant past history',
  'ctas', 'crew', 'designation', 'call events', 'toc', 'transfer of care', 'problem code', 'primary problem', 'age', 'sequence', 'skin', 'general appearance',
  'chest', 'abdomen', 'extremities', 'refusal', 'capacity', 'witness', 'signature', 'dnr', 'trauma', 'return', 'receiving facility'];

// Evidence for something missing is written "Blank: <field>". With the raw fields available it only counts if that field
// really is empty; otherwise it has to name a real section of the chart.
function blankFound(name, fields) {
  const f = fields && Object.keys(fields).find((k) => k.toLowerCase() === name.toLowerCase());
  if (f) return !fields[f].value || fields[f].value === 'Off';
  return FIELD_NAMES.some((n) => name.toLowerCase().startsWith(n));
}

function evidenceFound(evidence, text, fields) {
  const raw = String(evidence || '').trim();
  const blank = /^blank:\s*(.+)$/i.exec(raw);
  if (blank) return blankFound(blank[1].replace(/[.\s]+$/, ''), fields);
  const e = raw.toLowerCase().replace(/\s+/g, ' ').replace(/^["'\s]+|["'\s.]+$/g, '');
  if (!e) return false;
  if (text.includes(e)) return true;
  if (/^row \d+/.test(e) && text.includes(e.split(':')[0])) return true;
  return FIELD_NAMES.some((f) => e.startsWith(f));
}

function postProcess(fb, chart, mode, fields) {
  const text = flatText(chart);
  const flags = [...(fb.instructor_flags || [])];
  const mark = (item) => {
    const ok = evidenceFound(item.evidence, text, fields);
    if (!ok) flags.push(`Evidence not found on the chart: "${item.evidence}". Check this point before relying on it.`);
    return { ...item, evidence_verified: ok };
  };
  const byDomain = Object.fromEntries((fb.rubric || []).map((r) => [r.domain, r]));
  const out = {
    ...fb,
    strengths: (fb.strengths || []).slice(0, 2).map(mark),
    fixes: (fb.fixes || []).slice(0, 3).map((f, i) => mark({ ...f, priority: i + 1 })),
    scenario_questions: (fb.scenario_questions || []).slice(0, 4),
    rubric: DOMAINS.map((d) => {
      const r = byDomain[d] || { domain: d, score: null, evidence: 'Not scored.' };
      const s = Number.isInteger(r.score) ? Math.max(1, Math.min(7, r.score)) : null;
      return { domain: d, score: s, evidence: r.evidence };
    }),
    instructor_flags: flags,
    meta: { mode, generated_at: new Date().toISOString() },
  };
  out.rubric = applyCeilings(out.rubric, chart);
  if (!out.model_sentence) out.model_sentence = { offered: false, text: '', note: '' };
  const scored = out.rubric.filter((r) => r.score !== null);
  out.meta.rubric_total = scored.length ? `${scored.reduce((a, r) => a + r.score, 0)} / ${scored.length * 7}` : '';
  return out;
}

async function reviewAcr(parts) {
  const input = buildInput(parts);
  const mode = (process.env.ACR_REVIEW_MODE || 'mock').toLowerCase();
  const { _issueDetails, ...modelInput } = input;
  // A blank or nearly blank chart gets a short, honest answer without spending an AI review on it.
  if (isNearlyBlank(parts.chart)) {
    const fb = mockReview(input);
    fb.summary = 'This chart is blank or nearly blank, so there is nothing yet to review. Fill it in from your scenario, then upload it again.';
    fb.strengths = []; fb.fixes = fb.fixes.slice(0, 1);
    return postProcess(fb, parts.chart, mode === 'openai' ? 'blank' : 'mock', parts.fields);
  }
  if (mode !== 'openai') return postProcess(mockReview(input), parts.chart, 'mock', parts.fields);
  try {
    return postProcess(await reviewWithOpenAI(modelInput), parts.chart, 'openai', parts.fields);
  } catch (e) {
    // The student still gets the rule-based review rather than an error, and the page says the AI part was unavailable.
    console.error('[acr-review] AI review failed, falling back to rule-based feedback:', e.message);
    return postProcess(mockReview(input), parts.chart, 'fallback', parts.fields);
  }
}

export { reviewAcr, buildInput, systemPrompt, postProcess, mockReview, scoreCeilings, isNearlyBlank };
