import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const BASE_URL = 'https://scenario-backend.onrender.com/api/generate-scenario';
const CONCURRENCY = 3;
const ORIGIN = 'https://scenario-generator-ten.vercel.app';
const RESULTS_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), 'stress-test-semester-results.json');

const SEM2_FORBIDDEN_MEDS = ['nitroglycerin', 'salbutamol', 'epinephrine', 'naloxone', 'glucagon', 'dextrose', 'ketorolac', 'morphine', 'fentanyl', 'ketamine', 'dimenhydrinate', 'ondansetron', 'dexamethasone', 'oxytocin', 'asa', 'aspirin'];
const SEM3_4_REQUIRED_DIRECTIVE = ['directive', 'nitroglycerin', 'salbutamol', 'epinephrine', 'naloxone', 'asa', 'aspirin', 'glucose', 'glucagon', 'ketorolac', 'morphine', 'fentanyl', 'cpap', 'txa'];

const CASES = [
  { label: 'Sem 2 Medical Simple', params: { semester: '2', type: 'Medical', complexity: 'Simple', environment: 'Urban' }, checkSem2: true },
  { label: 'Sem 2 Trauma Simple', params: { semester: '2', type: 'Trauma', complexity: 'Simple', environment: 'Rural' }, checkSem2: true },
  { label: 'Sem 2 Cardiac Simple', params: { semester: '2', type: 'Cardiac', complexity: 'Simple', environment: 'Urban' }, checkSem2: true },
  { label: 'Sem 2 Respiratory Simple', params: { semester: '2', type: 'Respiratory', complexity: 'Simple', environment: 'Urban' }, checkSem2: true },
  { label: 'Sem 3 Cardiac Simple', params: { semester: '3', type: 'Cardiac', complexity: 'Simple', environment: 'Urban' }, checkSem2: false },
  { label: 'Sem 3 Medical Complex', params: { semester: '3', type: 'Medical', complexity: 'Complex', environment: 'Home' }, checkSem2: false },
  { label: 'Sem 3 Respiratory Complex', params: { semester: '3', type: 'Respiratory', complexity: 'Complex', environment: 'Urban' }, checkSem2: false },
  { label: 'Sem 4 Cardiac Complex', params: { semester: '4', type: 'Cardiac', complexity: 'Complex', environment: 'Urban' }, checkSem2: false },
  { label: 'Sem 4 Medical Complex', params: { semester: '4', type: 'Medical', complexity: 'Complex', environment: 'Home' }, checkSem2: false },
  { label: 'Sem 4 Trauma Complex', params: { semester: '4', type: 'Trauma', complexity: 'Complex', environment: 'Rural' }, checkSem2: false },
];

async function runCase(testCase, index) {
  const start = Date.now();
  const { label, params, checkSem2 } = testCase;
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
    const allText = treatmentArr.join(' ').toLowerCase();
    const issues = [];

    if (checkSem2) {
      const foundMeds = SEM2_FORBIDDEN_MEDS.filter(m => allText.includes(m));
      if (foundMeds.length) issues.push(`Sem 2 has medications in expected treatment: ${foundMeds.join(', ')}`);
    } else {
      const hasDirective = SEM3_4_REQUIRED_DIRECTIVE.some(w => allText.includes(w));
      if (!hasDirective) issues.push('Sem 3/4 missing directive decision point in expected treatment');
    }

    const pass = issues.length === 0;
    return { index, label, semester: params.semester, pass, issues, durationMs: elapsed, error: null };
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
  console.log(`\nSemester appropriateness stress test — ${CASES.length} cases (${CONCURRENCY} concurrent) → ${BASE_URL}\n`);
  const tasks = CASES.map((c, i) => () => runCase(c, i + 1));
  const results = await runWithConcurrency(tasks, CONCURRENCY);

  for (const r of results) {
    const tag = `[${String(r.index).padStart(2, '0')}]`;
    if (r.error) { console.log(`${tag} ERROR  ${r.label} — ${r.error}`); continue; }
    const flag = r.pass ? '✓ PASS' : '✗ FAIL';
    console.log(`${tag} ${flag} | Sem ${r.semester} | ${r.label} (${r.durationMs}ms)`);
    r.issues.forEach(i => console.log(`       ⚠ ${i}`));
  }

  const ok = results.filter(r => !r.error);
  const passed = ok.filter(r => r.pass);
  const failed = ok.filter(r => !r.pass);
  console.log('\n─────────────────────────────────────────────────────────');
  console.log(`SUMMARY  (${CASES.length} total)`);
  console.log(`  Errors:  ${results.filter(r => r.error).length}`);
  console.log(`  Passed:  ${passed.length}/${ok.length}`);
  console.log(`  Failed:  ${failed.length}`);
  if (failed.length) { console.log('  Failed cases:'); failed.forEach(r => { console.log(`    - ${r.label}`); r.issues.forEach(i => console.log(`      ${i}`)); }); }
  console.log('─────────────────────────────────────────────────────────\n');
  await fs.writeFile(RESULTS_PATH, JSON.stringify({ runAt: new Date().toISOString(), total: CASES.length, passed: passed.length, failed: failed.length, results }, null, 2));
  console.log(`Full results saved to ${RESULTS_PATH}`);
}

main().catch(err => { console.error(err); process.exit(1); });
