import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const BASE_URL = 'https://scenario-backend.onrender.com/api/generate-scenario';
const CONCURRENCY = 3;
const ORIGIN = 'https://scenario-generator-ten.vercel.app';
const RESULTS_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), 'stress-test-arrest-results.json');

const CASES = [
  { label: 'VF Arrest Sem 4', params: { semester: '4', type: 'Cardiac', complexity: 'Complex', environment: 'Urban', customPrompt: 'Witnessed cardiac arrest ventricular fibrillation shockable rhythm bystander CPR' } },
  { label: 'PEA Arrest Sem 4', params: { semester: '4', type: 'Cardiac', complexity: 'Complex', environment: 'Rural', customPrompt: 'Cardiac arrest PEA pulseless electrical activity reversible causes' } },
  { label: 'Asystole Sem 4', params: { semester: '4', type: 'Cardiac', complexity: 'Complex', environment: 'Home', customPrompt: 'Cardiac arrest asystole unwitnessed downtime unknown' } },
  { label: 'Post-ROSC Sem 4', params: { semester: '4', type: 'Cardiac', complexity: 'Complex', environment: 'Urban', customPrompt: 'Post-ROSC return of spontaneous circulation hemodynamic instability SpO2 ETCO2 targets' } },
  { label: 'Anaphylaxis Arrest Sem 4', params: { semester: '4', type: 'Medical', complexity: 'Complex', environment: 'Public Space', customPrompt: 'Anaphylactic cardiac arrest epinephrine anaphylaxis directly caused arrest' } },
  { label: 'Trauma Arrest Sem 4', params: { semester: '4', type: 'Trauma', complexity: 'Complex', environment: 'Rural', customPrompt: 'Traumatic cardiac arrest hemorrhagic penetrating mechanism' } },
  { label: 'VF Arrest Sem 3', params: { semester: '3', type: 'Cardiac', complexity: 'Complex', environment: 'Urban', customPrompt: 'Cardiac arrest shockable rhythm defibrillation CPR resuscitation' } },
  { label: 'Drowning Arrest Sem 4', params: { semester: '4', type: 'Environmental', complexity: 'Complex', environment: 'Wilderness', customPrompt: 'Near drowning cardiac arrest cold water submersion hypothermia' } },
];

const ARREST_REQUIRED = ['cpr', 'compressions', 'defibrillat', 'resuscitat', 'arrest'];
const PCP_FORBIDDEN_IN_ARREST = ['atropine', 'amiodarone', 'lidocaine', 'dopamine', 'calcium gluconate', 'adenosine'];
const EPI_ALLOWED_CONTEXTS = ['anaphylax'];

async function runCase(testCase, index) {
  const start = Date.now();
  const { label, params } = testCase;
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

    const hasArrestContent = ARREST_REQUIRED.some(w => allText.includes(w));
    const isAnaphylaxisContext = EPI_ALLOWED_CONTEXTS.some(w => (params.customPrompt || '').toLowerCase().includes(w));
    const hasEpi = allText.includes('epinephrine') || allText.includes('epi ');
    const epiFlag = hasEpi && !isAnaphylaxisContext ? '⚠ EPI IN NON-ANAPHYLAXIS ARREST' : null;
    const forbiddenFound = PCP_FORBIDDEN_IN_ARREST.filter(m => allText.includes(m));
    const issues = [...(epiFlag ? [epiFlag] : []), ...forbiddenFound.map(m => `⚠ FORBIDDEN MED: ${m}`)];
    const pass = hasArrestContent && issues.length === 0;

    return { index, label, pass, hasArrestContent, epiFlag, forbiddenFound, issues, isAnaphylaxisContext, durationMs: elapsed, error: null };
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
  console.log(`\nArrest scenario stress test — ${CASES.length} cases (${CONCURRENCY} concurrent) → ${BASE_URL}\n`);
  const tasks = CASES.map((c, i) => () => runCase(c, i + 1));
  const results = await runWithConcurrency(tasks, CONCURRENCY);

  for (const r of results) {
    const tag = `[${String(r.index).padStart(2, '0')}]`;
    if (r.error) { console.log(`${tag} ERROR  ${r.label} — ${r.error}`); continue; }
    const flag = r.pass ? '✓ PASS' : '✗ FAIL';
    const anaphNote = r.isAnaphylaxisContext ? ' (anaphylaxis — epi allowed)' : '';
    console.log(`${tag} ${flag} | ${r.label}${anaphNote} (${r.durationMs}ms)`);
    if (!r.hasArrestContent) console.log(`       ⚠ Missing arrest content in expected treatment`);
    r.issues.forEach(i => console.log(`       ${i}`));
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
