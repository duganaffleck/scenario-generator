import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const BASE_URL = 'https://scenario-backend.onrender.com/api/generate-scenario';
const CONCURRENCY = 3;
const RESULTS_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), 'stress-test-ecg-results.json');
const ORIGIN = 'https://scenario-generator-ten.vercel.app';

// ── Pattern picker (mirrors client/src/components/forms/ScenarioForm.js) ───

const VALID_PATTERNS = ['normal','inferiorSTEMI','anteriorSTEMI','lateralSTEMI','lbbb','rbbb','afib12','vtach12','inferiorRV','posterior','wellens','deWinter','inferolateralSTEMI','highLateralSTEMI','pericarditis','hyperkalemia','svt12','atrialFlutter12','firstDegreeAVBlock','secondDegreeTypeI','secondDegreeTypeII','thirdDegreeAVBlock'];

function pickTwelveLeadPattern(ecgType, rhythmInterp, twelveLeadFindings, fifteenLeadFindings, patternKey) {
  if (patternKey && VALID_PATTERNS.includes(patternKey)) return patternKey;
  const txt = ((twelveLeadFindings || '') + ' ' + (rhythmInterp || '')).toLowerCase().replace(/\s*-\s*/g, ' ');
  if (ecgType === '15-lead' || (fifteenLeadFindings && fifteenLeadFindings.trim().length > 10 && (fifteenLeadFindings.toLowerCase().includes('elevation') || fifteenLeadFindings.toLowerCase().includes('involvement') || fifteenLeadFindings.toLowerCase().includes('stemi') || fifteenLeadFindings.toLowerCase().includes('posterior')))) {
    if (txt.includes('posterior')) return 'posterior';
    return 'inferiorRV';
  }
  if (txt.includes('wellens') || txt.includes('lad warning') || txt.includes('biphasic t') || txt.includes('deep symmetric t') || txt.includes('symmetric t wave inversion') || txt.includes('deep t wave inversion') || ((txt.includes('t wave inversion') || txt.includes('t-wave inversion')) && (txt.includes('v2') || txt.includes('v3')))) return 'wellens';
  if (txt.includes('de winter') || txt.includes('winter t') || txt.includes('upsloping st depression') || txt.includes('upward sloping st depression')) return 'deWinter';
  if (txt.includes('pericarditis') || txt.includes('saddle') || txt.includes('pr depression')) return 'pericarditis';
  if (txt.includes('hyperkal') || txt.includes('tented t') || txt.includes('peaked narrow') || (txt.includes('peaked t') && (txt.includes('potassium') || txt.includes('dialysis') || txt.includes('renal') || txt.includes('flattened p') || txt.includes('widened qrs'))) || (txt.includes('widened qrs') && txt.includes('flattened p') && txt.includes('peaked'))) return 'hyperkalemia';
  if (txt.includes('high lateral') || (txt.includes('diagonal') && txt.includes('stemi')) || (txt.includes('avl') && (txt.includes('elevation in i') || txt.includes('in i and avl') || txt.includes('leads i and avl') || txt.includes('i, avl')))) return 'highLateralSTEMI';
  if (txt.includes('inferolateral') && !txt.includes('high lateral') && !(txt.includes('reciprocal') && txt.includes('inferior') && !txt.includes('inferior elevation') && !txt.includes('elevation in ii') && !txt.includes('elevation in iii') && !txt.includes('elevation in avf'))) return 'inferolateralSTEMI';
  if (txt.includes('left bundle') || txt.includes('lbbb') || (txt.includes('bundle branch block') && !txt.includes('right bundle') && !txt.includes('rbbb')) || (txt.includes('broad') && txt.includes('notched r') && (txt.includes('v5') || txt.includes('v6'))) || (txt.includes('rs complex') && txt.includes('v1') && txt.includes('lateral'))) return 'lbbb';
  if (txt.includes('right bundle') || txt.includes('rbbb') || (txt.includes('rsr') || txt.includes('r prime') || txt.includes('rsrʼ'))) return 'rbbb';
  if (txt.includes('anterior') && (txt.includes('stemi') || txt.includes('elevation') || txt.includes('v1') || txt.includes('v2') || txt.includes('v3') || txt.includes('v4'))) return 'anteriorSTEMI';
  if (txt.includes('lateral') && (txt.includes('stemi') || txt.includes('elevation')) && !txt.includes('inferolateral')) return 'lateralSTEMI';
  if (txt.includes('inferior') && (txt.includes('stemi') || txt.includes('elevation')) && !txt.includes('lateral') && !txt.includes('inferolateral')) return 'inferiorSTEMI';
  if (txt.includes('flutter')) return 'atrialFlutter12';
  if (txt.includes('fibrillation') || txt.includes('afib') || txt.includes('a-fib')) return 'afib12';
  if (txt.includes('supraventricular') || txt.includes('svt')) return 'svt12';
  if (txt.includes('ventricular tach') || txt.includes('vtach') || txt.includes('v-tach')) return 'vtach12';
  if (txt.includes('third degree') || txt.includes('complete heart block') || txt.includes('complete av block') || txt.includes('atrioventricular dissociation')) return 'thirdDegreeAVBlock';
  if (txt.includes('second degree type ii') || txt.includes('mobitz ii') || txt.includes('mobitz type ii') || txt.includes('mobitz 2') || txt.includes('type ii block')) return 'secondDegreeTypeII';
  if (txt.includes('second degree type i') || txt.includes('mobitz i') || txt.includes('mobitz type i') || txt.includes('wenckebach') || txt.includes('mobitz 1')) return 'secondDegreeTypeI';
  if (txt.includes('first degree') || txt.includes('prolonged pr') || txt.includes('pr prolongation') || txt.includes('pr interval prolongation')) return 'firstDegreeAVBlock';
  return 'normal';
}

