import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FEW_SHOTS_PATH = path.resolve(__dirname, '../data/few-shot-scenarios.json');

const SEMESTERS = ['2', '3', '4'];
const COMPLEXITIES = ['Simple', 'Moderate', 'Complex'];
const CALL_TYPES = ['Medical', 'Trauma', 'Cardiac', 'Respiratory', 'Environmental'];
const ENVIRONMENTS = ['Urban', 'Rural', 'Wilderness', 'Industrial', 'Home', 'Public Space'];
const CURRENT_DIRECTIVE_SOURCES = [
  'BLS PCS 3.4 (2023)',
  'ALS PCS 5.4 (2025)',
  'OBHG ALS PCS Companion v5.4 (2025)'
];

const HIGH_PRIORITY_CELLS = CALL_TYPES.map((callType) => ({
  semester: '2',
  complexity: 'Simple',
  callType,
  minCount: 2
}));

const MEDICATION_KEYWORDS = [
  'asa', 'nitro', 'nitroglycerin', 'salbutamol', 'ventolin', 'atrovent',
  'dexamethasone', 'ondansetron', 'dimenhydrinate', 'ketorolac', 'glucagon',
  'dextrose', 'oral glucose', 'epinephrine', 'naloxone', 'txa', 'analgesia'
];
const HIGH_BURDEN_KEYWORDS = [
  'narrow', 'stairs', 'crowd', 'bystander', 'family pressure', 'wilderness',
  'industrial', 'locked', 'public', 'remote', 'emotional', 'limited space',
  'packaging', 'extrication'
];

function normalizeCallType(value = '') {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return 'Medical';
  const exact = CALL_TYPES.find((item) => item.toLowerCase() === raw);
  if (exact) return exact;

  if (/arrest|chest pain|stemi|acs|cardiac|palpitation|arrhythm/.test(raw)) return 'Cardiac';
  if (/asthma|copd|respir|wheez|shortness of breath|anaphyl/.test(raw)) return 'Respiratory';
  if (/trauma|fall|mvc|collision|fracture|injury|blunt|head injury/.test(raw)) return 'Trauma';
  if (/heat|cold|exposure|carbon monoxide|river|heater|environment/.test(raw)) return 'Environmental';
  return 'Medical';
}

function normalizeEnvironment(value = '') {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return 'Urban';

  const exact = ENVIRONMENTS.find((item) => item.toLowerCase() === raw);
  if (exact) return exact;

  if (/farm|country|rural|cottage|barn/.test(raw)) return 'Rural';
  if (/trail|forest|camp|river|backcountry|wilderness|shoreline/.test(raw)) return 'Wilderness';
  if (/warehouse|factory|industrial|construction|shop/.test(raw)) return 'Industrial';
  if (/home|residence|apartment|bedroom|bathroom|ltc|long term care|assisted living|retirement/.test(raw)) return 'Home';
  if (/mall|food court|arena|school|public|parking lot|lobby|community centre/.test(raw)) return 'Public Space';
  if (/urban|downtown|intersection|transit|condo/.test(raw)) return 'Urban';
  return 'Urban';
}

function countKeywordMatches(text, keywords) {
  const lower = String(text || '').toLowerCase();
  return keywords.reduce((total, keyword) => (lower.includes(keyword) ? total + 1 : total), 0);
}

function collectText(item) {
  return JSON.stringify({
    title: item?.title,
    scenarioIntro: item?.scenarioIntro,
    patientPresentation: item?.patientPresentation,
    incidentNarrative: item?.incidentNarrative,
    expectedTreatment: item?.expectedTreatment,
    protocolNotes: item?.protocolNotes,
    teachersPoints: item?.teachersPoints,
    clinicalReasoning: item?.clinicalReasoning,
    sceneArrival: item?.sceneArrival,
    historyGathering: item?.historyGathering,
    transportPhase: item?.transportPhase
  });
}

