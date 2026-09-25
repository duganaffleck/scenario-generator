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
  [/NKA is ticked|allergy/i, 1], [/no vitals charted after|response isn't shown/i, 2], [/has no unit|has no route|has no dose/i, 2],
  [/is earlier than|before Patient Contact/i, 3], [/doesn't match|isn't on the current/i, 3], [/Only one set of vitals|No vitals/i, 3],
  [/contradict|Unremarkable, but/i, 4], [/Refusal/i, 2], [/who took over care/i, 4], [/Blank:/i, 5],
];
function severity(msg) { for (const [re, s] of SEVERITY) if (re.test(msg)) return s; return 6; }

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
  const rubric = [
    ['Completeness', clamp(7 - 2 * checker.issues.filter((m) => /Blank|nothing ticked|no box/i.test(m)).length - (has(/CNO/) ? 1 : 0))],
    ['Accuracy and consistency', clamp(7 - 2 * checker.issues.filter((m) => /ticked but|Unremarkable, but|doesn't match|works out to|before the call date/i.test(m)).length)],
    ['Chronology and reassessment', clamp(7 - 2 * checker.issues.filter((m) => /earlier than|before Patient Contact|vitals/i.test(m)).length)],
    ['Clinical reasoning in the narrative', /because|so |rather than|decid|reason/i.test(chart.remarks) ? 6 : 3],
    ['Codes, times and format', clamp(7 - 2 * checker.issues.filter((m) => /code|unit|route|designation|Age needs/i.test(m)).length)],
    ['Handover, disposition and refusal', chart.refusal || chart.callEvents.TOC ? clamp(7 - 2 * checker.issues.filter((m) => /refusal|took over care|CTAS/i.test(m)).length) : null],
  ].map(([domain, score]) => ({ domain, score, evidence: score === null ? 'Nothing on this call needed it.' : `${n} checker finding${n === 1 ? '' : 's'} bear on this domain.` }));
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
  if (!out.model_sentence) out.model_sentence = { offered: false, text: '', note: '' };
  const scored = out.rubric.filter((r) => r.score !== null);
  out.meta.rubric_total = scored.length ? `${scored.reduce((a, r) => a + r.score, 0)} / ${scored.length * 7}` : '';
  return out;
}

async function reviewAcr(parts) {
  const input = buildInput(parts);
  const mode = (process.env.ACR_REVIEW_MODE || 'mock').toLowerCase();
  const { _issueDetails, ...modelInput } = input;
  if (mode !== 'openai') return postProcess(mockReview(input), parts.chart, 'mock', parts.fields);
  try {
    return postProcess(await reviewWithOpenAI(modelInput), parts.chart, 'openai', parts.fields);
  } catch (e) {
    // The student still gets the rule-based review rather than an error, and the page says the AI part was unavailable.
    console.error('[acr-review] AI review failed, falling back to rule-based feedback:', e.message);
    return postProcess(mockReview(input), parts.chart, 'fallback', parts.fields);
  }
}

export { reviewAcr, buildInput, systemPrompt, postProcess, mockReview };