// ── Test cases ──────────────────────────────────────────────────────────────

const CASES = [
  {
    label: 'Inferior STEMI',
    intended: 'inferiorSTEMI',
    params: { semester: '4', type: 'Cardiac', complexity: 'Complex', environment: 'Urban',
      customPrompt: 'Patient with crushing substernal chest pain radiating to the jaw. Generate a 12-lead ECG showing inferior STEMI with ST elevation in II, III, and aVF with reciprocal changes.' },
  },
  {
    label: 'Anterior STEMI',
    intended: 'anteriorSTEMI',
    params: { semester: '4', type: 'Cardiac', complexity: 'Complex', environment: 'Urban',
      customPrompt: 'Patient with anterior STEMI. ST elevation in V1 through V4. LAD occlusion. Generate 12-lead ECG findings.' },
  },
  {
    label: 'Lateral STEMI',
    intended: 'lateralSTEMI',
    params: { semester: '4', type: 'Cardiac', complexity: 'Complex', environment: 'Urban',
      customPrompt: 'Patient with lateral STEMI. ST elevation in I, aVL, V5, V6. Circumflex occlusion. Generate 12-lead ECG.' },
  },
  {
    label: 'Inferolateral STEMI',
    intended: 'inferolateralSTEMI',
    params: { semester: '4', type: 'Cardiac', complexity: 'Complex', environment: 'Urban',
      customPrompt: 'Patient presenting with inferolateral STEMI. ST elevation in II, III, aVF, V5, and V6. Inferior and lateral wall involvement. Generate 12-lead ECG.' },
  },
  {
    label: 'High Lateral STEMI',
    intended: 'highLateralSTEMI',
    params: { semester: '4', type: 'Cardiac', complexity: 'Complex', environment: 'Rural',
      customPrompt: 'Patient with high lateral STEMI involving the diagonal branch. ST elevation in I and aVL only, reciprocal changes in inferior leads. Generate 12-lead ECG.' },
  },
  {
    label: 'Posterior STEMI',
    intended: 'posterior',
    params: { semester: '4', type: 'Cardiac', complexity: 'Complex', environment: 'Urban',
      customPrompt: 'Patient with posterior STEMI. Tall R waves and ST depression in V1-V3 as mirror image. Generate 15-lead ECG with posterior lead findings in V7 V8 V9.' },
  },
  {
    label: 'RV STEMI (Inferior + RV)',
    intended: 'inferiorRV',
    params: { semester: '4', type: 'Cardiac', complexity: 'Complex', environment: 'Rural',
      customPrompt: 'Patient with inferior STEMI and right ventricular involvement. ST elevation in II, III, aVF and right-sided leads. Generate 15-lead ECG with V4R findings.' },
  },
  {
    label: 'Wellens Syndrome',
    intended: 'wellens',
    params: { semester: '4', type: 'Cardiac', complexity: 'Complex', environment: 'Urban',
      customPrompt: 'Patient with Wellens syndrome, LAD warning pattern. Deep symmetric T wave inversion in V2 and V3. Pain-free interval. Critical LAD stenosis. Generate 12-lead ECG.' },
  },
  {
    label: 'De Winter Pattern',
    intended: 'deWinter',
    params: { semester: '4', type: 'Cardiac', complexity: 'Complex', environment: 'Urban',
      customPrompt: 'Patient with De Winter T-wave pattern, STEMI equivalent. Upsloping ST depression in V1-V6 with tall peaked T waves. ST elevation in aVR. LAD occlusion. Generate 12-lead ECG.' },
  },
  {
    label: 'Pericarditis',
    intended: 'pericarditis',
    params: { semester: '3', type: 'Cardiac', complexity: 'Simple', environment: 'Urban',
      customPrompt: 'Young patient with pleuritic chest pain and pericarditis. Diffuse saddle-shaped ST elevation, PR depression in most leads, PR elevation in aVR. Generate 12-lead ECG.' },
  },
  {
    label: 'Hyperkalemia',
    intended: 'hyperkalemia',
    params: { semester: '4', type: 'Medical', complexity: 'Complex', environment: 'Urban',
      customPrompt: 'ESRD patient with missed dialysis. Hyperkalemia with peaked T waves on 12-lead ECG, widened QRS, prolonged PR, flattened P waves. Potassium 7.2. Generate 12-lead ECG.' },
  },
  {
    label: 'LBBB',
    intended: 'lbbb',
    params: { semester: '4', type: 'Cardiac', complexity: 'Complex', environment: 'Urban',
      customPrompt: 'Patient with left bundle branch block (LBBB). Wide QRS, broad notched R in lateral leads, rS in V1. Generate 12-lead ECG showing LBBB morphology.' },
  },
  {
    label: 'RBBB',
    intended: 'rbbb',
    params: { semester: '3', type: 'Cardiac', complexity: 'Simple', environment: 'Urban',
      customPrompt: 'Patient with right bundle branch block (RBBB). rSR prime in V1, broad terminal S wave in I and V6. Generate 12-lead ECG.' },
  },
  {
    label: 'AFib 12-lead',
    intended: 'afib12',
    params: { semester: '3', type: 'Cardiac', complexity: 'Complex', environment: 'Urban',
      customPrompt: 'Patient with atrial fibrillation on 12-lead ECG. Irregularly irregular rhythm, absent P waves, uncontrolled ventricular rate. Generate 12-lead ECG.' },
  },
  {
    label: 'SVT 12-lead',
    intended: 'svt12',
    params: { semester: '3', type: 'Cardiac', complexity: 'Simple', environment: 'Urban',
      customPrompt: 'Patient with supraventricular tachycardia (SVT). Narrow complex tachycardia at 180 bpm, absent P waves, regular rhythm. Generate 12-lead ECG.' },
  },
];

