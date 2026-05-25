import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const BASE_URL = 'https://scenario-backend.onrender.com/api/generate-scenario';
const CONCURRENCY = 3;
const ORIGIN = 'https://scenario-generator-ten.vercel.app';
const RESULTS_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), 'stress-test-directives-results.json');

const CASES = [
  {
    label: 'Inferior STEMI nitro contraindication',
    params: { semester: '4', type: 'Cardiac', complexity: 'Complex', environment: 'Urban', customPrompt: 'Inferior STEMI right ventricular involvement nitroglycerin contraindicated V4R' },
    mustContain: ['v4r', 'right ventricular', 'nitroglycerin'],
    mustNotContain: ['nitroglycerin is safe', 'nitroglycerin is appropriate', 'administer nitroglycerin without'],
  },
  {
    label: 'Asthma epi only not CPAP',
    params: { semester: '3', type: 'Respiratory', complexity: 'Simple', environment: 'Urban', customPrompt: 'Severe asthma attack bronchospasm epinephrine salbutamol' },
    mustContain: ['epinephrine', 'salbutamol'],
    mustNotContain: ['cpap'],
  },
  {
    label: 'COPD CPAP not epi',
    params: { semester: '3', type: 'Respiratory', complexity: 'Complex', environment: 'Home', customPrompt: 'COPD exacerbation severe respiratory distress CPAP oxygen 88-92' },
    mustContain: ['cpap', '88'],
    mustNotContain: ['epinephrine'],
  },
  {
    label: 'Hyperkalemia calcium gluconate ACP only',
    params: { semester: '4', type: 'Medical', complexity: 'Complex', environment: 'Home', customPrompt: 'Missed dialysis hyperkalemia peaked T waves ECG changes potassium' },
    mustContain: ['hyperkalem', 'ecg', 'transport'],
    mustNotContain: ['calcium gluconate', 'administer calcium'],
  },
  {
    label: 'Anaphylaxis epi first not dexamethasone',
    params: { semester: '3', type: 'Medical', complexity: 'Simple', environment: 'Public Space', customPrompt: 'Anaphylaxis urticaria bronchospasm hypotension allergen exposure' },
    mustContain: ['epinephrine'],
    mustNotContain: ['dexamethasone'],
  },
  {
    label: 'Opioid overdose naloxone titrated not full reversal',
    params: { semester: '4', type: 'Medical', complexity: 'Complex', environment: 'Home', customPrompt: 'Opioid overdose fentanyl respiratory depression naloxone titration' },
    mustContain: ['naloxone', 'ventilat'],
    mustNotContain: ['full reversal', 'full dose'],
  },
  {
    label: 'Hypoglycemia oral glucose vs glucagon decision',
    params: { semester: '3', type: 'Medical', complexity: 'Simple', environment: 'Urban', customPrompt: 'Hypoglycemia diabetic low blood sugar altered consciousness swallowing' },
    mustContain: ['glucose', 'swallow'],
    mustNotContain: [],
  },
  {
    label: 'Cardiac ischemia ASA and nitro sequence',
    params: { semester: '3', type: 'Cardiac', complexity: 'Simple', environment: 'Urban', customPrompt: 'Chest pain ACS suspected cardiac ischemia ASA nitroglycerin 12-lead ECG' },
    mustContain: ['ecg', 'nitroglycerin'],
    mustNotContain: [],
  },
  {
    label: 'Nausea dimenhydrinate not with diphenhydramine',
    params: { semester: '3', type: 'Medical', complexity: 'Simple', environment: 'Urban', customPrompt: 'Nausea vomiting dimenhydrinate antiemetic treatment' },
    mustContain: ['dimenhydrinate'],
    mustNotContain: ['diphenhydramine'],
  },
  {
    label: 'TXA trauma hemorrhage not delayed transport',
    params: { semester: '4', type: 'Trauma', complexity: 'Complex', environment: 'Rural', customPrompt: 'Significant traumatic hemorrhage penetrating trauma TXA tranexamic acid' },
    mustContain: ['txa', 'tranexamic'],
    mustNotContain: ['delay transport for txa', 'delay transport for tranexamic'],
  },
];