function inferMetadata(item) {
  const metadata = item?.generationMetadata || item?.metadata || {};
  const text = collectText(item);
  const lowerText = text.toLowerCase();

  const callType = normalizeCallType(
    metadata.callType || metadata.type || item?.callInformation?.type || ''
  );

  const environment = normalizeEnvironment(
    metadata.environment ||
    metadata.environmentTag ||
    item?.callInformation?.environment ||
    item?.callInformation?.location ||
    (item?.sceneArrival?.environmentDetails || []).join(' ')
  );

  const additionalSetCount = (item?.vitalSigns?.additionalSets || []).length;
  const hazardCount = (item?.sceneArrival?.hazards || []).length;
  const contradictionCount = (item?.historyGathering?.contradictionsOrBarriers || []).length;
  const bystanderCount = (item?.historyGathering?.bystanderInformation || []).length;
  const medicationScore = countKeywordMatches(text, MEDICATION_KEYWORDS);
  const burdenScore =
    hazardCount +
    contradictionCount +
    bystanderCount +
    additionalSetCount +
    (item?.sceneArrival?.accessIssues ? 1 : 0) +
    (item?.transportPhase?.transportConsiderations || []).length +
    countKeywordMatches(text, HIGH_BURDEN_KEYWORDS);

  let complexity = String(metadata.complexity || metadata.targetComplexity || '').trim();
  if (!COMPLEXITIES.includes(complexity)) {
    if (burdenScore >= 9 || additionalSetCount >= 2) complexity = 'Complex';
    else if (burdenScore >= 4 || additionalSetCount >= 1 || medicationScore >= 1) complexity = 'Moderate';
    else complexity = 'Simple';
  }

  let semester = String(metadata.semester || metadata.targetSemester || '').trim();
  if (!SEMESTERS.includes(semester)) {
    if (medicationScore === 0 && additionalSetCount === 0 && burdenScore <= 3) semester = '2';
    else if (additionalSetCount >= 2 || burdenScore >= 8) semester = '4';
    else semester = '3';
  }

  const hasMeds = typeof metadata.hasMeds === 'boolean' ? metadata.hasMeds : medicationScore > 0;
  const vitalSetCount = Number.isFinite(Number(metadata.vitalSetCount))
    ? Number(metadata.vitalSetCount)
    : 2 + additionalSetCount;
  const cueDensity = Number.isFinite(Number(metadata.cueDensity))
    ? Number(metadata.cueDensity)
    : (lowerText.match(/\(💡/g) || []).length;

  return { callType, semester, complexity, environment, hasMeds, vitalSetCount, cueDensity };
}

function buildMatrixKey({ semester, complexity, callType }) {
  return `${semester}|${complexity}|${callType}`;
}

function buildAllCells() {
  const cells = [];
  for (const semester of SEMESTERS) {
    for (const complexity of COMPLEXITIES) {
      for (const callType of CALL_TYPES) {
        cells.push({ semester, complexity, callType });
      }
    }
  }
  return cells;
}

function parseFlags(argv) {
  return {
    strict: argv.includes('--strict'),
    requireMetadata: argv.includes('--require-metadata')
  };
}

function canonicalizeDirectiveSource(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const lower = raw.toLowerCase();

  if (lower.includes('bls')) return CURRENT_DIRECTIVE_SOURCES[0];
  if (lower.includes('als')) return CURRENT_DIRECTIVE_SOURCES[1];
  if (lower.includes('companion')) return CURRENT_DIRECTIVE_SOURCES[2];
  return raw;
}

async function main() {
  const flags = parseFlags(process.argv.slice(2));
  const raw = await fs.readFile(FEW_SHOTS_PATH, 'utf8');
  const fewShots = JSON.parse(raw);

  const matrix = new Map();
  const callTypeCounts = new Map(CALL_TYPES.map((type) => [type, 0]));
  const environmentCounts = new Map(ENVIRONMENTS.map((env) => [env, 0]));

  const metadataFieldNames = ['semester', 'complexity', 'callType', 'environment', 'hasMeds', 'vitalSetCount', 'cueDensity'];
  const metadataMissingEntries = [];
  const directiveSourceIssues = [];

  for (const item of fewShots) {
    const inferred = inferMetadata(item);
    const key = buildMatrixKey(inferred);
    matrix.set(key, (matrix.get(key) || 0) + 1);
    callTypeCounts.set(inferred.callType, (callTypeCounts.get(inferred.callType) || 0) + 1);
    environmentCounts.set(inferred.environment, (environmentCounts.get(inferred.environment) || 0) + 1);

    const explicitMetadata = item?.generationMetadata || item?.metadata || {};
    const missing = metadataFieldNames.filter((field) => explicitMetadata[field] == null);
    if (missing.length) {
      metadataMissingEntries.push({ title: item?.title || 'Untitled', missing });
    }

    const title = item?.title || 'Untitled';
    const sources = Array.isArray(item?.directiveSources) ? item.directiveSources : [];
    if (!sources.length) {
      directiveSourceIssues.push({ title, issue: 'missing directiveSources', observed: [] });
    } else {
      const canonical = [...new Set(sources.map((s) => canonicalizeDirectiveSource(s)).filter(Boolean))];
      const stale = canonical.some((source) => !CURRENT_DIRECTIVE_SOURCES.includes(source));
      const hasVersionDrift = sources.some((source) => {
        const raw = String(source || '');
        return /\(2026\)|5\.1/.test(raw);
      });

      if (stale || hasVersionDrift) {
        directiveSourceIssues.push({
          title,
          issue: hasVersionDrift ? 'outdated directive source version label' : 'non-canonical directive source label',
          observed: sources
        });
      }
    }
  }

  const allCells = buildAllCells();
  const missingCells = allCells.filter((cell) => !matrix.get(buildMatrixKey(cell)));

  const highPriorityDeficits = HIGH_PRIORITY_CELLS.filter((cell) => {
    const count = matrix.get(buildMatrixKey(cell)) || 0;
    return count < cell.minCount;
  }).map((cell) => ({ ...cell, count: matrix.get(buildMatrixKey(cell)) || 0 }));

  const callTypeValues = [...callTypeCounts.values()].filter((value) => value > 0);
  const maxCallTypeCount = Math.max(...callTypeValues);
  const minCallTypeCount = Math.min(...callTypeValues);
  const skewRatio = minCallTypeCount ? maxCallTypeCount / minCallTypeCount : Infinity;
  const skewThreshold = 2.5;
  const skewFlag = skewRatio > skewThreshold;

  const report = {
    totalFewShots: fewShots.length,
    coveredCells: allCells.length - missingCells.length,
    totalCells: allCells.length,
    missingCellCount: missingCells.length,
    highPriorityDeficitCount: highPriorityDeficits.length,
    callTypeCounts: Object.fromEntries(callTypeCounts),
    environmentCounts: Object.fromEntries(environmentCounts),
    callTypeSkewRatio: Number.isFinite(skewRatio) ? Number(skewRatio.toFixed(2)) : skewRatio,
    skewThreshold
  };

  console.log(JSON.stringify(report, null, 2));

  if (missingCells.length) {
    console.log('\nMissing matrix cells:');
    for (const cell of missingCells) {
      console.log(`- S${cell.semester} / ${cell.complexity} / ${cell.callType}`);
    }
  }

  if (highPriorityDeficits.length) {
    console.log('\nHigh-priority deficits (target >= 2):');
    for (const deficit of highPriorityDeficits) {
      console.log(`- S${deficit.semester} / ${deficit.complexity} / ${deficit.callType}: ${deficit.count}`);
    }
  }

  if (metadataMissingEntries.length) {
    console.log(`\nMetadata coverage gaps: ${metadataMissingEntries.length} entries missing one or more recommended fields.`);
    for (const row of metadataMissingEntries.slice(0, 12)) {
      console.log(`- ${row.title}: missing ${row.missing.join(', ')}`);
    }
    if (metadataMissingEntries.length > 12) {
      console.log(`- ... ${metadataMissingEntries.length - 12} more`);
    }
  }

  if (skewFlag) {
    console.log(`\nCall-type skew flagged: ratio ${report.callTypeSkewRatio} exceeds threshold ${skewThreshold}.`);
  }

  if (directiveSourceIssues.length) {
    console.log(`\nDirective source labeling issues: ${directiveSourceIssues.length} entries.`);
    for (const row of directiveSourceIssues.slice(0, 12)) {
      console.log(`- ${row.title}: ${row.issue}`);
      if (row.observed.length) {
        console.log(`  observed: ${row.observed.join(' | ')}`);
      }
    }
    if (directiveSourceIssues.length > 12) {
      console.log(`- ... ${directiveSourceIssues.length - 12} more`);
    }
  }

  let shouldFail = false;
  if (flags.strict) {
    shouldFail =
      missingCells.length > 0 ||
      highPriorityDeficits.length > 0 ||
      skewFlag ||
      directiveSourceIssues.length > 0;
  }

  if (flags.requireMetadata) {
    shouldFail = shouldFail || metadataMissingEntries.length > 0;
  }

  if (shouldFail) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('few-shot audit failed:', error);
  process.exitCode = 1;
});