// ── Request runner ──────────────────────────────────────────────────────────

async function runCase(testCase, index) {
  const start = Date.now();
  const { label, intended, params } = testCase;
  try {
    const res = await fetch(BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': ORIGIN,
      },
      body: JSON.stringify({
        ...params,
        generationDepth: 'Quick Draft',
        shiftMode: 'Day Shift',
        scenarioFriction: 'Clean',
        includeBystanders: false,
        includeTeachingCues: false,
      }),
    });

    if (!res.ok) {
      return { index, label, intended, error: `HTTP ${res.status}`, durationMs: Date.now() - start };
    }

    const data = await res.json();
    const elapsed = Date.now() - start;

    const ecgFindings = data?.ecgFindings || {};
    const ecgType = ecgFindings.ecgType || '';
    const rhythmInterp = data?.vitalSigns?.firstSet?.ecgInterpretation || '';
    const twelveLeadFindings = ecgFindings.twelveLeadFindings || '';
    const fifteenLeadFindings = ecgFindings.fifteenLeadFindings || '';
    const modelKey = ecgFindings.patternKey || '';

    const picked = pickTwelveLeadPattern(ecgType, rhythmInterp, twelveLeadFindings, fifteenLeadFindings, modelKey);

    // Primary accuracy: modelKey vs intended (when model provided a key)
    // Secondary accuracy: text-match picked vs intended (when modelKey absent)
    const modelKeyPresent = modelKey && VALID_PATTERNS.includes(modelKey);
    const modelKeyMatch = modelKeyPresent ? modelKey === intended : null;
    const textMatch = pickTwelveLeadPattern(ecgType, rhythmInterp, twelveLeadFindings, fifteenLeadFindings, '') === intended;
    const match = modelKeyPresent ? modelKeyMatch : textMatch;

    return {
      index,
      label,
      intended,
      ecgType,
      modelKey,
      picked,
      match,
      modelKeyPresent,
      modelKeyMatch,
      textMatch,
      has12LeadFindings: !!twelveLeadFindings,
      has15LeadFindings: !!fifteenLeadFindings,
      twelveLeadFindingsSnippet: twelveLeadFindings.slice(0, 120),
      fifteenLeadFindingsSnippet: fifteenLeadFindings.slice(0, 80),
      durationMs: elapsed,
      error: null,
    };
  } catch (err) {
    return { index, label, intended, error: err.message, durationMs: Date.now() - start };
  }
}