async function runCase(testCase, index) {
  const start = Date.now();
  const { label, params, mustContain, mustNotContain } = testCase;
  try {
    const res = await fetch(BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Origin': ORIGIN },
      body: JSON.stringify({ ...params, generationDepth: 'Quick Draft', shiftMode: 'Day Shift', scenarioFriction: 'Clean', includeBystanders: false, includeTeachingCues: false }),
    });
    if (!res.ok) return { index, label, error: `HTTP ${res.status}`, durationMs: Date.now() - start };
    const data = await res.json();
    const elapsed = Date.now() - start;

    const treatmentArr = Array.isArray(data?.expectedTreatment) ? data.expectedTreatment : [];
    const protocolArr = Array.isArray(data?.protocolNotes) ? data.protocolNotes : [];
    const allText = [...treatmentArr, ...protocolArr, data?.teachersPoints || '', data?.clinicalReasoning?.summary || ''].join(' ').toLowerCase();
    const treatmentOnlyText = [...treatmentArr, ...protocolArr].join(' ').toLowerCase();

    const generationFailed = treatmentArr.length === 0 && protocolArr.length === 0;
    if (generationFailed) {
      return { index, label, pass: false, missingRequired: ['GENERATION FAILED - no treatment content'], foundForbidden: [], durationMs: elapsed, error: null };
    }

    const missingRequired = mustContain.filter(w => !allText.includes(w));
    const foundForbidden = mustNotContain.filter(w => treatmentOnlyText.includes(w));
    const pass = missingRequired.length === 0 && foundForbidden.length === 0;

    return { index, label, pass, missingRequired, foundForbidden, durationMs: elapsed, error: null };
  } catch (err) {
    return { index, label, error: err.message, durationMs: Date.now() - start };
  }
}

async function runWithConcurrency(tasks, limit) {
  const results = []; let i = 0;
  async function next() { while (i < tasks.length) { const idx = i++; results[idx] = await tasks[idx](); } }
  await Promise.all(Array.from({ length: limit }, () => next()));
  return results;
}

async function main() {
  console.log(`\nDirective accuracy stress test — ${CASES.length} cases (${CONCURRENCY} concurrent) → ${BASE_URL}\n`);
  const tasks = CASES.map((c, i) => () => runCase(c, i + 1));
  const results = await runWithConcurrency(tasks, CONCURRENCY);

  for (const r of results) {
    const tag = `[${String(r.index).padStart(2, '0')}]`;
    if (r.error) { console.log(`${tag} ERROR  ${r.label} — ${r.error}`); continue; }
    const flag = r.pass ? '✓ PASS' : '✗ FAIL';
    console.log(`${tag} ${flag} | ${r.label} (${r.durationMs}ms)`);
    if (r.missingRequired.length && r.missingRequired[0].startsWith('GENERATION')) {
      console.log(`       ⚠ ${r.missingRequired[0]}`);
    } else {
      if (r.missingRequired.length) console.log(`       Missing: ${r.missingRequired.join(', ')}`);
      if (r.foundForbidden.length) console.log(`       Forbidden found: ${r.foundForbidden.join(', ')}`);
    }
  }

  const ok = results.filter(r => !r.error);
  const passed = ok.filter(r => r.pass);
  const failed = ok.filter(r => !r.pass);
  console.log('\n─────────────────────────────────────────────────────────');
  console.log(`SUMMARY  (${CASES.length} total)`);
  console.log(`  Errors:  ${results.filter(r => r.error).length}`);
  console.log(`  Passed:  ${passed.length}/${ok.length}`);
  console.log(`  Failed:  ${failed.length}`);
  if (failed.length) { console.log('  Failed cases:'); failed.forEach(r => console.log(`    - ${r.label}: missing=[${r.missingRequired.join(', ')}] forbidden=[${r.foundForbidden.join(', ')}]`)); }
  console.log('─────────────────────────────────────────────────────────\n');
  await fs.writeFile(RESULTS_PATH, JSON.stringify({ runAt: new Date().toISOString(), total: CASES.length, passed: passed.length, failed: failed.length, results }, null, 2));
  console.log(`Full results saved to ${RESULTS_PATH}`);
}

main().catch(err => { console.error(err); process.exit(1); });
