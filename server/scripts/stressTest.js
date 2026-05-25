import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const BASE_URL = 'https://scenario-backend.onrender.com/api/generate-scenario';
const CONCURRENCY = 3;
const RESULTS_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), 'stress-test-results.json');

const CASES = [
  { semester: '2', type: 'Medical',     complexity: 'Simple',  environment: 'Urban',    uniqueness: 'Common'   },
  { semester: '2', type: 'Trauma',      complexity: 'Simple',  environment: 'Rural',    uniqueness: 'Common'   },
  { semester: '2', type: 'Cardiac',     complexity: 'Simple',  environment: 'Urban',    uniqueness: 'Common'   },
  { semester: '3', type: 'Medical',     complexity: 'Simple',  environment: 'Urban',    uniqueness: 'Common'   },
  { semester: '3', type: 'Trauma',      complexity: 'Complex', environment: 'Rural',    uniqueness: 'Uncommon' },
  { semester: '3', type: 'Cardiac',     complexity: 'Simple',  environment: 'Urban',    uniqueness: 'Common'   },
  { semester: '3', type: 'Respiratory', complexity: 'Complex', environment: 'Urban',    uniqueness: 'Common'   },
  { semester: '3', type: 'OB/Peds',    complexity: 'Simple',  environment: 'Suburban',  uniqueness: 'Common'   },
  { semester: '4', type: 'Medical',     complexity: 'Complex', environment: 'Urban',    uniqueness: 'Uncommon' },
  { semester: '4', type: 'Trauma',      complexity: 'Complex', environment: 'Rural',    uniqueness: 'Uncommon' },
  { semester: '4', type: 'Cardiac',     complexity: 'Complex', environment: 'Urban',    uniqueness: 'Uncommon' },
  { semester: '4', type: 'Respiratory', complexity: 'Simple',  environment: 'Suburban', uniqueness: 'Common'   },
  { semester: '4', type: 'OB/Peds',    complexity: 'Complex', environment: 'Urban',    uniqueness: 'Uncommon' },
  { semester: '2', type: 'Medical',     complexity: 'Complex', environment: 'Rural',    uniqueness: 'Uncommon' },
  { semester: '3', type: 'Medical',     complexity: 'Complex', environment: 'Suburban', uniqueness: 'Rare'     },
  { semester: '3', type: 'Cardiac',     complexity: 'Complex', environment: 'Rural',    uniqueness: 'Uncommon' },
  { semester: '4', type: 'Medical',     complexity: 'Simple',  environment: 'Urban',    uniqueness: 'Common'   },
  { semester: '2', type: 'Respiratory', complexity: 'Simple',  environment: 'Urban',    uniqueness: 'Common'   },
  { semester: '4', type: 'Trauma',      complexity: 'Simple',  environment: 'Urban',    uniqueness: 'Common'   },
  { semester: '3', type: 'OB/Peds',    complexity: 'Complex', environment: 'Rural',    uniqueness: 'Rare'     },
];

// ── HR/ECG consistency ──────────────────────────────────────────────────────

function parseHR(hrStr) {
  if (!hrStr) return null;
  const m = String(hrStr).match(/\d+/);
  return m ? parseInt(m[0], 10) : null;
}

function checkConsistency(hr, ecgLabel) {
  if (!hr || !ecgLabel) return { consistent: null, reason: 'missing data' };
  const label = ecgLabel.toLowerCase();
  if (label.includes('sinus tachycardia') && hr <= 100)
    return { consistent: false, reason: `ECG=Sinus Tachycardia but HR=${hr}` };
  if (label.includes('sinus bradycardia') && hr >= 60)
    return { consistent: false, reason: `ECG=Sinus Bradycardia but HR=${hr}` };
  if (label.includes('normal sinus rhythm') && (hr < 60 || hr > 100))
    return { consistent: false, reason: `ECG=Normal Sinus Rhythm but HR=${hr}` };
  return { consistent: true, reason: 'ok' };
}

// ── Blank field detection ───────────────────────────────────────────────────

const TOP_LEVEL_KEYS = [
  'title', 'patientDemographics', 'patientPresentation',
  'incidentNarrative', 'opqrst', 'sample', 'vitalSigns',
  'physicalExam', 'caseProgression', 'expectedTreatment',
  'clinicalReasoning', 'grsAnchors', 'teachersPoints',
  'learningObjectives', 'selfReflectionPrompts',
];

function findBlankFields(data) {
  const blanks = [];
  for (const key of TOP_LEVEL_KEYS) {
    const val = data[key];
    if (val === undefined || val === null) { blanks.push(`${key}:missing`); continue; }
    if (typeof val === 'string' && val.trim() === '') { blanks.push(`${key}:blank`); continue; }
    if (Array.isArray(val) && val.length === 0) { blanks.push(`${key}:empty[]`); continue; }
    if (typeof val === 'object' && !Array.isArray(val) && Object.keys(val).length === 0)
      blanks.push(`${key}:empty{}`);
  }
  // Check chiefComplaint nested in patientDemographics too
  const cc = data?.patientDemographics?.chiefComplaint;
  if (!cc || String(cc).trim() === '') blanks.push('patientDemographics.chiefComplaint:blank');
  return blanks;
}

// ── Request runner ──────────────────────────────────────────────────────────