// ── Concurrency pool ────────────────────────────────────────────────────────

async function runWithConcurrency(tasks, limit) {
  const results = [];
  let i = 0;
  async function next() {
    while (i < tasks.length) {
      const idx = i++;
      results[idx] = await tasks[idx]();
    }
  }
  await Promise.all(Array.from({ length: limit }, () => next()));
  return results;
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\nECG pattern stress test — ${CASES.length} cases (${CONCURRENCY} concurrent) → ${BASE_URL}\n`);

  const tasks = CASES.map((c, i) => () => runCase(c, i + 1));
  const results = await runWithConcurrency(tasks, CONCURRENCY);

  for (const r of results) {
    const tag = `[${String(r.index).padStart(2, '0')}]`;
    if (r.error) {
      console.log(`${tag} ERROR  ${r.label} — ${r.error}`);
      continue;
    }

    const matchFlag = r.match ? '✓ MATCH   ' : '✗ MISMATCH';
    const keyInfo = r.modelKey
      ? `modelKey=${r.modelKey.padEnd(22)} picked=${r.picked.padEnd(22)}`
      : `modelKey=(absent)              picked=${r.picked.padEnd(22)}`;

    console.log(
      `${tag} ${matchFlag} | intended=${r.intended.padEnd(22)} ${keyInfo}` +
      ` | ${r.label} (${r.durationMs}ms)`
    );

    if (!r.match) {
      if (r.modelKeyPresent && !r.modelKeyMatch) {
        console.log(`       ⚠ MODEL KEY WRONG: modelKey=${r.modelKey} intended=${r.intended}`);
      } else if (!r.modelKeyPresent && !r.textMatch) {
        console.log(`       ⚠ TEXT MATCH FAILED (no modelKey): findings="${r.twelveLeadFindingsSnippet}"`);
      }
      if (r.fifteenLeadFindingsSnippet) console.log(`       15L: "${r.fifteenLeadFindingsSnippet}"`);
    }
  }

  const ok           = results.filter(r => !r.error);
  const matched      = ok.filter(r => r.match);
  const missed       = ok.filter(r => !r.match);
  const errors       = results.filter(r => r.error);
  const withModelKey = ok.filter(r => r.modelKeyPresent);
  const modelKeyOk   = withModelKey.filter(r => r.modelKeyMatch);

  console.log('\n─────────────────────────────────────────────────────────');
  console.log(`SUMMARY  (${CASES.length} total)`);
  console.log(`  Errors:          ${errors.length}`);
  console.log(`  Matched:         ${matched.length}/${ok.length}`);
  console.log(`  Model key present: ${withModelKey.length}/${ok.length}  correct: ${modelKeyOk.length}/${withModelKey.length}`);
  console.log(`  Mismatched:      ${missed.length}`);
  if (missed.length) {
    console.log('  Mismatched cases:');
    missed.forEach(r => console.log(`    - ${r.label}: intended=${r.intended}, modelKey=${r.modelKey || '(absent)'}, picked=${r.picked}`));
  }
  console.log('─────────────────────────────────────────────────────────\n');

  await fs.writeFile(RESULTS_PATH, JSON.stringify({
    runAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    total: CASES.length,
    errors: errors.length,
    matched: matched.length,
    mismatched: missed.length,
    modelKeyPresentCount: withModelKey.length,
    modelKeyCorrectCount: modelKeyOk.length,
    results,
  }, null, 2));
  console.log(`Full results saved to ${RESULTS_PATH}`);
}

main().catch(err => { console.error(err); process.exit(1); });