async function runCase(caseParams, index) {
  const start = Date.now();
  try {
    const res = await fetch(BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Origin': 'https://scenario-generator-ten.vercel.app' },
      body: JSON.stringify({
        ...caseParams,
        generationDepth: 'Quick Draft',
        shiftMode: 'Day Shift',
        scenarioFriction: 'Clean',
        includeBystanders: true,
        includeTeachingCues: true,
      }),
    });

    if (!res.ok) {
      return { index, caseParams, error: `HTTP ${res.status}`, durationMs: Date.now() - start };
    }

    const data = await res.json();
    const elapsed = Date.now() - start;

    const title = data?.title || data?.scenarioTitle || '';
    const chiefComplaint =
      data?.patientDemographics?.chiefComplaint || data?.chiefComplaint || '';
    const firstSet = data?.vitalSigns?.firstSet || {};
    const secondSet = data?.vitalSigns?.secondSet || {};
    const hrRaw = firstSet.hr || '';
    const ecgLabel = firstSet.ecgInterpretation || '';
    const ecgLabel2 = secondSet.ecgInterpretation || '';
    const hrRaw2 = secondSet.hr || '';
    const hr = parseHR(hrRaw);
    const consistency = checkConsistency(hr, ecgLabel);
    const blanks = findBlankFields(data);

    return {
      index,
      caseParams,
      title,
      chiefComplaint,
      hrRaw,
      hrRaw2,
      hr,
      ecgLabel,
      ecgLabel2,
      consistency,
      blanks,
      durationMs: elapsed,
      error: null,
    };
  } catch (err) {
    return { index, caseParams, error: err.message, durationMs: Date.now() - start };
  }
}

// ── Concurrency pool ────────────────────────────────────────────────────────

async function runWithConcurrency(tasks, limit) {
  const results = [];
  let i = 0;
  async function next() {
    while (i < tasks.length) {
      const idx = i++;
      const result = await tasks[idx]();
      results[idx] = result;
    }
  }
  const workers = Array.from({ length: limit }, () => next());
  await Promise.all(workers);
  return results;
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\nFiring ${CASES.length} requests (${CONCURRENCY} concurrent) → ${BASE_URL}\n`);

  const tasks = CASES.map((c, i) => () => runCase(c, i + 1));
  const results = await runWithConcurrency(tasks, CONCURRENCY);

  // Per-result log
  for (const r of results) {
    const tag = `[${String(r.index).padStart(2, '0')}]`;
    if (r.error) {
      console.log(`${tag} ERROR  sem=${r.caseParams.semester} type=${r.caseParams.type} — ${r.error}`);
      continue;
    }
    const consistencyFlag = r.consistency.consistent === false ? '⚠ MISMATCH' :
                            r.consistency.consistent === null  ? '? NO-DATA' : '✓';
    const blankFlag = r.blanks.length > 0 ? `⚠ BLANKS(${r.blanks.length})` : '✓';
    const ecgProgression = r.ecgLabel2 && r.ecgLabel2 !== r.ecgLabel
      ? `ECG1=${r.ecgLabel}→ECG2=${r.ecgLabel2}`
      : `ECG1=${r.ecgLabel}`;
    console.log(
      `${tag} sem=${r.caseParams.semester} type=${r.caseParams.type.padEnd(11)} cplx=${r.caseParams.complexity.padEnd(7)}` +
      ` | HR=${String(r.hrRaw).padEnd(18)} ${ecgProgression.padEnd(55)}` +
      ` | ECG ${consistencyFlag.padEnd(12)} | Fields ${blankFlag}` +
      ` | "${r.title}" (${r.durationMs}ms)`
    );
    if (r.consistency.consistent === false) console.log(`       → ${r.consistency.reason}`);
    if (r.blanks.length)                    console.log(`       → blank: ${r.blanks.join(', ')}`);
  }

  // Summary
  const errors       = results.filter(r => r.error);
  const ok           = results.filter(r => !r.error);
  const mismatches   = ok.filter(r => r.consistency.consistent === false);
  const withBlanks   = ok.filter(r => r.blanks.length > 0);
  const titles       = ok.map(r => r.title).filter(Boolean);
  const titleCounts  = titles.reduce((acc, t) => { acc[t] = (acc[t] || 0) + 1; return acc; }, {});
  const repeated     = Object.entries(titleCounts).filter(([, n]) => n > 1).map(([t, n]) => `"${t}" ×${n}`);

  console.log('\n─────────────────────────────────────────────────────────');
  console.log(`SUMMARY  (${CASES.length} total)`);
  console.log(`  Errors:          ${errors.length}`);
  console.log(`  HR/ECG mismatch: ${mismatches.length}`);
  console.log(`  Blank fields:    ${withBlanks.length}`);
  console.log(`  Repeated titles: ${repeated.length ? repeated.join(', ') : 'none'}`);
  console.log(`  Passed (no issues): ${ok.filter(r => r.consistency.consistent !== false && r.blanks.length === 0).length}/${CASES.length}`);
  console.log('─────────────────────────────────────────────────────────\n');

  const output = {
    runAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    total: CASES.length,
    errors: errors.length,
    mismatches: mismatches.length,
    blankFieldCases: withBlanks.length,
    repeatedTitles: repeated,
    results: results.map(r => ({
      index: r.index,
      caseParams: r.caseParams,
      title: r.title || null,
      chiefComplaint: r.chiefComplaint || null,
      hrRaw: r.hrRaw || null,
      hrRaw2: r.hrRaw2 || null,
      ecgLabel: r.ecgLabel || null,
      ecgLabel2: r.ecgLabel2 || null,
      consistency: r.consistency || null,
      blanks: r.blanks || [],
      durationMs: r.durationMs,
      error: r.error || null,
    })),
  };

  await fs.writeFile(RESULTS_PATH, JSON.stringify(output, null, 2));
  console.log(`Full results saved to ${RESULTS_PATH}`);
}

main().catch(err => { console.error(err); process.exit(1); });
