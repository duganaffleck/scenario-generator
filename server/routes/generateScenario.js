// Suppress redundant assessment fields if content is duplicated or highly similar
function suppressRedundantAssessments(merged) {
  // Helper to flatten and stringify assessment content
  function flattenAssessment(obj) {
    if (!obj) return '';
    if (Array.isArray(obj)) return obj.join(' ').toLowerCase().trim();
    if (typeof obj === 'object') return Object.values(obj).map(flattenAssessment).join(' ').toLowerCase().trim();
    return String(obj).toLowerCase().trim();
  }

  const initial = flattenAssessment(merged.initialAssessment);
  const secondary = flattenAssessment(merged.secondaryAssessment);
  const additional = flattenAssessment(merged.additionalAssessments);

  // If secondary is a subset of initial, suppress secondary
  if (secondary && initial && (initial.includes(secondary) || secondary === initial)) {
    merged.secondaryAssessment = {};
  }
  // If initial is a subset of secondary, suppress initial
  else if (secondary && initial && (secondary.includes(initial))) {
    merged.initialAssessment = {};
  }
  // If additional is a subset of either, suppress additional
  if (additional) {
    if ((initial && initial.includes(additional)) || (secondary && secondary.includes(additional))) {
      merged.additionalAssessments = [];
    }
  }
}

import express from 'express';
import { generateScenario } from '../controllers/scenarioController.js';

const router = express.Router();

router.post('/', generateScenario);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const INSTRUCTOR_PROFILE_PATH = path.resolve(
  __dirname,
  '../data/scenario-instructor-profile.txt'
);

const FEW_SHOTS_PATH = path.resolve(
  __dirname,
  '../data/few-shot-scenarios.json'
);

const SCENARIO_MODIFIERS_PATH = path.resolve(
  __dirname,
  '../data/scenario-modifiers.json'
);

const ALS_STANDARDS_PATH = path.resolve(
  __dirname,
  '../data/als-standards.txt'
);

const BLS_STANDARDS_PATH = path.resolve(
  __dirname,
  '../data/bls-standards.txt'
);

let instructorProfileCache = null;
let fewShotsCache = null;
let scenarioModifiersCache = null;
let alsStandardsCache = null;
let blsStandardsCache = null;

async function loadInstructorProfile() {
  if (instructorProfileCache) return instructorProfileCache;
  instructorProfileCache = await fs.readFile(INSTRUCTOR_PROFILE_PATH, 'utf8');
  return instructorProfileCache;
}

async function loadFewShots() {
  if (fewShotsCache) return fewShotsCache;
  const raw = await fs.readFile(FEW_SHOTS_PATH, 'utf8');
  fewShotsCache = JSON.parse(raw);
  return fewShotsCache;
}

async function loadScenarioModifiers() {
  if (scenarioModifiersCache) return scenarioModifiersCache;
  const raw = await fs.readFile(SCENARIO_MODIFIERS_PATH, 'utf8');
  scenarioModifiersCache = JSON.parse(raw);
  return scenarioModifiersCache;
}

async function loadAlsStandards() {
  if (alsStandardsCache) return alsStandardsCache;
  alsStandardsCache = await fs.readFile(ALS_STANDARDS_PATH, 'utf8');
  return alsStandardsCache;
}

async function loadBlsStandards() {
  if (blsStandardsCache) return blsStandardsCache;
  blsStandardsCache = await fs.readFile(BLS_STANDARDS_PATH, 'utf8');
  return blsStandardsCache;
}

function stableHash(value = '') {
  const text = String(value || '');
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function pickRotating(items, maxItems, seed, bucket) {
  const pool = Array.from(
    new Set((items || []).map((item) => String(item || '').trim()).filter(Boolean))
  );

  if (!pool.length || maxItems <= 0) return [];
  if (pool.length <= maxItems) return pool;

  const start = stableHash(`${bucket}|${seed}`) % pool.length;
  const picked = [];
  for (let index = 0; index < pool.length && picked.length < maxItems; index += 1) {
    picked.push(pool[(start + index) % pool.length]);
  }
  return picked;
}

function parseAlsStandardSections(raw = '') {
  const lines = String(raw || '').split(/\r?\n/);
  const sections = [];
  let current = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || /^─+$/.test(line) || /^Source:|^Scope:/.test(line)) continue;

    const headingMatch = line.match(/^\d+\.\s+(.+)$/);
    if (headingMatch) {
      if (current) sections.push(current);
      current = { title: headingMatch[1].trim(), lines: [] };
      continue;
    }

    if (!current) continue;
    current.lines.push(line);
  }

  if (current) sections.push(current);
  return sections;
}

function parseBlsStandardSections(raw = '') {
  const lines = String(raw || '').split(/\r?\n/);
  const sections = [];
  let current = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || /^#\s+/.test(line)) continue;

    const markdownHeading = line.match(/^##\s+(.+)$/);
    const inlineHeading = line.match(/^[A-Z][A-Za-z0-9 /&()\-]+:$/);

    if (markdownHeading || inlineHeading) {
      if (current) sections.push(current);
      current = {
        title: (markdownHeading?.[1] || inlineHeading?.[0].slice(0, -1) || '').trim(),
        lines: []
      };
      continue;
    }

    if (!current) continue;
    current.lines.push(line);
  }

  if (current) sections.push(current);
  return sections;
}

function summarizeStandardSection(section, maxItems = 2) {
  if (!section?.lines?.length || maxItems <= 0) return [];

  const bullets = [];
  let currentLabel = '';

  for (const line of section.lines) {
    if (/^(Indications|Treatment|Conditions|Contraindications|Transport if|Notes)$/i.test(line.replace(/:$/, ''))) {
      currentLabel = line.replace(/:$/, '');
      continue;
    }

    if (!/^[-•]/.test(line)) continue;

    const text = line.replace(/^[-•]\s*/, '').trim();
    if (!text || /^or$/i.test(text)) continue;

    bullets.push(currentLabel ? `${currentLabel}: ${text}` : text);
    if (bullets.length >= maxItems) break;
  }

  return bullets;
}

function findSectionsByTitle(sections, titleFragments = []) {
  return titleFragments
    .map((fragment) => sections.find((section) => section.title.toLowerCase().includes(fragment.toLowerCase())))
    .filter(Boolean);
}

function buildDirectiveMetaAddendum() {
  const versions = ONTARIO_DIRECTIVE_META?.versions || {};
  const principles = (ONTARIO_DIRECTIVE_META?.governance?.principles || []).slice(0, 3);
  const lines = [];

  const versionSummary = [versions.bls, versions.als, versions.companion, versions.memo]
    .filter(Boolean)
    .map((entry) => `${entry.name} ${entry.version} (${entry.effectiveDate})`)
    .join('; ');

  if (versionSummary) {
    lines.push(`Use these Ontario directive references as current: ${versionSummary}.`);
  }

  for (const principle of principles) {
    lines.push(principle);
  }

  return lines;
}

function buildStandardsPromptAddendum({ callType, semester, alsText, blsText }) {
  const lines = [];
  const alsSections = parseAlsStandardSections(alsText);
  const blsSections = parseBlsStandardSections(blsText);
  const normalizedType = normalizeCallFamily(callType);
  const includeMedicationDetails = String(semester) !== '2';

  const blsTitleMap = {
    Cardiac: ['Oxygen Administration (BLS PCS)', 'Transport Decision Rules'],
    Respiratory: ['Oxygen Administration (BLS PCS)', 'Airway Management', 'Transport Decision Rules'],
    Trauma: ['Spinal Motion Restriction (SMR) Standard', 'Transport Decision Rules'],
    Environmental: ['Scene Safety and PPE Requirements', 'Oxygen Administration (BLS PCS)', 'Transport Decision Rules'],
    Medical: ['Blood Glucose Testing', 'Transport Decision Rules', 'Refusal of Service Criteria']
  };

  const alsTitleMap = {
    Cardiac: includeMedicationDetails
      ? ['Cardiac Ischemia (PCP + PCP-IV)', 'ROSC – Return of Spontaneous Circulation (PCP)']
      : ['Medical Cardiac Arrest (PCP)', 'ROSC – Return of Spontaneous Circulation (PCP)'],
    Respiratory: includeMedicationDetails
      ? ['Bronchoconstriction (PCP)', 'CPAP (PCP-Certified)']
      : ['CPAP (PCP-Certified)'],
    Trauma: includeMedicationDetails
      ? ['TXA – Tranexamic Acid (PCP-IV)', 'Pain Management (PCP-IV)']
      : [],
    Environmental: includeMedicationDetails
      ? ['Allergic Reaction / Anaphylaxis (PCP + PCP-IV)']
      : [],
    Medical: includeMedicationDetails
      ? ['Hypoglycemia (PCP + PCP-IV)', 'Stroke / TIA (PCP)', 'Pain Management (PCP-IV)']
      : ['Stroke / TIA (PCP)']
  };

  if (!includeMedicationDetails) {
    lines.push('Semester 2: keep Ontario assessment, transport, and reassessment logic, but do not add medication administration.');
  }

  const selectedBlsSections = findSectionsByTitle(blsSections, ['Vital Signs Required', ...(blsTitleMap[normalizedType] || [])]);
  if (selectedBlsSections.length) {
    lines.push('Ontario BLS snippets to reflect when relevant:');
    for (const section of selectedBlsSections.slice(0, 3)) {
      const isVitalSignsSection = section.title.includes('Vital Signs');
      const isSmrSection = section.title.includes('Spinal Motion Restriction');
      const bullets = summarizeStandardSection(section, isVitalSignsSection ? 3 : isSmrSection ? 4 : 2);
      for (const bullet of bullets) {
        lines.push(`- ${section.title}: ${bullet}`);
      }

      if (isSmrSection) {
        lines.push('- Spinal Motion Restriction (SMR) Standard: Age over 65 with a history of a fall independently meets Ontario SMR criteria; do not dismiss collar/SMR because the fall seems minor.');
      }
    }
  }

  const selectedAlsSections = findSectionsByTitle(alsSections, alsTitleMap[normalizedType] || []);
  if (selectedAlsSections.length) {
    lines.push('Ontario ALS snippets to reflect when relevant:');
    for (const section of selectedAlsSections.slice(0, 2)) {
      const bullets = summarizeStandardSection(section, 2);
      for (const bullet of bullets) {
        lines.push(`- ${section.title}: ${bullet}`);
      }
    }
  }

  return lines;
}

function buildScenarioModifierAddendum(modifiers, {
  callType,
  environment,
  complexity,
  variationSeed = 0
} = {}) {
  const normalizedType = normalizeCallFamily(callType);
  const normalizedComplexity = normalizeComplexity(complexity) || 'Moderate';
  const normalizedEnvironment = normalizeEnvironment(environment) || 'Urban';
  const categoryMap = {
    Cardiac: ['interpersonalChaos', 'equipmentIssues', 'unexpectedPatientBehavior'],
    Respiratory: ['equipmentIssues', 'interpersonalChaos', 'unexpectedPatientBehavior'],
    Trauma: ['environmentalComplications', 'equipmentIssues', 'interpersonalChaos'],
    Environmental: ['environmentalComplications', 'equipmentIssues', 'ethicalDilemmas'],
    Medical: ['interpersonalChaos', 'ethicalDilemmas', 'unexpectedPatientBehavior']
  };
  const environmentBoost = {
    Wilderness: 'environmentalComplications',
    Industrial: 'environmentalComplications',
    Rural: 'environmentalComplications',
    'Public Space': 'interpersonalChaos',
    Home: 'ethicalDilemmas'
  };
  const targetCount = normalizedComplexity === 'Simple' ? 1 : normalizedComplexity === 'Moderate' ? 2 : 3;
  const preferredCategories = [
    environmentBoost[normalizedEnvironment],
    ...(categoryMap[normalizedType] || [])
  ].filter(Boolean);
  const selectedCategories = pickRotating(preferredCategories, targetCount, `${normalizedType}|${normalizedEnvironment}|${variationSeed}`, 'modifier-categories');

  const lines = [
    `Use ${normalizedComplexity === 'Simple' ? 'at most 1' : normalizedComplexity === 'Moderate' ? '1 or 2' : '2 or 3'} optional complication modifiers only if they materially deepen assessment, access, communication, or transport.`
  ];

  for (const category of selectedCategories) {
    const options = pickRotating(modifiers?.[category] || [], 1, `${category}|${variationSeed}|${normalizedType}`, 'modifier-options');
    for (const option of options) {
      lines.push(`- ${option}`);
    }
  }

  return lines;
}

const CALL_TYPE_FAMILIES = ['Medical', 'Trauma', 'Cardiac', 'Respiratory', 'Environmental'];
const ENVIRONMENT_CHOICES = ['Urban', 'Rural', 'Wilderness', 'Industrial', 'Home', 'Public Space'];
const COMPLEXITY_ORDER = { Simple: 0, Moderate: 1, Complex: 2 };
const DAY_SHIFT_TIMES = ['07:18', '09:42', '11:26', '13:14', '15:08', '16:37'];
const NIGHT_SHIFT_TIMES = ['22:18', '23:46', '00:34', '01:57', '03:12', '04:41'];
const MEDICATION_KEYWORDS = [
  'asa',
  'nitro',
  'nitroglycerin',
  'salbutamol',
  'ventolin',
  'atrovent',
  'dexamethasone',
  'ondansetron',
  'dimenhydrinate',
  'ketorolac',
  'glucagon',
  'dextrose',
  'oral glucose',
  'epinephrine',
  'naloxone',
  'txa',
  'analgesia'
];
const WITHHOLDING_KEYWORDS = [
  'withhold',
  'contraindication',
  'do not give',
  'hold',
  'right-sided',
  '12-lead before nitro',
  'destination',
  'transport priority'
];
const HIGH_BURDEN_KEYWORDS = [
  'narrow',
  'stairs',
  'crowd',
  'bystander',
  'family pressure',
  'wilderness',
  'industrial',
  'locked',
  'public',
  'remote',
  'emotional',
  'limited space',
  'packaging',
  'extrication'
];
const HIGH_ACUITY_KEYWORDS = [
  'cyanosis',
  'accessory muscle',
  'tripod',
  'severe distress',
  'unable to speak',
  'altered mental status',
  'shock',
  'hypotension',
  'pulmonary edema',
  'crackles bilaterally'
];

function normalizeCallFamily(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return 'Medical';

  const lower = raw.toLowerCase();
  const exact = CALL_TYPE_FAMILIES.find((item) => item.toLowerCase() === lower);
  if (exact) return exact;

  if (/arrest|chest pain|stemi|acs|cardiac|palpitation|arrhythm/i.test(lower)) return 'Cardiac';
  if (/asthma|copd|respir|wheez|shortness of breath|anaphyl/i.test(lower)) return 'Respiratory';
  if (/trauma|fall|mvc|collision|fracture|injury|blunt|head injury/i.test(lower)) return 'Trauma';
  if (/heat|cold|exposure|carbon monoxide|river|heater|environment/i.test(lower)) return 'Environmental';
  return 'Medical';
}

function devLog(...args) {
  if (!IS_PRODUCTION) {
    console.log(...args);
  }
}

function devWarn(...args) {
  if (!IS_PRODUCTION) {
    console.warn(...args);
  }
}

function coerceBoolean(value, defaultValue = true) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  }
  return defaultValue;
}

function normalizeEnvironment(value) {
  const env = String(value || '').trim();
  if (!env) return 'Urban';
  const exact = ALLOWED_ENVIRONMENTS.find((item) => item.toLowerCase() === env.toLowerCase());
  return exact || null;
}

function normalizeComplexity(value) {
  const complexity = String(value || '').trim();
  if (!complexity) return 'Moderate';
  const exact = ALLOWED_COMPLEXITIES.find((item) => item.toLowerCase() === complexity.toLowerCase());
  return exact || null;
}

function normalizeShiftMode(value) {
  const shiftMode = String(value || '').trim();
  if (!shiftMode) return null;
  const exact = ALLOWED_SHIFT_MODES.find((item) => item.toLowerCase() === shiftMode.toLowerCase());
  return exact || null;
}

function validateGenerationRequest(rawBody = {}) {
  const errors = [];
  const semester = String(rawBody.semester || '3').trim();
  const normalizedCallType = normalizeCallFamily(rawBody.callType || rawBody.type || 'Medical');
  const environment = normalizeEnvironment(rawBody.environment);
  const complexity = normalizeComplexity(rawBody.complexity);
  const shiftMode = normalizeShiftMode(rawBody.shiftMode) || 'Day Shift';
  const normalizedComplexity = semester === '2' ? 'Simple' : (complexity || 'Moderate');

  if (!ALLOWED_SEMESTERS.includes(semester)) {
    errors.push(`Invalid semester "${semester}". Allowed values: ${ALLOWED_SEMESTERS.join(', ')}.`);
  }

  if (!environment) {
    errors.push(`Invalid environment "${rawBody.environment}".`);
  }

  if (!complexity) {
    errors.push(`Invalid complexity "${rawBody.complexity}".`);
  }

  if (rawBody.shiftMode && !normalizeShiftMode(rawBody.shiftMode)) {
    errors.push(`Invalid shift mode "${rawBody.shiftMode}". Allowed values: ${ALLOWED_SHIFT_MODES.join(', ')}.`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    value: {
      semester,
      callType: normalizedCallType,
      environment: environment || 'Urban',
      complexity: normalizedComplexity,
      shiftMode,
      includeTeachingCues: coerceBoolean(rawBody.includeTeachingCues, true),
      customPrompt: sanitizeCustomPrompt(rawBody.customPrompt || '')
    }
  };
}

function complexityDistance(a, b) {
  const aValue = COMPLEXITY_ORDER[a] ?? COMPLEXITY_ORDER.Moderate;
  const bValue = COMPLEXITY_ORDER[b] ?? COMPLEXITY_ORDER.Moderate;
  return Math.abs(aValue - bValue);
}

function countKeywordMatches(text, keywords) {
  const lower = String(text || '').toLowerCase();
  return keywords.reduce((total, keyword) => (lower.includes(keyword) ? total + 1 : total), 0);
}

function normalizeEnvironmentTag(value = '') {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return '';

  const exact = ENVIRONMENT_CHOICES.find((item) => item.toLowerCase() === raw);
  if (exact) return exact;

  if (/farm|country|rural|cottage|barn/.test(raw)) return 'Rural';
  if (/trail|forest|camp|river|backcountry|wilderness|shoreline/.test(raw)) return 'Wilderness';
  if (/warehouse|factory|industrial|construction|shop/.test(raw)) return 'Industrial';
  if (/home|residence|apartment|bedroom|bathroom|l?tc|long term care|assisted living|retirement/.test(raw)) return 'Home';
  if (/mall|food court|arena|school|public|parking lot|lobby|community centre/.test(raw)) return 'Public Space';
  if (/urban|downtown|intersection|transit|condo/.test(raw)) return 'Urban';
  return '';
}

function extractHourFromTimeText(value = '') {
  const text = String(value || '').trim().toLowerCase();
  if (!text) return null;

  const twentyFourHourMatch = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (twentyFourHourMatch) return Number(twentyFourHourMatch[1]);

  const meridiemMatch = text.match(/\b(1[0-2]|0?\d)(?::([0-5]\d))?\s*(am|pm)\b/);
  if (meridiemMatch) {
    let hour = Number(meridiemMatch[1]) % 12;
    if (meridiemMatch[3] === 'pm') hour += 12;
    return hour;
  }

  if (/\bmidnight\b/.test(text)) return 0;
  if (/\bnoon\b/.test(text)) return 12;
  if (/\bovernight\b|\bafter midnight\b|\bpre-?dawn\b|\blate night\b/.test(text)) return 2;
  if (/\bmid-?morning\b|\bafternoon\b|\bdaylight\b/.test(text)) return 13;
  return null;
}

function inferShiftModeFromText(value = '') {
  const text = String(value || '').toLowerCase();
  if (!text) return '';
  if (/\bnight shift\b|\bovernight\b|\bafter midnight\b|\bpre-?dawn\b|\blate night\b/.test(text)) return 'Night Shift';
  if (/\bday shift\b|\bmid-?morning\b|\bafternoon\b|\bdaylight\b|\bbusiness hours\b/.test(text)) return 'Day Shift';
  return '';
}

function timeMatchesShiftMode(timeText, shiftMode) {
  const hour = extractHourFromTimeText(timeText);
  if (hour === null) {
    const inferred = inferShiftModeFromText(timeText);
    return inferred ? inferred === shiftMode : false;
  }

  return shiftMode === 'Night Shift'
    ? hour >= 22 || hour < 6
    : hour >= 6 && hour < 22;
}

function pickShiftTime(shiftMode, seedHint = '') {
  const times = shiftMode === 'Night Shift' ? NIGHT_SHIFT_TIMES : DAY_SHIFT_TIMES;
  return times[stableHash(`${shiftMode}|${seedHint}`) % times.length];
}

function alignTimeToShiftMode(timeText, shiftMode, seedHint = '') {
  const trimmed = String(timeText || '').trim();
  if (trimmed && timeMatchesShiftMode(trimmed, shiftMode)) return trimmed;
  return pickShiftTime(shiftMode, seedHint);
}

function inferScenarioShiftMode(scenario) {
  const explicit = normalizeShiftMode(scenario?.callInformation?.shift || scenario?.callInformation?.shiftMode || '');
  if (explicit) return explicit;

  const hour = extractHourFromTimeText(scenario?.callInformation?.time || '');
  if (hour !== null) {
    return hour >= 22 || hour < 6 ? 'Night Shift' : 'Day Shift';
  }

  const text = [
    scenario?.callInformation?.time,
    scenario?.scenarioIntro,
    scenario?.incidentNarrative,
    scenario?.sceneArrival?.sceneDescription,
    ...(scenario?.sceneArrival?.environmentDetails || []),
    ...(scenario?.callInformation?.dispatchNotes || [])
  ].filter(Boolean).join(' ');

  return inferShiftModeFromText(text);
}

function collectFewShotText(item) {
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

function inferFewShotMetadata(item) {
  const metadata = item?.generationMetadata || item?.metadata || {};
  const text = collectFewShotText(item);
  const lowerText = text.toLowerCase();
  const callFamily = normalizeCallFamily(
    metadata.callType || metadata.type || item?.callInformation?.type || ''
  );
  const inferredEnvironment =
    normalizeEnvironmentTag(
      metadata.environment ||
      metadata.environmentTag ||
      item?.callInformation?.environment ||
      item?.callInformation?.location ||
      (item?.sceneArrival?.environmentDetails || []).join(' ')
    ) ||
    'Urban';

  const hazardCount = (item?.sceneArrival?.hazards || []).length;
  const environmentCount = (item?.sceneArrival?.environmentDetails || []).length;
  const contradictionCount = (item?.historyGathering?.contradictionsOrBarriers || []).length;
  const bystanderCount = (item?.historyGathering?.bystanderInformation || []).length;
  const additionalSetCount = (item?.vitalSigns?.additionalSets || []).length;
  const medicationScore = countKeywordMatches(text, MEDICATION_KEYWORDS);
  const withholdingScore = countKeywordMatches(text, WITHHOLDING_KEYWORDS);
  const explicitVitalSetCount = Number(metadata.vitalSetCount);
  const inferredVitalSetCount = 2 + additionalSetCount;
  const vitalSetCount = Number.isFinite(explicitVitalSetCount) && explicitVitalSetCount > 0
    ? explicitVitalSetCount
    : inferredVitalSetCount;
  const cueMarkerCount = (lowerText.match(/\(💡/g) || []).length;
  const cueDensity = Number.isFinite(Number(metadata.cueDensity))
    ? Number(metadata.cueDensity)
    : cueMarkerCount;
  const hasMeds = typeof metadata.hasMeds === 'boolean' ? metadata.hasMeds : medicationScore > 0;

  const burdenScore =
    hazardCount +
    contradictionCount +
    bystanderCount +
    additionalSetCount +
    (item?.sceneArrival?.accessIssues ? 1 : 0) +
    (item?.transportPhase?.transportConsiderations || []).length +
    Math.min(environmentCount, 2) +
    countKeywordMatches(text, HIGH_BURDEN_KEYWORDS);

  let inferredComplexity = metadata.targetComplexity || metadata.complexity;
  if (!inferredComplexity) {
    if (burdenScore >= 9 || additionalSetCount >= 2 || withholdingScore >= 2) {
      inferredComplexity = 'Complex';
    } else if (burdenScore >= 4 || additionalSetCount >= 1 || medicationScore >= 1) {
      inferredComplexity = 'Moderate';
    } else {
      inferredComplexity = 'Simple';
    }
  }

  let inferredSemester = String(metadata.targetSemester || metadata.semester || '').trim();
  if (!['2', '3', '4'].includes(inferredSemester)) {
    if (medicationScore === 0 && additionalSetCount === 0 && burdenScore <= 3) {
      inferredSemester = '2';
    } else if (withholdingScore >= 2 || additionalSetCount >= 2 || burdenScore >= 8) {
      inferredSemester = '4';
    } else {
      inferredSemester = '3';
    }
  }

  return {
    callFamily,
    semester: inferredSemester,
    complexity: inferredComplexity,
    environment: inferredEnvironment,
    hasMeds,
    vitalSetCount,
    cueDensity,
    medicationScore,
    burdenScore,
    title: item?.title || 'Untitled example'
  };
}

function scoreFewShotMatch(item, request) {
  const metadata = inferFewShotMetadata(item);
  const requestType = normalizeCallFamily(request?.callType || 'Medical');
  const requestSemester = String(request?.semester || '3');
  const requestComplexity = String(request?.complexity || 'Moderate');
  const requestEnvironment = String(request?.environment || 'Urban');
  const requestSubtype = String(request?.subtype || '').toLowerCase();
  const itemText = collectFewShotText(item).toLowerCase();

  let score = 0;

  if (metadata.callFamily === requestType) score += 12;
  if (metadata.semester === requestSemester) score += 7;
  else if (Math.abs(Number(metadata.semester) - Number(requestSemester)) === 1) score += 3;

  if (metadata.environment === requestEnvironment) score += 5;

  const complexityGap = complexityDistance(metadata.complexity, requestComplexity);
  if (complexityGap === 0) score += 6;
  else if (complexityGap === 1) score += 2;

  if (requestSemester === '2' && metadata.hasMeds) score -= 3;
  if (requestComplexity === 'Simple' && metadata.vitalSetCount > 3) score -= 2;
  if (requestComplexity === 'Complex' && metadata.vitalSetCount >= 3) score += 2;

  if (requestSubtype && itemText.includes(requestSubtype.replace(/_/g, ' '))) {
    score += 2;
  }

  return { score, metadata };
}

function buildFewShotBlock(fewShots, request) {
  if (!Array.isArray(fewShots) || !fewShots.length) {
    return { block: '', summary: ['- No few-shot examples available.'] };
  }

  const ranked = fewShots
    .map((item) => ({ item, ...scoreFewShotMatch(item, request) }))
    .sort((left, right) => right.score - left.score);

  const selected = ranked.slice(0, FEW_SHOT_EXAMPLE_COUNT);

  return {
    block: JSON.stringify(
      selected.map(({ item }) => item),
      null,
      2
    ),
    summary: selected.map(
      ({ metadata, score }) =>
        `- ${metadata.title}: type ${metadata.callFamily}, semester ${metadata.semester}, complexity ${metadata.complexity}, env ${metadata.environment}, meds ${metadata.hasMeds ? 'yes' : 'no'}, vital sets ${metadata.vitalSetCount}, cue density ${metadata.cueDensity}, match score ${score}`
    )
  };
}

const ECG_WHITELIST = [
  'Normal Sinus Rhythm',
  'Sinus Bradycardia',
  'Sinus Tachycardia',
  'Atrial Fibrillation',
  'Atrial Flutter',
  'SVT',
  'Ventricular Tachycardia',
  'Ventricular Fibrillation',
  'Asystole',
  'Pulseless Electrical Activity',
  'First Degree AV Block',
  'Second Degree AV Block Type I',
  'Second Degree AV Block Type II',
  'Third Degree AV Block'
];

const SCENARIO_SUBTYPE_LIBRARY = {
  Medical: [
    {
      subtype: 'diabetic_or_metabolic',
      likelyDiagnosis: 'hypoglycemia or other diabetic/metabolic presentation',
      chiefComplaints: [
        'Altered level of consciousness',
        'Weakness and diaphoresis',
        'Confusion',
        'Feeling faint',
        'General weakness'
      ],
      plausibleDifferentials: [
        'Hypoglycemia',
        'Hyperglycemia',
        'Sepsis',
        'Stroke mimic',
        'Medication-related altered LOC'
      ],
      symptomPatterns: [
        'metabolic presentation with altered mentation, diaphoresis, weakness, or behaviour change',
        'diabetic complaint with enough field detail to support treatment choice and reassessment',
        'medical presentation where glucose status is an important but not instantly obvious factor'
      ]
    },
    {
      subtype: 'infectious_or_sepsis',
      likelyDiagnosis: 'infectious process with possible early sepsis concern',
      chiefComplaints: [
        'Weakness and fever',
        'Feeling unwell',
        'Shortness of breath',
        'Confusion',
        'General malaise'
      ],
      plausibleDifferentials: [
        'Sepsis',
        'Pneumonia',
        'Urinary source infection',
        'Dehydration',
        'Viral illness'
      ],
      symptomPatterns: [
        'infectious presentation with believable early shock or systemic illness cues',
        'medical complaint where vitals, skin signs, fever history, and weakness create sepsis concern',
        'progressive illness presentation that rewards good trend recognition and transport thinking'
      ]
    },
    {
      subtype: 'nausea_vomiting_or_dehydration',
      likelyDiagnosis: 'volume depletion or GI-driven illness pattern',
      chiefComplaints: [
        'Nausea and vomiting',
        'Abdominal pain',
        'Weakness and dizziness',
        'Unable to keep fluids down',
        'Diarrhea and weakness'
      ],
      plausibleDifferentials: [
        'Dehydration',
        'Gastroenteritis',
        'DKA',
        'Medication side effect',
        'Abdominal pathology'
      ],
      symptomPatterns: [
        'GI complaint with dehydration risk, progressive weakness, and transport considerations',
        'nausea-vomiting presentation where antiemetic decisions and reassessment matter',
        'general illness presentation with enough ambiguity to require good history and trend recognition'
      ]
    },
    {
      subtype: 'neurologic_or_syncope',
      likelyDiagnosis: 'neurologic complaint or syncope-style medical presentation',
      chiefComplaints: [
        'Syncope',
        'Near fainting episode',
        'Dizziness',
        'Confusion',
        'Weakness after collapse'
      ],
      plausibleDifferentials: [
        'Vasovagal syncope',
        'Cardiac syncope',
        'Stroke or TIA',
        'Hypoglycemia',
        'Dehydration'
      ],
      symptomPatterns: [
        'collapse or near-collapse presentation that requires careful differentiation',
        'neurologic-style complaint with subtle but meaningful clues',
        'medical presentation where history, vitals, and reassessment shape the working diagnosis'
      ]
    },
    {
      subtype: 'geriatric_multi_problem',
      likelyDiagnosis: 'geriatric medical complaint with overlapping contributors',
      chiefComplaints: [
        'General weakness',
        'Not acting like themselves',
        'Shortness of breath',
        'Fall with no obvious major injury',
        'Decline over several days'
      ],
      plausibleDifferentials: [
        'Infection',
        'Dehydration',
        'Medication effect',
        'CHF',
        'Cognitive decline with acute illness'
      ],
      symptomPatterns: [
        'older adult presentation with vague but important clues and collateral history value',
        'multi-factor geriatric illness where medications, comorbidities, and environment matter',
        'medical complaint that feels realistic and slightly messy rather than textbook neat'
      ]
    },
    {
      subtype: 'toxicology_or_overdose',
      likelyDiagnosis: 'toxicologic or overdose-style medical presentation',
      chiefComplaints: [
        'Decreased level of consciousness',
        'Found unresponsive',
        'Not waking up properly',
        'Overdose concern',
        'Altered behaviour'
      ],
      plausibleDifferentials: [
        'Opioid overdose',
        'Mixed overdose',
        'Hypoglycemia',
        'Head injury',
        'Alcohol intoxication'
      ],
      symptomPatterns: [
        'toxicology-style call with airway, breathing, and reassessment priorities',
        'overdose concern where the scene, bystanders, and collateral history matter',
        'medical presentation that requires weighing tox causes against other altered LOC causes'
      ]
    }
  ],

  Cardiac: [
    {
      subtype: 'acs_chest_pain',
      likelyDiagnosis: 'acute coronary syndrome pattern',
      chiefComplaints: [
        'Chest pain',
        'Chest pressure',
        'Chest heaviness',
        'Chest discomfort with nausea',
        'Chest pain radiating to arm or jaw'
      ],
      plausibleDifferentials: [
        'ACS',
        'Angina',
        'Aortic pathology',
        'GERD',
        'Anxiety or panic',
        'Pulmonary embolism'
      ],
      symptomPatterns: [
        'cardiac symptoms with pressure, autonomic features, or exertional context',
        'ischemic chest pain pattern with believable decision points around ASA, nitro, and destination',
        'cardiac complaint that rewards focused history, ECG use, and serial reassessment'
      ]
    },
    {
      subtype: 'arrhythmia_or_palpitations',
      likelyDiagnosis: 'symptomatic cardiac rhythm disturbance',
      chiefComplaints: [
        'Palpitations',
        'Rapid heartbeat',
        'Chest fluttering',
        'Dizziness with palpitations',
        'Near syncope with irregular heartbeat'
      ],
      plausibleDifferentials: [
        'SVT',
        'Atrial fibrillation',
        'Atrial flutter',
        'Anxiety',
        'Dehydration-related tachycardia'
      ],
      symptomPatterns: [
        'arrhythmia complaint with rate, rhythm, and stability assessment driving the scenario',
        'palpitations presentation where ECG relevance and symptom severity shape urgency',
        'cardiac rhythm complaint that requires more than simply noticing tachycardia'
      ]
    },
    {
      subtype: 'cardiac_syncope',
      likelyDiagnosis: 'syncope with concerning possible cardiac cause',
      chiefComplaints: [
        'Syncope',
        'Collapsed suddenly',
        'Near fainting',
        'Fainting with chest discomfort',
        'Fainting with palpitations'
      ],
      plausibleDifferentials: [
        'Cardiac syncope',
        'Arrhythmia',
        'ACS',
        'Vasovagal event',
        'Hypovolemia'
      ],
      symptomPatterns: [
        'collapse pattern with concerning cardiac clues but room for reasonable differential thinking',
        'syncope complaint where history and ECG support destination urgency',
        'cardiac-leaning collapse scenario that feels realistic rather than dramatic for its own sake'
      ]
    },
    {
      subtype: 'chf_or_pulmonary_edema',
      likelyDiagnosis: 'cardiac failure pattern with respiratory consequences',
      chiefComplaints: [
        'Shortness of breath',
        'Waking up short of breath',
        'Difficulty breathing while lying down',
        'Chest tightness and SOB',
        'Leg swelling with worsening breathing'
      ],
      plausibleDifferentials: [
        'CHF',
        'Pulmonary edema',
        'COPD exacerbation',
        'Pneumonia',
        'ACS with heart failure'
      ],
      symptomPatterns: [
        'cardiac-respiratory presentation with orthopnea, distress, and fluid overload clues',
        'SOB complaint where cardiac history and exam findings guide treatment priorities',
        'heart-failure-style call where breathing findings and transport urgency matter'
      ]
    }
  ],

  Respiratory: [
    {
      subtype: 'asthma',
      likelyDiagnosis: 'bronchospastic asthma presentation',
      chiefComplaints: [
        'Shortness of breath',
        'Wheezing',
        'Asthma attack',
        'Difficulty breathing',
        'Chest tightness'
      ],
      plausibleDifferentials: [
        'Asthma',
        'Allergic respiratory process',
        'Anxiety with hyperventilation',
        'Pneumonia',
        'COPD-like bronchospasm'
      ],
      symptomPatterns: [
        'bronchospastic respiratory distress with visible work of breathing and reassessment points',
        'asthma-style complaint where oxygen, bronchodilator use, and communication matter',
        'respiratory scenario that feels dynamic but still fair and teachable'
      ]
    },
    {
      subtype: 'copd_exacerbation',
      likelyDiagnosis: 'COPD or chronic respiratory disease exacerbation',
      chiefComplaints: [
        'Shortness of breath',
        'Increased cough',
        'Trouble catching breath',
        'Worsening breathing over several days',
        'Difficulty breathing with sputum changes'
      ],
      plausibleDifferentials: [
        'COPD exacerbation',
        'Pneumonia',
        'CHF',
        'Pulmonary embolism',
        'Asthma-like bronchospasm'
      ],
      symptomPatterns: [
        'chronic lung disease presentation with realistic oxygen titration and treatment decisions',
        'respiratory distress complaint shaped by baseline disease, medications, and home context',
        'SOB scenario where the patient history meaningfully affects management'
      ]
    },
    {
      subtype: 'pneumonia_or_infective',
      likelyDiagnosis: 'infective lower respiratory illness',
      chiefComplaints: [
        'Shortness of breath and fever',
        'Weakness with cough',
        'Difficulty breathing',
        'Fever and productive cough',
        'General illness with SOB'
      ],
      plausibleDifferentials: [
        'Pneumonia',
        'Sepsis',
        'CHF',
        'COPD exacerbation',
        'Pulmonary embolism'
      ],
      symptomPatterns: [
        'infective respiratory complaint with fever history, weakness, and ventilation concerns',
        'breathing complaint where auscultation, work of breathing, and general illness all matter',
        'respiratory presentation that is more about thoughtful assessment than dramatic airway collapse'
      ]
    },
    {
      subtype: 'allergic_respiratory_process',
      likelyDiagnosis: 'allergic respiratory process with possible progression',
      chiefComplaints: [
        'Shortness of breath after exposure',
        'Wheezing after allergen contact',
        'Throat tightness',
        'Rash with breathing trouble',
        'Allergic reaction with respiratory symptoms'
      ],
      plausibleDifferentials: [
        'Allergic reaction',
        'Anaphylaxis',
        'Asthma',
        'Anxiety',
        'Airway irritation'
      ],
      symptomPatterns: [
        'allergic-respiratory presentation where pattern recognition and escalation matter',
        'breathing complaint tied to exposure history with fair clues toward progression risk',
        'scenario that can reward early recognition rather than waiting for late collapse'
      ]
    }
  ],

  Trauma: [
    {
      subtype: 'fall_trauma',
      likelyDiagnosis: 'fall-related injury pattern matching mechanism',
      chiefComplaints: [
        'Hip pain after fall',
        'Head injury after fall',
        'Unable to get up after falling',
        'Pelvic pain after fall',
        'Wrist pain after slipping'
      ],
      plausibleDifferentials: [
        'Fracture',
        'Head injury',
        'Pelvic injury',
        'Underlying medical cause of fall',
        'Soft tissue injury'
      ],
      symptomPatterns: [
        'fall scenario where mechanism, tenderness, mobility, and packaging matter',
        'trauma complaint with realistic pain, movement limits, and scene history',
        'injury presentation that may include an underlying medical trigger if complexity supports it'
      ]
    },
    {
      subtype: 'blunt_trauma',
      likelyDiagnosis: 'blunt trauma pattern with focused injury priorities',
      chiefComplaints: [
        'Chest pain after impact',
        'Abdominal pain after trauma',
        'Back pain after collision',
        'Multiple pain complaints after MVC',
        'Shoulder and chest pain after crash'
      ],
      plausibleDifferentials: [
        'Chest wall injury',
        'Internal injury',
        'Spinal injury',
        'Abdominal trauma',
        'Concussion'
      ],
      symptomPatterns: [
        'blunt trauma call where the mechanism and physical findings must align',
        'trauma complaint that rewards organized assessment rather than rushing into assumptions',
        'injury pattern with realistic transport and reassessment implications'
      ]
    },
    {
      subtype: 'isolated_extremity_injury',
      likelyDiagnosis: 'isolated painful extremity injury with possible fracture or dislocation',
      chiefComplaints: [
        'Leg pain after twisting injury',
        'Arm pain after fall',
        'Knee pain and deformity',
        'Ankle injury',
        'Possible fracture after sports injury'
      ],
      plausibleDifferentials: [
        'Fracture',
        'Dislocation',
        'Severe sprain',
        'Neurovascular compromise',
        'Pain-limited movement'
      ],
      symptomPatterns: [
        'isolated trauma case where pain management, splinting, and neurovascular assessment matter',
        'extremity injury with realistic movement limitation and transport considerations',
        'focused trauma scenario that still rewards good overall scene and patient management'
      ]
    },
    {
      subtype: 'head_injury',
      likelyDiagnosis: 'head injury with potential concussion or intracranial concern',
      chiefComplaints: [
        'Head injury',
        'Collapse with head strike',
        'Vomiting after head injury',
        'Confusion after being hit in the head',
        'Headache after trauma'
      ],
      plausibleDifferentials: [
        'Concussion',
        'Intracranial bleed',
        'C-spine injury',
        'Syncope causing fall',
        'Alcohol or substance contribution'
      ],
      symptomPatterns: [
        'head injury scenario where neuro findings, vomiting, confusion, and mechanism all matter',
        'trauma call with potentially subtle but significant neurologic cues',
        'injury pattern that rewards repeated neuro reassessment and transport urgency recognition'
      ]
    }
  ],

  Environmental: [
    {
      subtype: 'heat_illness',
      likelyDiagnosis: 'heat-related illness or exertional heat stress',
      chiefComplaints: [
        'Weakness after heat exposure',
        'Collapsed during exertion',
        'Dizziness in the heat',
        'Nausea after working outside',
        'Confusion after prolonged sun exposure'
      ],
      plausibleDifferentials: [
        'Heat exhaustion',
        'Heat stroke',
        'Dehydration',
        'Cardiac event',
        'Electrolyte disturbance'
      ],
      symptomPatterns: [
        'heat-related illness where environment and physiology are inseparable',
        'exertional collapse with realistic hydration, temperature, and reassessment concerns',
        'environmental case that remains clinically grounded and operationally relevant'
      ]
    },
    {
      subtype: 'cold_exposure',
      likelyDiagnosis: 'cold-related physiologic stress or hypothermia concern',
      chiefComplaints: [
        'Cold exposure',
        'Confusion in the cold',
        'Weakness after being outside',
        'Shivering and fatigue',
        'Found outdoors in winter'
      ],
      plausibleDifferentials: [
        'Hypothermia',
        'Cold exposure',
        'Alcohol-related exposure',
        'Hypoglycemia',
        'Injury during exposure'
      ],
      symptomPatterns: [
        'cold-weather presentation where environment changes assessment and movement priorities',
        'exposure scenario with realistic field limitations and altered physiology',
        'environment-linked complaint where subtle deterioration matters'
      ]
    },
    {
      subtype: 'exposure_or_toxin',
      likelyDiagnosis: 'environment-linked exposure or toxin process',
      chiefComplaints: [
        'Headache and dizziness after exposure',
        'Multiple people feeling unwell',
        'Nausea after chemical exposure',
        'Breathing irritation after workplace exposure',
        'General illness after inhalation concern'
      ],
      plausibleDifferentials: [
        'Carbon monoxide exposure',
        'Irritant inhalation',
        'Anxiety cluster',
        'Toxic exposure',
        'Heat or poor ventilation-related illness'
      ],
      symptomPatterns: [
        'exposure-driven complaint where scene safety and environmental clues matter',
        'environment-linked illness pattern with realistic uncertainty and operational awareness',
        'case where the setting materially changes how the crew must think and work'
      ]
    }
  ]
};

const ENVIRONMENT_DETAIL_LIBRARY = {
  Urban: {
    generalSettings: [
      'apartment building',
      'downtown sidewalk',
      'busy intersection',
      'shopping plaza',
      'restaurant',
      'transit stop',
      'condo lobby',
      'parking garage',
      'high-rise hallway',
      'small city park'
    ],
    sceneElements: [
      'traffic noise',
      'limited parking access',
      'stairs or elevator decisions',
      'public visibility',
      'crowded surroundings',
      'tight indoor work space',
      'building access delay',
      'multiple bystanders nearby'
    ],
    accessChallenges: [
      'secured entry slows access',
      'elevator wait delays movement',
      'narrow apartment hallway complicates packaging',
      'public crowd affects privacy and communication'
    ],
    collateralSources: [
      'bystanders',
      'building staff',
      'family member on scene',
      'coworker',
      'security guard'
    ]
  },
  Rural: {
    generalSettings: [
      'farm property',
      'country road shoulder',
      'small town residence',
      'remote cottage',
      'rural workshop',
      'barn or outbuilding',
      'gravel driveway',
      'trail-side access near private land'
    ],
    sceneElements: [
      'long driveway',
      'limited nearby resources',
      'distance from hospital',
      'mud or uneven footing',
      'outbuilding access',
      'poor lighting',
      'delayed backup',
      'large property layout'
    ],
    accessChallenges: [
      'distance from the road slows access and removal',
      'terrain complicates stretcher movement',
      'backup is not immediately available',
      'transport considerations matter earlier than usual'
    ],
    collateralSources: [
      'spouse',
      'neighbour',
      'farm coworker',
      'family member',
      'property owner'
    ]
  },
  Wilderness: {
    generalSettings: [
      'trailhead',
      'forest path',
      'campsite',
      'remote lakeside area',
      'hiking trail',
      'backcountry access point',
      'rocky shoreline',
      'remote cabin area'
    ],
    sceneElements: [
      'uneven terrain',
      'weather exposure',
      'delayed extrication',
      'limited positioning space',
      'long carry-out',
      'poor footing',
      'distance from vehicle access',
      'cold or heat stress on scene'
    ],
    accessChallenges: [
      'terrain significantly complicates patient movement',
      'weather affects both patient physiology and crew operations',
      'extrication time changes urgency and packaging decisions',
      'limited access delays definitive transport'
    ],
    collateralSources: [
      'hiking partner',
      'camp friend',
      'group leader',
      'park staff',
      'family member nearby'
    ]
  },
  Industrial: {
    generalSettings: [
      'warehouse floor',
      'construction site',
      'factory break area',
      'loading dock',
      'machine shop',
      'industrial yard',
      'mechanical room',
      'manufacturing line area'
    ],
    sceneElements: [
      'machinery noise',
      'PPE concerns',
      'confined work area',
      'supervisor involvement',
      'worksite hazards',
      'limited communication due to noise',
      'industrial odours',
      'restricted access routes'
    ],
    accessChallenges: [
      'scene safety must be actively managed before patient contact',
      'noise interferes with communication and assessment',
      'equipment or structures constrain movement',
      'coworkers may crowd or over-explain the scene'
    ],
    collateralSources: [
      'supervisor',
      'coworker',
      'safety officer',
      'work partner',
      'first aid attendant'
    ]
  },
  Home: {
    generalSettings: [
      'private residence',
      'apartment bedroom',
      'bathroom floor',
      'kitchen area',
      'living room',
      'front porch',
      'basement rec room',
      'narrow hallway bedroom',
      'retirement apartment',
      'cluttered townhouse'
    ],
    sceneElements: [
      'medication bottles nearby',
      'family photos and personal belongings',
      'tight bathroom or bedroom access',
      'pets in the home',
      'emotional family presence',
      'clutter or trip hazards',
      'stairs inside the residence',
      'dim lighting'
    ],
    accessChallenges: [
      'tight home layout limits working space',
      'stairs or narrow hallways complicate egress',
      'family emotions affect communication and pace',
      'home details provide valuable collateral history'
    ],
    collateralSources: [
      'spouse',
      'adult child',
      'roommate',
      'caregiver',
      'parent',
      'neighbour'
    ]
  },
  'Public Space': {
    generalSettings: [
      'arena concourse',
      'grocery store aisle',
      'community centre',
      'school hallway',
      'parking lot',
      'public washroom',
      'mall food court',
      'gym floor',
      'library lobby',
      'restaurant dining area'
    ],
    sceneElements: [
      'crowd attention',
      'noise and embarrassment',
      'limited privacy',
      'scene-control demands',
      'public pressure',
      'staff trying to help',
      'conflicting witness accounts',
      'awkward positioning space'
    ],
    accessChallenges: [
      'public setting makes communication and assessment less private',
      'crowd control becomes part of scene management',
      'bystanders may interfere or provide conflicting histories',
      'patient embarrassment may alter cooperation'
    ],
    collateralSources: [
      'staff member',
      'friend',
      'teacher',
      'coach',
      'security',
      'bystander witness'
    ]
  }
};

const PATIENT_BEHAVIOR_LIBRARY = {
  low: [
    {
      style: 'cooperative and straightforward',
      communicationNotes: 'answers questions clearly and is easy to redirect',
      historyReliability: 'good historian',
      emotionalTone: 'concerned but calm'
    },
    {
      style: 'anxious but cooperative',
      communicationNotes: 'mild anxiety is present but the patient still answers appropriately',
      historyReliability: 'mostly reliable historian',
      emotionalTone: 'visibly worried'
    },
    {
      style: 'stoic and minimizing',
      communicationNotes: 'downplays symptoms and needs focused questioning',
      historyReliability: 'reliable but understated historian',
      emotionalTone: 'reserved and reluctant to dramatize symptoms'
    }
  ],
  moderate: [
    {
      style: 'anxious and mildly scattered',
      communicationNotes: 'needs redirection because discomfort and stress disrupt the history',
      historyReliability: 'partially reliable historian',
      emotionalTone: 'worried and somewhat overwhelmed'
    },
    {
      style: 'poor historian with collateral needed',
      communicationNotes: 'struggles to provide a clear timeline or medication history',
      historyReliability: 'limited historian',
      emotionalTone: 'fatigued or distracted'
    },
    {
      style: 'embarrassed or private',
      communicationNotes: 'holds back details unless rapport is built',
      historyReliability: 'reasonably reliable once comfortable',
      emotionalTone: 'guarded, especially in public or with family nearby'
    },
    {
      style: 'family-overridden interaction',
      communicationNotes: 'family keeps answering for the patient, affecting direct assessment',
      historyReliability: 'patient history is mixed with strong collateral input',
      emotionalTone: 'patient is partially overshadowed by others on scene'
    }
  ],
  high: [
    {
      style: 'confused or intermittently disorganized',
      communicationNotes: 'history is fragmented and requires repeated clarification or collateral',
      historyReliability: 'poor historian',
      emotionalTone: 'confused, tired, or neurologically off baseline'
    },
    {
      style: 'irritable and resistant',
      communicationNotes: 'is annoyed by questions or treatment suggestions and requires calm control of the interaction',
      historyReliability: 'incomplete and occasionally defensive historian',
      emotionalTone: 'frustrated and suspicious'
    },
    {
      style: 'panicked and hard to focus',
      communicationNotes: 'distress interferes with history and treatment compliance until communication is well managed',
      historyReliability: 'limited in the moment due to distress',
      emotionalTone: 'highly anxious or frightened'
    },
    {
      style: 'complex collateral-dependent patient',
      communicationNotes: 'patient cannot provide a full story and a bystander or family member is needed for critical history',
      historyReliability: 'poor direct historian with high collateral dependence',
      emotionalTone: 'diminished, confused, or physiologically compromised'
    }
  ]
};

const COMPLICATION_LIBRARY = {
  low: [
    'slightly unclear medication history that requires focused clarification',
    'tight working space that mildly complicates packaging or movement',
    'minor bystander distraction that challenges privacy',
    'patient minimizes symptoms despite clinically relevant findings',
    'history timeline is incomplete until follow-up questions are asked',
    'stairs or narrow access modestly affect movement decisions'
  ],
  moderate: [
    'family member provides conflicting history compared with the patient',
    'bystander pressure or embarrassment affects communication',
    'patient initially resists transport or downplays the seriousness of the problem',
    'reassessment reveals a meaningful change that should alter urgency or treatment priorities',
    'scene layout noticeably complicates movement and packaging',
    'comorbidity or medication use adds a real contraindication or caution point',
    'the patient has already taken some medication before EMS arrival, affecting decisions',
    'the environment delays clean assessment or private communication'
  ],
  high: [
    'a clinically important reassessment change occurs and should force the crew to adapt',
    'history is unreliable enough that collateral information becomes essential',
    'the scene significantly complicates movement, monitoring, or treatment positioning',
    'a contraindication or high-risk medication detail changes what can safely be given',
    'patient cooperation fluctuates and communication quality directly affects care success',
    'the apparent problem has a second competing issue that must also be recognized',
    'operational pressure, crowding, or access issues meaningfully strain the call',
    'the patient deteriorates enough that transport urgency clearly increases'
  ]
};

const MEDICATION_PATHWAY_LIBRARY = {
  acs_chest_pain: {
    style: 'cardiac multi-medication pathway',
    priority: 'medication_rich_when_supported',
    initialMedications: [
      'ASA if ACS features support it and no allergy or unsafe swallowing concern exists',
      'Nitroglycerin if chest pain pattern supports it, blood pressure allows, and no contraindication exists'
    ],
    reassessmentMedications: [
      'Repeat nitroglycerin if symptoms persist, blood pressure remains adequate, and reassessment still supports use'
    ],
    transportPhaseMedications: [
      'Consider antiemetic support during transport if nausea is prominent and clinically appropriate'
    ],
    withholdingLogic: [
      'Do NOT give nitroglycerin if blood pressure is too low or trending down',
      'Do NOT give nitroglycerin if recent PDE5 inhibitor use is present or suspected',
      'Do NOT give ASA if allergy, inability to safely take it, or another strong contraindication exists',
      'Do NOT give oxygen routinely when SpO2 and presentation do not justify it'
    ],
    supportiveCare: [
      '12-lead ECG acquisition',
      'serial pain and blood pressure reassessment',
      'cardiac monitoring',
      'destination or bypass thinking when supported by the scenario',
      'position of comfort if clinically appropriate'
    ],
    scenarioInstructions: [
      'Prefer a realistic staged pathway such as ASA early, nitro after blood pressure and contraindication check, then repeat nitro only if reassessment supports it.',
      'Build meaningful decision points around withholding or delaying nitro when appropriate.',
      'Avoid making medications automatic. Assessment should earn the treatment.'
    ]
  },

  arrhythmia_or_palpitations: {
    style: 'assessment-first rhythm scenario',
    priority: 'supportive_care_with_possible_targeted_medication',
    initialMedications: [],
    reassessmentMedications: [],
    transportPhaseMedications: [],
    withholdingLogic: [
      'Do not force medications if the case is primarily about rhythm recognition, ECG capture, and stability assessment',
      'Do not add oxygen unless hypoxia or another clear indication exists'
    ],
    supportiveCare: [
      '12-lead ECG acquisition',
      'cardiac monitoring',
      'serial hemodynamic reassessment',
      'transport urgency based on symptoms and stability',
      'history around onset, triggers, stimulant use, and cardiac history'
    ],
    scenarioInstructions: [
      'This subtype often works best as a medication-light or no-medication scenario.',
      'The value should come from rhythm recognition, stability assessment, and transport decisions rather than random drug use.'
    ]
  },

  cardiac_syncope: {
    style: 'cardiac syncope supportive-care dominant pathway',
    priority: 'supportive_care_dominant',
    initialMedications: [],
    reassessmentMedications: [],
    transportPhaseMedications: [],
    withholdingLogic: [
      'Avoid forcing medications unless there is a clearly justified secondary complaint such as ischemic chest pain or nausea',
      'Do not give oxygen routinely without indication'
    ],
    supportiveCare: [
      '12-lead ECG acquisition',
      'orthostatic or positional consideration when appropriate',
      'cardiac monitoring',
      'serial vitals and LOC reassessment',
      'transport urgency and destination considerations'
    ],
    scenarioInstructions: [
      'Keep medication use minimal unless the scenario genuinely supports it.',
      'This case should usually reward assessment, ECG use, and transport reasoning more than medication administration.'
    ]
  },

  chf_or_pulmonary_edema: {
    style: 'cardiac respiratory medication pathway',
    priority: 'targeted_medication_plus_supportive_care',
    initialMedications: [
      'Nitroglycerin if blood pressure is appropriately elevated, presentation supports CHF/pulmonary edema, and no contraindication exists'
    ],
    reassessmentMedications: [
      'Repeat nitroglycerin if distress persists and blood pressure remains suitable'
    ],
    transportPhaseMedications: [],
    withholdingLogic: [
      'Do NOT give nitroglycerin if blood pressure does not safely support it',
      'Do NOT treat as generic wheeze alone if the exam and history point more strongly to fluid overload',
      'Do NOT give oxygen automatically beyond what the patient clinically needs'
    ],
    supportiveCare: [
      'upright positioning',
      'oxygen titration if indicated',
      'consider CPAP if clinically appropriate and within scenario framing',
      '12-lead ECG acquisition',
      'serial blood pressure reassessment',
      'rapid transport thinking'
    ],
    scenarioInstructions: [
      'Let nitroglycerin feel like a deliberate CHF decision, not a reflex.',
      'This subtype should reward blood pressure interpretation, respiratory assessment, and repeated reassessment.'
    ]
  },

  asthma: {
    style: 'bronchospasm multi-medication pathway',
    priority: 'medication_rich_when_supported',
    initialMedications: [
      'Salbutamol if bronchospasm is clearly present',
      'Dexamethasone if the case supports a significant asthma exacerbation'
    ],
    reassessmentMedications: [
      'Repeat salbutamol if bronchospasm or respiratory distress persists after reassessment'
    ],
    transportPhaseMedications: [],
    withholdingLogic: [
      'Do not give oxygen routinely if oxygen saturation and clinical presentation do not support it',
      'Do not force dexamethasone in a very mild case if supportive care and bronchodilator alone are more realistic',
      'Do not make bronchodilator use automatic if the scenario findings do not actually support bronchospasm'
    ],
    supportiveCare: [
      'position of comfort',
      'work of breathing reassessment',
      'auscultation before and after treatment',
      'oxygen titration when indicated',
      'monitor fatigue and speaking ability',
      'transport escalation if the patient worsens or fails to improve'
    ],
    scenarioInstructions: [
      'Prefer a staged pathway such as salbutamol first, reassess, then repeat bronchodilator and/or add dexamethasone when the case supports it.',
      'Let treatment response meaningfully affect progression.'
    ]
  },

  copd_exacerbation: {
    style: 'COPD medication pathway',
    priority: 'targeted_medication_plus_supportive_care',
    initialMedications: [
      'Salbutamol if wheeze or bronchospastic features are present',
      'Dexamethasone if clinically appropriate for exacerbation severity'
    ],
    reassessmentMedications: [
      'Repeat salbutamol if ongoing wheeze or distress persists and reassessment supports it'
    ],
    transportPhaseMedications: [],
    withholdingLogic: [
      'Titrate oxygen thoughtfully rather than giving indiscriminate high-flow oxygen without reason',
      'Do not force bronchodilator use if the case reads more like pneumonia or CHF than COPD bronchospasm'
    ],
    supportiveCare: [
      'oxygen titration',
      'position of comfort',
      'serial auscultation and work of breathing reassessment',
      'consider CPAP if clinically appropriate',
      'transport and deterioration planning'
    ],
    scenarioInstructions: [
      'This should feel like a real COPD call, not generic shortness of breath.',
      'Make oxygen titration, reassessment, and selective bronchodilator use matter.'
    ]
  },

  pneumonia_or_infective: {
    style: 'supportive-care dominant respiratory infectious pathway',
    priority: 'supportive_care_dominant',
    initialMedications: [],
    reassessmentMedications: [],
    transportPhaseMedications: [
      'Ondansetron may be considered later only if nausea or vomiting becomes a meaningful transport issue and is otherwise clinically appropriate'
    ],
    withholdingLogic: [
      'Do not force bronchodilators into a pneumonia-style case unless wheeze or bronchospasm is truly present',
      'Do not give oxygen unless clinically indicated'
    ],
    supportiveCare: [
      'oxygen titration if indicated',
      'positioning',
      'temperature and sepsis-style trend recognition',
      'serial respiratory reassessment',
      'early transport thinking'
    ],
    scenarioInstructions: [
      'This subtype should often be medication-light.',
      'The main teaching value should come from assessment, trend recognition, supportive care, and destination urgency.'
    ]
  },

  allergic_respiratory_process: {
    style: 'allergic escalation pathway',
    priority: 'medication_rich_when_supported',
    initialMedications: [
      'Epinephrine IM if the presentation supports anaphylaxis or significant airway, breathing, or circulatory compromise',
      'Salbutamol if lower airway bronchospasm or wheeze is present'
    ],
    reassessmentMedications: [
      'Repeat epinephrine IM if significant symptoms persist or recur after reassessment'
    ],
    transportPhaseMedications: [],
    withholdingLogic: [
      'Do not delay epinephrine in a clearly evolving anaphylaxis picture by prioritizing less important treatments first',
      'Do not give salbutamol as the main treatment if the dominant issue is upper airway or systemic anaphylaxis',
      'Do not give oxygen unless indicated'
    ],
    supportiveCare: [
      'airway reassessment',
      'positioning based on tolerance and perfusion',
      'monitor for deterioration',
      'rapid transport thinking',
      'clear communication with patient and bystanders about severity'
    ],
    scenarioInstructions: [
      'This subtype should reward early pattern recognition.',
      'Build a believable difference between allergic respiratory distress and true anaphylactic escalation.'
    ]
  },

  diabetic_or_metabolic: {
    style: 'glucose decision pathway',
    priority: 'targeted_medication_plus_supportive_care',
    initialMedications: [
      'Oral glucose if the patient can safely swallow and the presentation supports it',
      'Glucagon if hypoglycemia is suspected or confirmed and oral glucose is not safe or feasible'
    ],
    reassessmentMedications: [
      'Additional glucose support only if reassessment still supports ongoing hypoglycemia management'
    ],
    transportPhaseMedications: [
      'Ondansetron later only if nausea becomes clinically relevant after treatment and transport'
    ],
    withholdingLogic: [
      'Do NOT give oral glucose if the patient cannot safely swallow or protect the airway',
      'Do not give glucagon automatically if the patient is alert enough for oral glucose and the scenario supports that choice',
      'Do not assume every diabetic presentation should be treated with medication before assessment confirms direction'
    ],
    supportiveCare: [
      'BGL confirmation',
      'serial LOC reassessment',
      'repeat BGL after treatment',
      'history around insulin, meals, recent illness, and exertion',
      'transport thinking even after improvement'
    ],
    scenarioInstructions: [
      'Create a real choice between oral glucose, glucagon, or supportive care rather than making one automatic.',
      'Make reassessment and transport decisions matter after initial improvement.'
    ]
  },

  infectious_or_sepsis: {
    style: 'supportive-care and transport-priority infectious pathway',
    priority: 'supportive_care_dominant',
    initialMedications: [],
    reassessmentMedications: [],
    transportPhaseMedications: [
      'Ondansetron later only if nausea becomes a meaningful transport or comfort issue and the case otherwise supports it'
    ],
    withholdingLogic: [
      'Do not force medications into a sepsis-style case when supportive care, oxygen decisions, reassessment, and transport urgency are the real priorities',
      'Do not give oxygen without indication'
    ],
    supportiveCare: [
      'trend vital signs carefully',
      'oxygen titration if indicated',
      'temperature and perfusion assessment',
      'consider dehydration support if that is part of your local scope and scenario framing',
      'early transport and destination urgency'
    ],
    scenarioInstructions: [
      'This should usually be a medication-light case unless nausea or another secondary issue clearly justifies a medication later.',
      'The real teaching value is recognition, trend assessment, and transport priority.'
    ]
  },

  nausea_vomiting_or_dehydration: {
    style: 'GI symptom relief pathway',
    priority: 'targeted_medication_plus_supportive_care',
    initialMedications: [
      'Ondansetron if nausea or vomiting is significant and clinically appropriate'
    ],
    reassessmentMedications: [
      'Repeat antiemetic thinking only if the case supports persistent symptoms and your scenario framing allows it'
    ],
    transportPhaseMedications: [
      'Consider fluid support if appropriate to your local training expectations and scenario framing'
    ],
    withholdingLogic: [
      'Do not let ondansetron hide a more serious abdominal or metabolic problem',
      'Do not force fluids into every case unless your scenario scope and learner expectations support it',
      'Do not give oxygen without indication'
    ],
    supportiveCare: [
      'hydration assessment',
      'positioning for comfort',
      'abdominal assessment',
      'orthostatic or weakness reassessment when appropriate',
      'transport decision-making'
    ],
    scenarioInstructions: [
      'A good version of this case often uses ondansetron thoughtfully, not automatically.',
      'Make the crew still work through cause, severity, and transport need.'
    ]
  },

  neurologic_or_syncope: {
    style: 'assessment-first neurologic or syncope pathway',
    priority: 'supportive_care_dominant',
    initialMedications: [],
    reassessmentMedications: [],
    transportPhaseMedications: [],
    withholdingLogic: [
      'Avoid forcing medications unless the scenario clearly identifies a secondary treatable complaint such as hypoglycemia or nausea',
      'Do not give oxygen without indication'
    ],
    supportiveCare: [
      'serial LOC and neuro reassessment',
      'BGL check',
      '12-lead ECG when appropriate',
      'history around prodrome, exertion, medications, and witness account',
      'transport urgency'
    ],
    scenarioInstructions: [
      'This case should usually be medication-light.',
      'Assessment, differential thinking, and transport decisions should carry the scenario.'
    ]
  },

  geriatric_multi_problem: {
    style: 'selective medication use in messy medical presentation',
    priority: 'mixed',
    initialMedications: [],
    reassessmentMedications: [],
    transportPhaseMedications: [
      'Ondansetron may be appropriate later if nausea is meaningful and otherwise clinically justified'
    ],
    withholdingLogic: [
      'Do not force medications into a vague geriatric case simply to make it feel active',
      'Withhold medications when the diagnosis or physiology is not yet clear enough',
      'Avoid reflex oxygen without indication'
    ],
    supportiveCare: [
      'careful medication history review',
      'collateral history gathering',
      'serial vitals and mental status reassessment',
      'transport urgency based on trend rather than one snapshot',
      'scene and mobility planning'
    ],
    scenarioInstructions: [
      'This subtype should often reward restraint.',
      'Good care may involve identifying what not to give while still moving the patient appropriately toward definitive care.'
    ]
  },

  toxicology_or_overdose: {
    style: 'toxicology targeted-medication pathway',
    priority: 'targeted_medication_plus_supportive_care',
    initialMedications: [
      'Naloxone if opioid toxidrome features support it and the airway, breathing, and LOC picture justifies it'
    ],
    reassessmentMedications: [
      'Repeat naloxone only if the response is incomplete and the presentation still supports opioid involvement'
    ],
    transportPhaseMedications: [],
    withholdingLogic: [
      'Do not let naloxone replace ventilation-first priorities in a hypoventilating patient',
      'Do not force naloxone in mixed or unclear altered LOC without a believable opioid picture',
      'Do not give oxygen without indication, but do support oxygenation and ventilation appropriately when needed'
    ],
    supportiveCare: [
      'airway positioning',
      'ventilation support',
      'BGL check',
      'scene and paraphernalia assessment',
      'serial consciousness and respiratory reassessment',
      'transport after apparent improvement'
    ],
    scenarioInstructions: [
      'Build this around airway and breathing priorities first.',
      'Naloxone should be present when earned by the presentation, not simply because overdose was mentioned.'
    ]
  },

  fall_trauma: {
    style: 'trauma selective analgesia pathway',
    priority: 'mixed',
    initialMedications: [
      'Ketorolac if pain pattern supports it and no contraindication exists'
    ],
    reassessmentMedications: [],
    transportPhaseMedications: [
      'Ondansetron may be considered later if pain or head injury is associated with nausea and otherwise clinically appropriate'
    ],
    withholdingLogic: [
      'Do not give ketorolac if bleeding risk, hypotension, allergy, or other contraindication makes it unsafe',
      'Do not force analgesia in a case where instability or occult major injury should take priority first',
      'Do not give oxygen without indication'
    ],
    supportiveCare: [
      'packaging',
      'movement planning',
      'SMR decision making when applicable',
      'neurovascular reassessment',
      'repeat vitals and pain reassessment'
    ],
    scenarioInstructions: [
      'Pain control should be a real decision rather than an automatic checkbox.',
      'Make the mechanism, packaging, and reassessment meaningful.'
    ]
  },

  blunt_trauma: {
    style: 'trauma assessment-first pathway',
    priority: 'supportive_care_dominant',
    initialMedications: [],
    reassessmentMedications: [],
    transportPhaseMedications: [],
    withholdingLogic: [
      'Avoid forcing analgesics into a blunt trauma case if instability or occult injury concern is the educational priority',
      'Do not give oxygen without indication'
    ],
    supportiveCare: [
      'primary survey',
      'bleeding control',
      'packaging and movement',
      'serial shock reassessment',
      'rapid transport decision making'
    ],
    scenarioInstructions: [
      'This subtype is often better as a transport and trauma-priority case than a medication-heavy case.',
      'Only add analgesia if the patient is stable and it genuinely fits.'
    ]
  },

  isolated_extremity_injury: {
    style: 'focused analgesia pathway',
    priority: 'targeted_medication_plus_supportive_care',
    initialMedications: [
      'Ketorolac if clinically indicated and no contraindication exists'
    ],
    reassessmentMedications: [],
    transportPhaseMedications: [],
    withholdingLogic: [
      'Do not give ketorolac if allergy, significant bleeding concern, hypotension, or other contraindication exists',
      'Do not force analgesia before basic splinting and neurovascular assessment are addressed'
    ],
    supportiveCare: [
      'splinting',
      'distal circulation, sensation, and movement checks',
      'pain reassessment after splinting or medication',
      'movement planning',
      'transport comfort and monitoring'
    ],
    scenarioInstructions: [
      'This is a good subtype for selective analgesia plus strong supportive care.',
      'Splinting and neurovascular reassessment should still matter a great deal.'
    ]
  },

  head_injury: {
    style: 'head injury restraint pathway',
    priority: 'supportive_care_dominant',
    initialMedications: [],
    reassessmentMedications: [],
    transportPhaseMedications: [
      'Ondansetron may be considered later for vomiting if clinically appropriate and it does not distract from the neurologic priorities of the case'
    ],
    withholdingLogic: [
      'Do not force ketorolac or other analgesics into a head injury case where neuro monitoring is the main priority',
      'Do not give oxygen without indication'
    ],
    supportiveCare: [
      'serial GCS reassessment',
      'vomiting and aspiration risk management',
      'SMR decision making when appropriate',
      'rapid transport thinking',
      'repeat neuro examination'
    ],
    scenarioInstructions: [
      'This case should usually be medication-light.',
      'The educational value should come from neuro reassessment, transport urgency, and recognizing concerning trends.'
    ]
  },

  heat_illness: {
    style: 'environmental supportive-care dominant pathway',
    priority: 'supportive_care_dominant',
    initialMedications: [
      'Ondansetron may be appropriate if nausea or vomiting is prominent and clinically justified'
    ],
    reassessmentMedications: [],
    transportPhaseMedications: [
      'Consider fluid support if appropriate to your local training expectations and scenario framing'
    ],
    withholdingLogic: [
      'Do not force medications into heat illness when cooling, repositioning, hydration support, and transport are the real priorities',
      'Do not give oxygen without indication'
    ],
    supportiveCare: [
      'active cooling measures appropriate to the case',
      'move out of the environment',
      'temperature reassessment',
      'serial LOC and perfusion reassessment',
      'transport urgency based on severity'
    ],
    scenarioInstructions: [
      'Environmental management should matter more than medication count here.',
      'If a medication appears, it should support symptoms, not dominate the case.'
    ]
  },

  cold_exposure: {
    style: 'cold exposure supportive-care dominant pathway',
    priority: 'supportive_care_dominant',
    initialMedications: [],
    reassessmentMedications: [],
    transportPhaseMedications: [],
    withholdingLogic: [
      'Do not force medications into cold exposure unless a secondary issue clearly justifies it',
      'Do not give oxygen without indication'
    ],
    supportiveCare: [
      'rewarming measures appropriate to the call',
      'gentle handling when appropriate',
      'serial LOC and temperature reassessment',
      'scene-to-ambulance movement planning',
      'transport thinking'
    ],
    scenarioInstructions: [
      'This should almost always be medication-light.',
      'The environment and physiologic management should drive the call.'
    ]
  },

  exposure_or_toxin: {
    style: 'scene-safety and selective-treatment pathway',
    priority: 'mixed',
    initialMedications: [
      'Ondansetron may be appropriate if nausea is prominent and otherwise justified',
      'Salbutamol may be appropriate if the exposure produces lower-airway bronchospasm and the exam supports it'
    ],
    reassessmentMedications: [],
    transportPhaseMedications: [],
    withholdingLogic: [
      'Do not medicate away an unsafe scene. Scene safety and removal come first.',
      'Do not force bronchodilators if the presentation is irritation without bronchospasm',
      'Do not give oxygen without indication'
    ],
    supportiveCare: [
      'scene safety',
      'remove from exposure',
      'serial reassessment of airway, breathing, and neuro status',
      'consider multiple-patient awareness if relevant',
      'transport for ongoing assessment'
    ],
    scenarioInstructions: [
      'This case should be driven first by scene awareness and exposure logic.',
      'Any medication used should be selective and clearly justified.'
    ]
  }
};

const CASE_PROGRESSION_LIBRARY = {
  acs_chest_pain: {
    treated: [
      'Chest pain eases somewhat after correct staged care such as ASA first and nitroglycerin only if blood pressure and contraindications allow.',
      'The patient remains high-risk but becomes more comfortable and slightly less anxious with appropriate reassessment and transport priority.',
      'If repeat nitroglycerin is appropriate and correctly given, pain may improve further while blood pressure still requires close monitoring.',
      'ECG interpretation and serial reassessment help reinforce destination urgency even if symptoms partially improve.'
    ],
    untreated: [
      'Chest discomfort persists or worsens, with increasing diaphoresis, anxiety, and concern for ongoing ischemia.',
      'The patient may become more pale, nauseated, or uneasy during transport if indicated care is delayed.',
      'Persistent pain without meaningful reassessment should increase the sense of cardiac urgency.',
      'Blood pressure or overall presentation may begin trending less favorably over time.'
    ],
    incorrect: [
      'Giving nitroglycerin despite hypotension or a clear contraindication worsens perfusion and may provoke dizziness or near-syncope.',
      'Failing to check contraindications before nitro creates a realistic medication safety error.',
      'Delaying assessment and serial reassessment turns the case into a more unstable or uncertain chest pain call.',
      'Reflex oxygen without indication should not be framed as helpful care.'
    ],
    midComplications: [
      'The patient develops worsening nausea or vomiting mid-call.',
      'Pain suddenly intensifies again after a brief period of partial relief.',
      'A new rhythm concern or perfusion change appears on reassessment.',
      'Collateral history reveals a relevant medication or contraindication detail late in the call.'
    ]
  },

  arrhythmia_or_palpitations: {
    treated: [
      'Organized assessment, ECG capture, and calm monitoring clarify the rhythm problem and support transport urgency.',
      'The patient may feel somewhat better with reassurance and positioning even if no medication is given.',
      'Serial vitals and symptom reassessment help distinguish stable from worsening rhythm-related illness.',
      'Good care is shown through recognition, interpretation, and anticipation rather than reflex medication use.'
    ],
    untreated: [
      'Palpitations, dizziness, or discomfort persist because the crew never meaningfully clarifies or trends the problem.',
      'Failure to obtain an ECG or reassess symptoms leaves the scenario more uncertain and riskier.',
      'The patient may become more anxious, lightheaded, or less stable over time.',
      'Missed trend recognition can allow an initially manageable rhythm complaint to feel more urgent later.'
    ],
    incorrect: [
      'Forcing unrelated medications into the scenario distracts from the real learning goal and can worsen clarity of care.',
      'Failure to recognize instability or worsening symptoms creates an avoidable escalation.',
      'Treating anxiety as the only explanation too early can miss a legitimate cardiac rhythm problem.',
      'Ignoring oxygen standards and giving unnecessary oxygen should not improve the patient meaningfully.'
    ],
    midComplications: [
      'The patient becomes more symptomatic with standing or movement.',
      'A more concerning ECG clue emerges after initial assessment.',
      'Collateral reveals stimulant use or prior arrhythmia history.',
      'The patient has a brief near-syncope episode during reassessment.'
    ]
  },

  cardiac_syncope: {
    treated: [
      'Careful assessment, ECG use, and serial reassessment reveal a concerning syncopal pattern and support urgent transport.',
      'The patient may look improved while still remaining high risk, reinforcing the need not to be falsely reassured.',
      'Positioning, monitoring, and good history gathering make the call feel more organized and safer.',
      'Appropriate restraint in medication use is part of correct management here.'
    ],
    untreated: [
      'The patient remains vulnerable to recurrent syncope, dizziness, or occult deterioration.',
      'Poor reassessment leaves the cause unclear and the transport priority underappreciated.',
      'Missed witness history or missed ECG use weakens the case management substantially.',
      'The patient may become more unwell with movement or time.'
    ],
    incorrect: [
      'Reflex medication use without a clear target distracts from the real priorities of ECG, reassessment, and transport.',
      'Failure to consider a cardiac cause turns a serious syncope call into an under-managed fainting spell.',
      'Ignoring glucose, ECG, or vitals trends creates a preventable diagnostic miss.',
      'Inappropriate reassurance without adequate assessment lowers scenario quality.'
    ],
    midComplications: [
      'The patient has another brief episode of near-syncope.',
      'An ECG finding adds concern on reassessment.',
      'Family reveals chest discomfort or palpitations before the collapse.',
      'Movement from the scene worsens dizziness and pallor.'
    ]
  },

  chf_or_pulmonary_edema: {
    treated: [
      'Upright positioning, thoughtful oxygen use, and nitroglycerin only when blood pressure truly supports it can reduce distress.',
      'If repeat nitroglycerin is appropriate and correctly given, the patient may show modest improvement in breathing and comfort.',
      'Even with correct care, the patient should still feel sick enough to justify rapid transport and ongoing reassessment.',
      'A strong version of the case rewards interpretation of blood pressure, lung findings, and cardiac context.'
    ],
    untreated: [
      'Respiratory distress continues or worsens, with increasing work of breathing, anxiety, and difficulty speaking.',
      'The patient may become more hypoxic or fatigued over time if supportive care and transport urgency are weak.',
      'Orthopnea, crackles, or fluid overload signs become more pronounced with delay.',
      'The patient may begin to look more overtly ill and harder to manage.'
    ],
    incorrect: [
      'Giving nitroglycerin when the pressure is not safe may provoke hypotension and worsen perfusion.',
      'Treating the case as simple wheeze alone can delay more appropriate cardiac-focused management.',
      'Missing the distinction between fluid overload and bronchospasm weakens the clinical reasoning of the scenario.',
      'Unfocused oxygen use should not replace careful respiratory and hemodynamic assessment.'
    ],
    midComplications: [
      'The patient becomes too breathless to answer in full sentences.',
      'Blood pressure changes create a new medication decision point.',
      'Chest discomfort becomes more prominent during reassessment.',
      'The patient begins tiring and looking less able to compensate.'
    ]
  },

  asthma: {
    treated: [
      'Air movement and work of breathing improve after appropriate bronchodilator use when bronchospasm is clearly present.',
      'If the case supports dexamethasone and it is included appropriately, the overall trajectory becomes more believable and better controlled.',
      'Repeat salbutamol after reassessment can produce further improvement when wheeze and distress persist.',
      'The patient may still require transport and close monitoring even after partial improvement.'
    ],
    untreated: [
      'Wheeze, dyspnea, and accessory muscle use continue or worsen without appropriate bronchodilator support.',
      'The patient becomes more fatigued, more anxious, and less able to speak in full sentences.',
      'Oxygenation or ventilation concerns become more apparent with delay.',
      'Persistent bronchospasm should make the case feel more urgent on reassessment.'
    ],
    incorrect: [
      'Failing to recognize bronchospasm leads to delayed salbutamol and a more difficult respiratory call.',
      'Overtreating a very mild presentation without good justification should not be portrayed as superior care.',
      'Missing fatigue or worsening work of breathing creates a realistic reassessment failure.',
      'Ignoring oxygen indications or giving oxygen reflexively without need should not drive improvement.'
    ],
    midComplications: [
      'The patient becomes more breathless and less able to answer questions.',
      'Auscultation changes after treatment create a repeat-medication decision point.',
      'The patient begins to look tired rather than simply anxious.',
      'A bystander reveals the patient has already used their inhaler multiple times before EMS arrival.'
    ]
  },

  copd_exacerbation: {
    treated: [
      'Thoughtful oxygen titration, appropriate bronchodilator use, and careful reassessment improve the realism of the call.',
      'If wheeze or bronchospasm is present, salbutamol can produce some improvement without making the patient suddenly perfect.',
      'If dexamethasone is appropriate, the scenario should still emphasize transport and trend recognition rather than instant resolution.',
      'Good care reflects selective treatment based on the actual presentation, not generic shortness-of-breath habits.'
    ],
    untreated: [
      'Breathing remains laboured or worsens, especially if the crew fails to reassess work of breathing and lung sounds.',
      'Poor oxygen decisions can worsen the realism and safety of the call.',
      'The patient becomes more fatigued, more anxious, or less effective at maintaining ventilation.',
      'A delayed or muddled approach makes the call feel more serious over time.'
    ],
    incorrect: [
      'Treating pneumonia or CHF clues as simple COPD bronchospasm can send care in the wrong direction.',
      'Giving indiscriminate oxygen without thought to the actual presentation weakens care quality.',
      'Forcing bronchodilator use when the exam does not support it reduces coherence.',
      'Failure to notice worsening fatigue creates a preventable escalation.'
    ],
    midComplications: [
      'Home oxygen use or baseline saturation history changes the interpretation of the case.',
      'Sputum history or fever details increase uncertainty between COPD and infection.',
      'The patient becomes more tired during movement to the ambulance.',
      'Reassessment reveals that symptoms are not improving as much as expected.'
    ]
  },

  pneumonia_or_infective: {
    treated: [
      'Supportive care, oxygen only if indicated, and strong transport thinking help stabilize the scenario without overmedicating it.',
      'Recognition of systemic illness and repeated reassessment improve the realism of the case.',
      'The patient may remain ill but look better managed and better prioritized after appropriate care.',
      'Good care is shown by trend recognition rather than dramatic symptom reversal.'
    ],
    untreated: [
      'Weakness, fever-related illness, or respiratory distress continue to progress.',
      'The patient becomes more uncomfortable, more tired, or more obviously systemically unwell.',
      'Failure to recognize infection severity weakens urgency and destination reasoning.',
      'Delayed transport should make the patient look progressively less well.'
    ],
    incorrect: [
      'Forcing bronchodilators into a pneumonia-driven presentation without bronchospasm distracts from the real problem.',
      'Failure to notice sepsis-style trend changes lowers the quality of decision-making.',
      'Unnecessary medications can muddy the call without helping the patient.',
      'Ignoring oxygen thresholds and transport urgency should worsen the overall case management.'
    ],
    midComplications: [
      'Nausea or vomiting becomes more prominent during transport.',
      'Temperature, perfusion, or mental status worsen on reassessment.',
      'Collateral history reveals a longer illness course than first reported.',
      'The patient becomes more short of breath with movement.'
    ]
  },

  allergic_respiratory_process: {
    treated: [
      'Early recognition of a true anaphylactic pattern leads to timely epinephrine and a more believable improvement trajectory.',
      'Salbutamol may help if lower airway bronchospasm is present, but it should not replace epinephrine when systemic allergy is the real problem.',
      'Repeat epinephrine after reassessment may be appropriate if symptoms persist or recur.',
      'Even if the patient improves, transport urgency and ongoing monitoring should remain important.'
    ],
    untreated: [
      'Airway, breathing, or circulatory features progress toward a more obvious anaphylactic picture.',
      'The patient becomes more hoarse, more wheezy, more flushed, or more unstable if the correct pattern is missed.',
      'Failure to act early makes the call feel progressively more dangerous.',
      'A delayed response should create a worsening or more dramatic allergic trajectory.'
    ],
    incorrect: [
      'Prioritizing secondary treatments while delaying epinephrine in a true anaphylaxis picture worsens care quality.',
      'Treating wheeze alone while missing airway or systemic compromise creates a strong clinical error.',
      'Unfocused oxygen or medication use should not hide missed pattern recognition.',
      'Missing repeat epinephrine need after reassessment should affect progression meaningfully.'
    ],
    midComplications: [
      'Voice changes or throat symptoms worsen on reassessment.',
      'The rash becomes more obvious or generalized over time.',
      'The patient becomes more frightened and less able to communicate clearly.',
      'Bystanders reveal the exposure was more significant than first believed.'
    ]
  },

  diabetic_or_metabolic: {
    treated: [
      'Correct identification of hypoglycemia leads to appropriate oral glucose or glucagon based on the patient’s ability to safely swallow.',
      'Serial LOC and BGL reassessment show believable improvement rather than instant perfection.',
      'If nausea becomes relevant later, transport-phase symptom support may be appropriate.',
      'Even after improvement, the case should still reward transport thinking and cause-focused history.'
    ],
    untreated: [
      'Confusion, diaphoresis, weakness, or decreased LOC continue or worsen if glucose problems are not recognized or treated.',
      'The patient remains unsafe, unreliable, or vulnerable to further decline.',
      'Failure to reassess glucose and mental status should make the call feel incomplete and riskier.',
      'A missed metabolic problem may begin to mimic broader neurologic or medical deterioration.'
    ],
    incorrect: [
      'Giving oral glucose to a patient who cannot safely swallow is an airway and judgment error.',
      'Giving glucagon reflexively when oral glucose was feasible makes the scenario less thoughtful.',
      'Treating before confirming direction through assessment and BGL weakens reasoning.',
      'Failure to repeat BGL or reassess LOC after intervention lowers care quality significantly.'
    ],
    midComplications: [
      'The patient becomes nauseated or vomits during recovery.',
      'Collateral reveals insulin use, missed meals, or exertion history late in the call.',
      'The patient improves mentally but remains weak and not fully back to baseline.',
      'A second reassessment forces the crew to decide whether improvement is enough to change their next steps.'
    ]
  },

  infectious_or_sepsis: {
    treated: [
      'Thoughtful reassessment, perfusion awareness, oxygen only if indicated, and early transport strengthen the scenario meaningfully.',
      'The patient may remain unwell while looking better recognized and better prioritized.',
      'Correct care should make trend recognition the central success, not dramatic reversal.',
      'The crew should look proactive and transport-focused rather than medication-focused.'
    ],
    untreated: [
      'Perfusion, weakness, breathing, or mental status gradually worsen.',
      'The patient becomes more pale, more tired, more febrile, or more unstable over time.',
      'Delay should increase the sense of systemic illness and urgency.',
      'Poor recognition turns the case into a more advanced illness state by the second set of vitals.'
    ],
    incorrect: [
      'Forcing medications into a sepsis-style case distracts from the real priorities of recognition and transport.',
      'Failure to trend vitals or appreciate systemic illness lowers the realism of care.',
      'Missing worsening perfusion or mental status should affect progression noticeably.',
      'Unnecessary oxygen or misplaced treatment focus should not meaningfully improve the patient.'
    ],
    midComplications: [
      'Nausea or vomiting emerges during the call.',
      'Mental status worsens subtly but meaningfully.',
      'A collateral source reveals a longer or more severe infectious course.',
      'Blood pressure or perfusion looks worse on the second set of vitals.'
    ]
  },

  nausea_vomiting_or_dehydration: {
    treated: [
      'Thoughtful antiemetic use when symptoms truly justify it makes the patient more comfortable and easier to transport.',
      'Good care still reflects attention to cause, dehydration risk, and reassessment rather than simply stopping vomiting.',
      'The patient may improve somewhat but remain weak, orthostatic, or transport-worthy.',
      'Supportive care and abdominal or general illness assessment should remain meaningful.'
    ],
    untreated: [
      'Nausea, vomiting, weakness, and dehydration features continue or worsen.',
      'The patient becomes more uncomfortable, dizzy, or volume depleted.',
      'Repeated vomiting or poor intake increases transport urgency and reassessment importance.',
      'Failure to monitor trend turns the case into a more obviously deteriorating GI illness.'
    ],
    incorrect: [
      'Using ondansetron as a substitute for broader clinical thinking can hide more serious illness.',
      'Forcing fluid or medication decisions without regard to case framing weakens coherence.',
      'Missing dehydration severity or broader metabolic clues lowers quality of care.',
      'Unnecessary treatments should not produce disproportionate improvement.'
    ],
    midComplications: [
      'The patient vomits again during packaging or transport.',
      'Orthostatic symptoms or weakness worsen when moved.',
      'Abdominal pain becomes more prominent on reassessment.',
      'Collateral reveals a more concerning intake, medication, or illness history.'
    ]
  },

  neurologic_or_syncope: {
    treated: [
      'Strong assessment, glucose check, neuro reassessment, and transport reasoning make this a higher-quality scenario even without medication.',
      'The patient may look improved superficially while the crew still recognizes ongoing risk.',
      'Good care should feel methodical and differential-driven.',
      'Appropriate restraint with medications is part of correct management here.'
    ],
    untreated: [
      'The patient remains diagnostically unclear and clinically risky due to weak reassessment.',
      'Symptoms such as dizziness, confusion, or near-syncope persist or recur.',
      'Missed glucose, ECG, or witness details weaken the management significantly.',
      'The overall call becomes more uncertain and potentially more urgent over time.'
    ],
    incorrect: [
      'Forcing medications without a clear target distracts from the learning value of neurologic and syncopal assessment.',
      'Premature diagnostic closure creates preventable misses.',
      'Failure to trend LOC or recognize a second episode lowers care quality.',
      'Treating the patient as already fine because they woke up is a realistic error.'
    ],
    midComplications: [
      'The patient becomes dizzy or presyncopal again during movement.',
      'Witness information changes the differential significantly.',
      'The second set of vitals reveals a more concerning trend.',
      'A glucose or ECG result becomes more relevant than first expected.'
    ]
  },

  geriatric_multi_problem: {
    treated: [
      'Careful restraint, medication review, collateral history, and trend recognition make the call feel realistic and well managed.',
      'The patient may not improve dramatically, but the crew looks more clinically thoughtful and safer.',
      'Supportive care and transport priority should matter more than trying to force a simple fix.',
      'Good care often includes recognizing what not to give.'
    ],
    untreated: [
      'Weakness, confusion, dyspnea, or vague illness continues to worsen due to poor synthesis of the bigger picture.',
      'The patient becomes more obviously unwell as the overlapping contributors are missed.',
      'Failure to gather collateral history weakens the entire case.',
      'Trend-based urgency is lost if the call is treated too casually.'
    ],
    incorrect: [
      'Reflex medication use in an unclear geriatric presentation can create more confusion than value.',
      'Ignoring polypharmacy, recent illness, or baseline function reduces realism and safety.',
      'Missing a contraindication or overconfidently choosing one explanation too early harms case quality.',
      'Failure to reassess after initial impression is a meaningful error here.'
    ],
    midComplications: [
      'Family adds a late medication or baseline cognition detail.',
      'The patient deteriorates subtly rather than dramatically.',
      'Movement or exertion worsens weakness or dyspnea.',
      'A vague complaint becomes more clearly serious on the second assessment.'
    ]
  },

  toxicology_or_overdose: {
    treated: [
      'Airway positioning, ventilation support, and opioid-targeted naloxone use only when justified create a strong and realistic trajectory.',
      'If naloxone is appropriate, the patient should improve in a believable, incomplete way rather than instantly normalizing.',
      'Repeat naloxone after reassessment may be appropriate if the opioid picture remains convincing.',
      'Even with improvement, transport and recurrent sedation risk should remain important.'
    ],
    untreated: [
      'Hypoventilation, decreased LOC, and airway risk persist or worsen.',
      'The patient remains inadequately oxygenated or ventilated if basic priorities are missed.',
      'Failure to support breathing should make the call feel increasingly dangerous.',
      'The scenario should reward crews who treat airway and breathing before chasing a label.'
    ],
    incorrect: [
      'Using naloxone as a substitute for ventilation-first priorities is a core management error.',
      'Forcing naloxone into a mixed or unclear presentation without a convincing opioid picture weakens the call.',
      'Failure to reassess respiratory status after intervention lowers care quality.',
      'Ignoring glucose or other alternative causes of altered LOC creates a preventable miss.'
    ],
    midComplications: [
      'The patient becomes combative or confused after partial improvement.',
      'Respiratory effort improves only partially, forcing a second decision.',
      'Paraphernalia or collateral information changes how convincing the opioid picture looks.',
      'Vomiting or aspiration risk becomes more prominent after treatment.'
    ]
  },

  fall_trauma: {
    treated: [
      'Thoughtful packaging, movement, and selective analgesia only when safe make the call feel more realistic and controlled.',
      'Pain improves somewhat with proper immobilization, splinting strategy, or selective medication use.',
      'Reassessment after movement or treatment should show whether comfort and perfusion have actually improved.',
      'The scenario should still feel transport-worthy even if pain is partly controlled.'
    ],
    untreated: [
      'Pain, anxiety, or movement intolerance worsen during the call.',
      'The patient becomes more difficult to package or remove due to inadequate planning.',
      'Shock signs or occult injury concern may become more obvious with delay.',
      'Poor handling makes the fall look more serious and less controlled over time.'
    ],
    incorrect: [
      'Giving ketorolac despite contraindications or instability creates a realistic judgment error.',
      'Moving the patient poorly or too early increases pain and lowers scenario quality.',
      'Treating the fall as minor without reassessment can miss important progression or associated injury.',
      'Ignoring transport and packaging planning undermines otherwise decent assessment.'
    ],
    midComplications: [
      'Pain spikes during movement from the scene.',
      'A late detail suggests the fall may have had a medical trigger.',
      'Nausea develops after pain worsens or after a head strike detail emerges.',
      'Distal circulation or neurovascular findings change after repositioning.'
    ]
  },

  blunt_trauma: {
    treated: [
      'Organized trauma assessment, bleeding control, packaging, and transport priority improve the realism of the case.',
      'The patient may remain injured but look better managed and less chaotic.',
      'The scenario should reward staying systematic rather than rushing toward one dramatic finding.',
      'Supportive trauma care should matter more than forcing medications.'
    ],
    untreated: [
      'Pain, shock signs, or hidden injury concerns become more obvious with time.',
      'Poor trauma organization leads to a less controlled and more concerning call.',
      'Bleeding, chest discomfort, or abdominal findings may worsen on reassessment.',
      'Delay should make the call feel less stable and more urgent.'
    ],
    incorrect: [
      'Fixating on one visible injury while missing the broader trauma picture weakens care quality.',
      'Forcing medication use when trauma priorities should dominate lowers coherence.',
      'Inadequate packaging, repeated unnecessary movement, or missed shock signs worsen the case.',
      'Failure to reassess after movement or intervention is a meaningful error.'
    ],
    midComplications: [
      'The patient becomes more pale and uncomfortable during packaging.',
      'A hidden injury clue appears on secondary assessment.',
      'Chest or abdominal pain becomes more significant over time.',
      'The mechanism proves more serious than it first seemed.'
    ]
  },

    isolated_extremity_injury: {
    treated: [
      'Pain, movement tolerance, and overall comfort improve after good splinting and selective analgesia when safe.',
      'Neurovascular reassessment after splinting or medication shows whether the intervention truly helped.',
      'This case should reward doing the basics well rather than theatrics.',
      'Good supportive care should still matter even if medication is used.'
    ],
    untreated: [
      'Pain remains high, movement becomes harder, and the patient becomes more distressed.',
      'Poor splinting or delayed immobilization makes transport less comfortable and less professional.',
      'The patient may become increasingly guarded or difficult to assess due to pain.',
      'A basic injury call becomes more frustrating and less controlled with delay.'
    ],
    incorrect: [
      'Giving ketorolac despite contraindications is a realistic medication safety issue.',
      'Medication before neurovascular assessment or without addressing splinting weakens the scenario logic.',
      'Poor splinting technique or missed distal checks is a meaningful performance error.',
      'Treating the case as trivial without reassessment lowers quality.'
    ],
    midComplications: [
      'Pain worsens sharply when the limb is moved.',
      'Distal circulation, sensation, or movement changes after repositioning.',
      'A deformity becomes more obvious once clothing is removed.',
      'The patient becomes more anxious or resistant because of pain.'
    ]
  },

  head_injury: {
    treated: [
      'Serial GCS checks, vomiting management, neuro reassessment, and transport urgency create a stronger scenario than medication-heavy care.',
      'The patient may remain symptomatic, but good monitoring and scene decisions improve safety.',
      'Appropriate restraint in analgesic use is part of the correct management of this case.',
      'The scenario should reward noticing subtle neurologic change over time.'
    ],
    untreated: [
      'Vomiting, confusion, headache, or LOC concerns continue or worsen.',
      'The patient becomes more clearly neurologically concerning on reassessment.',
      'Poor reassessment makes the injury look increasingly under-managed.',
      'Transport urgency should rise if deterioration is missed or delayed.'
    ],
    incorrect: [
      'Forcing analgesia into a neuro-monitoring-focused head injury call weakens the priorities.',
      'Failure to trend GCS or notice neurologic change is a significant error.',
      'Ignoring aspiration risk when vomiting is present lowers care quality.',
      'Treating the case as simple pain without neuro context can create a preventable miss.'
    ],
    midComplications: [
      'Vomiting begins or worsens during the call.',
      'The patient becomes more confused or slower to respond.',
      'A witness provides a more concerning mechanism or LOC detail.',
      'Movement makes headache, dizziness, or nausea worse.'
    ]
  },

  heat_illness: {
    treated: [
      'Cooling, moving the patient out of the environment, and supportive care produce believable partial improvement.',
      'The patient may feel somewhat better after proper environmental management without becoming instantly normal.',
      'Temperature, perfusion, and LOC reassessment should shape the ongoing urgency of the call.',
      'Medication, if used at all, should remain secondary to environmental management.'
    ],
    untreated: [
      'Weakness, nausea, confusion, or heat stress signs continue to worsen.',
      'The patient becomes more fatigued, more altered, or more unstable if not cooled and moved appropriately.',
      'Delay should make the case feel more dangerous and more physiology-driven.',
      'The second set of vitals should reflect persistent heat-related compromise.'
    ],
    incorrect: [
      'Overemphasizing medication while underemphasizing cooling and scene removal weakens the case logic.',
      'Failure to recognize environmental severity lowers care quality and realism.',
      'Inadequate reassessment of mentation or perfusion creates a preventable miss.',
      'Unnecessary oxygen or other reflex treatments should not replace core management.'
    ],
    midComplications: [
      'The patient becomes more confused during movement.',
      'Vomiting or dizziness worsens during packaging.',
      'A collapse or near-collapse occurs when the patient tries to stand.',
      'Collateral reveals longer exposure or exertion than first described.'
    ]
  },

  cold_exposure: {
    treated: [
      'Rewarming, gentle handling, and careful reassessment produce believable stabilization.',
      'The patient may look somewhat better once sheltered, but ongoing transport remains appropriate.',
      'Good care is shown through environmental management, not medication count.',
      'Serial LOC and temperature-linked reassessment make the scenario feel grounded.'
    ],
    untreated: [
      'Shivering, confusion, weakness, or cold stress continue to worsen with delay.',
      'The patient becomes more altered or less able to compensate over time.',
      'Poor scene-to-ambulance planning should make the call feel less controlled.',
      'The overall scenario should become more physiologically concerning.'
    ],
    incorrect: [
      'Overhandling or treating the call casually despite exposure severity lowers realism.',
      'Forcing medications into a cold exposure case weakens the learning priorities.',
      'Failure to appreciate environmental contribution can lead to diagnostic drift.',
      'Ignoring reassessment after warming efforts is a meaningful error.'
    ],
    midComplications: [
      'The patient becomes more confused when moved.',
      'Collateral reveals alcohol use, prolonged exposure, or inadequate clothing.',
      'A second complaint such as injury or hypoglycemia becomes relevant.',
      'The patient’s shivering stops and the presentation becomes more concerning.'
    ]
  },

  exposure_or_toxin: {
    treated: [
      'Scene safety, removal from exposure, and focused reassessment improve the realism and control of the call.',
      'Selective symptom treatment may help if clearly justified, but scene management remains the central success.',
      'The patient may improve somewhat after removal from exposure without becoming completely fine.',
      'Good care should emphasize operational awareness and evolving reassessment.'
    ],
    untreated: [
      'Symptoms such as headache, dizziness, nausea, or respiratory irritation persist or worsen.',
      'Failure to remove the patient from the environment makes the call feel unsafe and increasingly problematic.',
      'The overall case becomes more operationally strained over time.',
      'The second reassessment should make the exposure more clearly important.'
    ],
    incorrect: [
      'Medicating away an unsafe scene instead of controlling the environment is a major management flaw.',
      'Forcing bronchodilators without true bronchospasm lowers coherence.',
      'Missing the possibility of multiple-patient or environmental risk weakens situational awareness.',
      'Unfocused treatment without scene logic should not meaningfully improve the patient.'
    ],
    midComplications: [
      'A second person at the scene becomes symptomatic.',
      'Respiratory irritation worsens after a short delay.',
      'Scene information reveals a more specific chemical or inhalational exposure.',
      'The patient becomes more anxious or more unsteady during removal.'
    ]
  }
};

function buildCaseProgressionProfile(subtype) {
  return (
    CASE_PROGRESSION_LIBRARY[subtype] || {
      treated: [
        'The patient shows believable improvement or stabilization with appropriate assessment, reassessment, and treatment.',
        'Correct care should make the scenario feel more organized and safer.',
        'Improvement may be partial rather than complete.',
        'Transport and monitoring should still matter.'
      ],
      untreated: [
        'The patient’s condition gradually worsens or fails to improve without appropriate care.',
        'Delayed reassessment should increase risk and uncertainty.',
        'Symptoms should remain clinically meaningful on the second set of vitals.',
        'The call should feel less controlled over time.'
      ],
      incorrect: [
        'Inappropriate or poorly timed treatment should create believable consequences or missed opportunities.',
        'A medication safety issue or judgment error should worsen the realism of the case.',
        'Failure to reassess should lower care quality.',
        'The wrong management focus should not be rewarded.'
      ],
      midComplications: [
        'A meaningful reassessment change occurs mid-scenario.',
        'Collateral history changes how the crew interprets the case.',
        'Movement or packaging worsens symptoms temporarily.',
        'A delayed clue reveals additional risk.'
      ]
    }
  );
}

function defaultVitalSet() {
  return {
    context: '',
    hr: '',
    rr: '',
    bp: '',
    spo2: '',
    etco2: '',
    temp: '',
    gcs: '',
    bgl: '',
    ecgInterpretation: ''
  };
}

function defaultPatientDemographics() {
  return {
    name: '',
    sex: '',
    age: '',
    height: '',
    weight: '',
    appearance: '',
    chiefComplaint: ''
  };
}

function defaultPhysicalExam() {
  return {
    generalAppearance: '',
    airway: '',
    breathing: '',
    circulation: '',
    neuro: '',
    headNeck: '',
    chest: '',
    abdomen: '',
    pelvis: '',
    extremities: '',
    skin: ''
  };
}

function defaultGrsAnchors() {
  return {
    situationalAwareness: { 3: [], 5: [], 7: [] },
    patientAssessment: { 3: [], 5: [], 7: [] },
    historyGathering: { 3: [], 5: [], 7: [] },
    decisionMaking: { 3: [], 5: [], 7: [] },
    communication: { 3: [], 5: [], 7: [] },
    resourceUtilization: { 3: [], 5: [], 7: [] },
    proceduralSkills: { 3: [], 5: [], 7: [] }
  };
}

const REQUIRED_FIELDS = {
  scenarioIntro: '',
  title: '',

  callInformation: {
    type: '',
    location: '',
    time: '',
    shift: '',
    dispatchCode: '',
    dispatchNotes: [],
    hazardsOrFlags: [],
    crewNotes: ''
  },

  patientDemographics: defaultPatientDemographics(),

  patientPresentation: '',
  incidentNarrative: '',

  sceneArrival: {
    sceneDescription: '',
    environmentDetails: [],
    hazards: [],
    accessIssues: '',
    bystandersPresent: '',
    sceneEnergy: ''
  },

  firstImpression: {
    generalAppearance: '',
    levelOfDistress: '',
    apparentSeverity: '',
    positionFound: '',
    visibleClues: [],
    initialRedFlags: []
  },

  initialAssessment: {
    airway: '',
    breathing: '',
    circulation: '',
    disability: '',
    exposure: '',
    generalImpression: '',
    immediatePriorities: [],
    immediateInterventions: []
  },

  historyGathering: {
    historySource: '',
    additionalHistory: [],
    bystanderInformation: [],
    contradictionsOrBarriers: [],
    sceneContextClues: []
  },

  opqrst: {
    onset: '',
    provocation: '',
    quality: '',
    radiation: '',
    severity: '',
    time: ''
  },

  sample: {
    signsAndSymptoms: '',
    allergies: '',
    medications: [],
    pastMedicalHistory: '',
    lastOralIntake: '',
    eventsLeadingUp: ''
  },

  medications: [],
  allergies: [],
  pastMedicalHistory: [],

  physicalExam: defaultPhysicalExam(),

  secondaryAssessment: {
    generalAppearance: '',
    breathing: '',
    circulation: '',
    keyFindings: [],
    missedIfNotAssessed: [],
    evolvingFindings: []
  },

  additionalAssessments: [],

  vitalSigns: {
    firstSet: defaultVitalSet(),
    secondSet: defaultVitalSet(),
    additionalSets: []
  },

  caseProgression: {
    withProperTreatment: [],
    withoutProperTreatment: [],
    withIncorrectTreatment: []
  },

  transportPhase: {
    transportConsiderations: [],
    ongoingCare: [],
    reassessmentFocus: [],
    handoffConsiderations: ''
  },

  expectedTreatment: [],
  protocolNotes: [],
  learningObjectives: [],
  selfReflectionPrompts: [],
  grsAnchors: defaultGrsAnchors(),
  teachersPoints: '',
  scenarioRationale: '',
  clinicalReasoning: '',
  directiveSources: []
};

function sanitizeOutput(raw = '') {
  return String(raw)
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();
}

function splitLinesToArray(value) {
  return String(value)
    .split(/\n+/)
    .map((line) => normalizeSentenceSpacing(line.replace(/^[-•\d.)\s]+/, '').trim()))
    .filter(Boolean);
}

const TEACHING_CUE_REGEX = /\*\(💡(?:([a-z]+)\|)?\s*(.+?)\s*\)\*/gi;
const TEACHING_CUE_GENERIC_PHRASES = [
  'monitor closely',
  'reassess as needed',
  'prepare for transport',
  'continue to monitor',
  'watch closely',
  'keep reassessing',
  'be prepared',
  'stay vigilant',
  'before committing, verbalize how'
];
const TEACHING_POINT_GENERIC_PHRASES = [
  'this scenario highlights the importance',
  'the learner should',
  'the student should',
  'appropriate management would include',
  'monitor closely',
  'reassess as needed',
  'prepare for transport',
  'remember to',
  'it is important to'
];
const TEACHING_CUE_COACHING_VERBS = [
  'ask',
  'call',
  'commit',
  'declare',
  'define',
  'describe',
  'focus',
  'frame',
  'go',
  'identify',
  'link',
  'list',
  'look',
  'map',
  'state',
  'name',
  'notice',
  'pick',
  'pressure-test',
  'reassess',
  'read',
  'report',
  'assign',
  'say',
  'spot',
  'stress-test',
  'summarize',
  'confirm',
  'prioritize',
  'trend',
  'treat',
  'use',
  'verify',
  'watch',
  'pivot',
  'escalate',
  'explain',
  'decide',
  'check'
];
const TEACHING_CUE_TAG_ALIASES = {
  med: 'medication',
  meds: 'medication',
  medsafety: 'medication',
  vital: 'vitals',
  vitals: 'vitals',
  handover: 'handoff',
  diff: 'differential',
  differentials: 'differential'
};
const TEACHING_CUE_MAX_CHARS = 150;
const TEACHING_CUE_MIN_CHARS = 24;

function stripDisallowedTeachingEmoji(value) {
  return String(value || '')
    .replace(/🧠/g, '')
    .replace(/\bbrain emoji\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function normalizeSentenceSpacing(value) {
  return stripDisallowedTeachingEmoji(value)
    .replace(/([.!?])(?=(?:["')\]]?[A-Za-z]))/g, '$1 ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function trimToWordBoundary(value, maxLen) {
  const normalized = normalizeSentenceSpacing(String(value || ''));
  if (!normalized || normalized.length <= maxLen) return normalized;
  const sliced = normalized.slice(0, maxLen + 1);
  const boundary = sliced.lastIndexOf(' ');
  return normalizeSentenceSpacing((boundary > 24 ? sliced.slice(0, boundary) : normalized.slice(0, maxLen)).trim());
}

function ensureCueSentenceEnding(value) {
  const normalized = normalizeSentenceSpacing(String(value || ''))
    .replace(/[,;:]\s*$/g, '')
    .trim();
  if (!normalized) return '';
  return /[.!?]$/.test(normalized) ? normalized : `${normalized}.`;
}

function compactTeachingCueText(value, maxLen = TEACHING_CUE_MAX_CHARS) {
  const normalized = normalizeSentenceSpacing(String(value || ''))
    .replace(/\.{3,}/g, '.')
    .replace(/\s*\.\s*\.\s*\.\s*/g, '. ')
    .trim();

  if (!normalized) return '';

  const sentences = normalized
    .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
    .map((part) => normalizeSentenceSpacing(part))
    .filter(Boolean);

  if (!sentences.length) {
    return ensureCueSentenceEnding(trimToWordBoundary(normalized, maxLen));
  }

  const kept = [];
  for (const sentence of sentences) {
    const candidate = [...kept, sentence].join(' ');
    if (kept.length > 0 && candidate.length > maxLen) break;
    kept.push(sentence);
    if (kept.length >= 2) break;
  }

  if (kept.length) {
    const compact = ensureCueSentenceEnding(kept.join(' '));
    if (compact.length <= maxLen) return compact;
    if (kept[0]) return ensureCueSentenceEnding(trimToWordBoundary(kept[0], maxLen));
  }

  return ensureCueSentenceEnding(trimToWordBoundary(normalized, maxLen));
}

function stripTeachingCueMarkup(value) {
  return String(value || '')
    .replace(TEACHING_CUE_REGEX, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function normalizeTeachingCueTag(tag) {
  const normalized = String(tag || '').trim().toLowerCase();
  if (!normalized) return '';
  return TEACHING_CUE_TAG_ALIASES[normalized] || normalized;
}

function applyTeachingCuePreference(value, includeTeachingCues) {
  if (Array.isArray(value)) {
    return value
      .map((item) => applyTeachingCuePreference(item, includeTeachingCues))
      .filter((item) => !(typeof item === 'string' && !item.trim()));
  }

  if (value && typeof value === 'object') {
    const normalized = {};
    for (const [key, item] of Object.entries(value)) {
      normalized[key] = applyTeachingCuePreference(item, includeTeachingCues);
    }
    return normalized;
  }

  if (typeof value === 'string') {
    const normalized = normalizeSentenceSpacing(value);
    return includeTeachingCues ? normalized : stripTeachingCueMarkup(normalized);
  }

  return value;
}

function getTeachingCueMatches(text) {
  const value = String(text || '');
  const matches = [];
  let match;
  TEACHING_CUE_REGEX.lastIndex = 0;

  while ((match = TEACHING_CUE_REGEX.exec(value)) !== null) {
    matches.push({
      tag: normalizeTeachingCueTag(match[1]),
      text: normalizeSentenceSpacing(match[2] || ''),
      raw: match[0],
      index: match.index
    });
  }

  TEACHING_CUE_REGEX.lastIndex = 0;
  return matches;
}

function fingerprintCueText(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(the|and|that|with|from|into|this|then|they|their|your|while|before|after|during)\b/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function fingerprintCueOpening(text) {
  const cleaned = String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  if (!cleaned) return '';

  const words = cleaned
    .split(/\s+/)
    .filter(Boolean)
    .filter((word) => !['the', 'a', 'an', 'this', 'that', 'your', 'you'].includes(word));

  return words.slice(0, 4).join(' ');
}

function hasRecentCueFingerprint(text) {
  const fp = fingerprintCueText(text);
  if (!fp) return false;
  return recentCueFingerprints.includes(fp);
}

function hasRecentCueOpening(text) {
  const fp = fingerprintCueOpening(text);
  if (!fp) return false;
  return recentCueOpenings.includes(fp);
}

function rememberScenarioCueFingerprints(scenario) {
  if (!scenario || typeof scenario !== 'object') return;
  const fingerprints = [];
  const openings = [];

  function walk(value) {
    if (typeof value === 'string') {
      const cues = getTeachingCueMatches(value);
      for (const cue of cues) {
        const fp = fingerprintCueText(cue.text);
        if (fp) fingerprints.push(fp);
        const opening = fingerprintCueOpening(cue.text);
        if (opening) openings.push(opening);
      }
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((item) => walk(item));
      return;
    }

    if (value && typeof value === 'object') {
      Object.values(value).forEach((child) => walk(child));
    }
  }

  walk(scenario);

  const unique = [...new Set(fingerprints)];
  const uniqueOpenings = [...new Set(openings)];
  if (!unique.length) return;

  recentCueFingerprints = [...recentCueFingerprints, ...unique].slice(-RECENT_CUE_FINGERPRINT_WINDOW);
  recentCueOpenings = [...recentCueOpenings, ...uniqueOpenings].slice(-RECENT_CUE_OPENING_WINDOW);
}

function countGenericCueSignals(text) {
  const lower = String(text || '').toLowerCase();
  return TEACHING_CUE_GENERIC_PHRASES.reduce(
    (count, phrase) => count + (lower.includes(phrase) ? 1 : 0),
    0
  );
}

function extractDoseMentions(text) {
  const source = String(text || '');
  if (!source) return [];

  const pattern = /\b(?:[a-z][a-z0-9\-/ ]{0,24}\s+)?\d+(?:\.\d+)?\s?(?:mg|mcg|g|ml|mL|units?|iu)(?:\s?(?:iv|im|po|sl|neb|io|in))?\b/gi;
  const matches = source.match(pattern) || [];
  return [...new Set(matches.map((value) => normalizeSentenceSpacing(value).toLowerCase()))];
}

function collectSupportedDoseMentions(scenario) {
  const sources = [
    ...(scenario?.expectedTreatment || []),
    ...(scenario?.protocolNotes || []),
    ...(scenario?.initialAssessment?.immediateInterventions || []),
    ...(scenario?.medications || []),
    ...(scenario?.sample?.medications || [])
  ];

  return new Set(
    sources
      .flatMap((line) => extractDoseMentions(line))
      .filter(Boolean)
  );
}

function cueHasUnsupportedDoseReference(cueText, supportedDoseMentions) {
  const cueDoseMentions = extractDoseMentions(cueText);
  if (!cueDoseMentions.length) return false;
  return cueDoseMentions.some((mention) => !supportedDoseMentions.has(mention));
}

function countUnsupportedDoseCueReferences(scenario) {
  if (!scenario || typeof scenario !== 'object') return 0;

  const supportedDoseMentions = collectSupportedDoseMentions(scenario);
  let unsupportedCount = 0;

  function walk(value) {
    if (typeof value === 'string') {
      const cues = getTeachingCueMatches(value);
      for (const cue of cues) {
        if (cueHasUnsupportedDoseReference(cue.text, supportedDoseMentions)) {
          unsupportedCount += 1;
        }
      }
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((item) => walk(item));
      return;
    }

    if (value && typeof value === 'object') {
      Object.values(value).forEach((child) => walk(child));
    }
  }

  walk(scenario);
  return unsupportedCount;
}

function stripUnsupportedDoseCuesFromString(value, supportedDoseMentions, counterRef) {
  const source = String(value || '');
  if (!source) return source;

  TEACHING_CUE_REGEX.lastIndex = 0;
  const cleaned = source
    .replace(TEACHING_CUE_REGEX, (raw, tag, text) => {
      if (cueHasUnsupportedDoseReference(text, supportedDoseMentions)) {
        counterRef.removed += 1;
        return '';
      }
      return raw;
    })
    .replace(/\s{2,}/g, ' ')
    .trim();
  TEACHING_CUE_REGEX.lastIndex = 0;

  return cleaned;
}

function enforceDoseCueSafety(scenario, includeTeachingCues) {
  if (!includeTeachingCues || !scenario || typeof scenario !== 'object') {
    return scenario;
  }

  const supportedDoseMentions = collectSupportedDoseMentions(scenario);
  const counterRef = { removed: 0 };

  function walk(value) {
    if (typeof value === 'string') {
      return stripUnsupportedDoseCuesFromString(value, supportedDoseMentions, counterRef);
    }

    if (Array.isArray(value)) {
      return value.map((item) => walk(item));
    }

    if (value && typeof value === 'object') {
      const next = {};
      for (const [key, child] of Object.entries(value)) {
        next[key] = walk(child);
      }
      return next;
    }

    return value;
  }

  const sanitized = walk(scenario);
  if (counterRef.removed > 0) {
    devWarn(`Removed ${counterRef.removed} teaching cue(s) with unsupported dose references.`);
  }
  return sanitized;
}

function cueUsesInstructorVoice(text) {
  const lower = String(text || '').toLowerCase();
  const hasDirectAddress = /\byou\b|\byour\b/.test(lower);
  const escapedVerbs = TEACHING_CUE_COACHING_VERBS.map((verb) => verb.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const coachingVerbPattern = new RegExp(`\\b(?:${escapedVerbs.join('|')})(?:ed|ing|s)?\\b`, 'i');
  const imperativePattern = new RegExp(`^(?:${escapedVerbs.join('|')})\\b`, 'i');
  const hasCoachingVerb = coachingVerbPattern.test(lower);
  const startsImperative = imperativePattern.test(lower.trim());
  return hasDirectAddress || hasCoachingVerb || startsImperative;
}

function extractCueKeywords(text) {
  return [...new Set(
    String(text || '')
      .toLowerCase()
      .match(/[a-z]{5,}/g) || []
  )];
}

function buildCueSpecificityTokenSet(scenario) {
  const c = buildCueContext(scenario);
  const seedText = [
    c.chiefComplaint,
    c.location,
    c.vitalAnchor,
    c.vitalTrendAnchor,
    c.mechanismAnchor,
    c.barrierAnchor,
    c.reassessmentAnchor,
    c.treatmentAnchor,
    c.protocolActionAnchor,
    c.pitfallAnchor,
    c.progressionAnchor,
    c.transportAnchor,
    scenario?.callInformation?.type,
    scenario?.patientDemographics?.chiefComplaint
  ].join(' ');

  return new Set(extractCueKeywords(seedText));
}

function cueLooksScenarioSpecific(cueText, specificityTokens) {
  const text = String(cueText || '');
  const lower = text.toLowerCase();
  if (!lower.trim()) return false;

  const hasConcreteSignal =
    /\b\d+(?:\.\d+)?\b/.test(lower) ||
    /\b(spo2|etco2|rr|hr|bp|gcs|12-lead|right-sided|contraindication|reassessment|deterioration|handoff|transport)\b/i.test(lower);

  const tokenHitCount = [...specificityTokens].reduce(
    (count, token) => count + (token.length >= 5 && lower.includes(token) ? 1 : 0),
    0
  );

  return tokenHitCount >= 1 || hasConcreteSignal;
}

function cueSeemsCoherent(cueText) {
  const text = normalizeSentenceSpacing(String(cueText || ''));
  if (!text) return false;

  const lower = text.toLowerCase();
  const wordCount = lower.split(/\s+/).filter(Boolean).length;
  const hasVerb = /\b(is|are|has|have|do|does|use|check|name|state|reassess|assign|confirm|prioritize|trend|pivot|escalate|link|explain|decide|watch|treat|ask|report|match|avoid|build|tie|keep)\b/i.test(text);
  const hasDanglingJoin = /\b(and|or|but|because|then|if|before|after|while|with|for|to)\.?$/i.test(text);
  const hasBrokenSymbols = /->|=>|\(|\)$/.test(text);

  if (wordCount < 5) return false;
  if (!hasVerb) return false;
  if (hasDanglingJoin) return false;
  if (hasBrokenSymbols) return false;
  return /[.!?]$/.test(text);
}

function cueSpecificityStrength(cueText, specificityTokens) {
  const lower = String(cueText || '').toLowerCase();
  if (!lower.trim()) return 0;

  const tokenHitCount = [...specificityTokens].reduce(
    (count, token) => count + (token.length >= 5 && lower.includes(token) ? 1 : 0),
    0
  );
  const concreteSignals = (lower.match(/\b\d+(?:\.\d+)?\b/g) || []).length +
    (lower.match(/\b(spo2|etco2|rr|hr|bp|gcs|12-lead|right-sided|contraindication|reassessment|deterioration|handoff|transport|scene|history|trend)\b/gi) || []).length;
  return tokenHitCount * 2 + Math.min(concreteSignals, 3);
}

function cuesAreTooSimilar(leftText, rightText) {
  const left = new Set(extractCueKeywords(leftText).filter((token) => token.length >= 5));
  const right = new Set(extractCueKeywords(rightText).filter((token) => token.length >= 5));
  if (!left.size || !right.size) {
    return fingerprintCueText(leftText) === fingerprintCueText(rightText);
  }

  let overlap = 0;
  left.forEach((token) => {
    if (right.has(token)) overlap += 1;
  });

  const similarity = overlap / Math.max(left.size, right.size);
  return similarity >= 0.6 || fingerprintCueText(leftText) === fingerprintCueText(rightText);
}

function enforceTeachingCueSectionDiscipline(scenario, includeTeachingCues) {
  if (!includeTeachingCues || !scenario || typeof scenario !== 'object') {
    return scenario;
  }

  const specificityTokens = buildCueSpecificityTokenSet(scenario);
  const sectionState = new Map();

  const shouldKeepCue = (sectionKey, cue) => {
    const state = sectionState.get(sectionKey) || { kept: [] };
    if (state.kept.length >= 2) return false;
    if (state.kept.some((existing) => cuesAreTooSimilar(existing.text, cue.text))) return false;

    const score = cueSpecificityStrength(cue.text, specificityTokens) +
      (cueUsesInstructorVoice(cue.text) ? 2 : 0) +
      (cueSeemsCoherent(cue.text) ? 1 : 0);

    if (score < 3) return false;

    state.kept.push({ text: cue.text, score });
    sectionState.set(sectionKey, state);
    return true;
  };

  const sanitizeString = (value, sectionKey) => {
    const source = String(value || '');
    if (!source) return source;

    TEACHING_CUE_REGEX.lastIndex = 0;
    const cleaned = source
      .replace(TEACHING_CUE_REGEX, (raw, tag, text) => {
        const compactText = compactTeachingCueText(text);
        if (!compactText) return '';
        const cue = { tag: String(tag || '').toLowerCase(), text: compactText };
        return shouldKeepCue(sectionKey, cue) ? createCue(cue.text, cue.tag) : '';
      })
      .replace(/\s{2,}/g, ' ')
      .trim();
    TEACHING_CUE_REGEX.lastIndex = 0;
    return cleaned;
  };

  const walk = (value, sectionKey = 'root') => {
    if (typeof value === 'string') return sanitizeString(value, sectionKey);
    if (Array.isArray(value)) return value.map((item) => walk(item, sectionKey)).filter(Boolean);
    if (value && typeof value === 'object') {
      const next = {};
      for (const [key, child] of Object.entries(value)) {
        next[key] = walk(child, sectionKey === 'root' ? key : sectionKey);
      }
      return next;
    }
    return value;
  };

  return walk(scenario, 'root');
}

function enforceTeachingCueSpecificity(scenario, includeTeachingCues) {
  if (!includeTeachingCues || !scenario || typeof scenario !== 'object') {
    return scenario;
  }

  const specificityTokens = buildCueSpecificityTokenSet(scenario);

  function sanitizeString(value) {
    const source = String(value || '');
    if (!source) return source;

    TEACHING_CUE_REGEX.lastIndex = 0;
    const cleaned = source
      .replace(TEACHING_CUE_REGEX, (raw, tag, text) => {
        const compactText = compactTeachingCueText(text);
        const genericSignals = countGenericCueSignals(compactText);
        const weakVoice = !cueUsesInstructorVoice(compactText);
        const weakSpecificity = !cueLooksScenarioSpecific(compactText, specificityTokens);
        const incoherent = !cueSeemsCoherent(compactText);
        const tooShort = compactText.length < TEACHING_CUE_MIN_CHARS;
        if (!compactText || genericSignals > 0 || weakVoice || weakSpecificity || tooShort || incoherent) {
          return '';
        }
        return createCue(compactText, tag);
      })
      .replace(/\s{2,}/g, ' ')
      .trim();
    TEACHING_CUE_REGEX.lastIndex = 0;
    return cleaned;
  }

  function walk(value) {
    if (typeof value === 'string') return sanitizeString(value);
    if (Array.isArray(value)) return value.map((item) => walk(item));
    if (value && typeof value === 'object') {
      const next = {};
      for (const [key, child] of Object.entries(value)) {
        next[key] = walk(child);
      }
      return next;
    }
    return value;
  }

  return walk(scenario);
}

function sanitizeCustomPrompt(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 320);
}

function extractPromptKeywords(prompt) {
  return [...new Set(
    String(prompt || '')
      .toLowerCase()
      .match(/[a-z]{5,}/g) || []
  )];
}

function scenarioReflectsCustomPrompt(scenario, customPrompt) {
  const prompt = sanitizeCustomPrompt(customPrompt);
  if (!prompt) return true;

  const keywords = extractPromptKeywords(prompt).slice(0, 8);
  if (!keywords.length) return true;

  const scenarioText = collectScenarioNarrativeText(scenario);
  return keywords.some((keyword) => scenarioText.includes(keyword));
}

function stringifyValue(value) {
  if (value == null || value === '') return '';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function pickFirstDefined(...values) {
  return values.find((value) => value != null && value !== '');
}

function pickFirstObject(...values) {
  return values.find((value) => value && typeof value === 'object' && !Array.isArray(value));
}

function coerceArray(value) {
  if (Array.isArray(value)) {
    return value
      .filter(Boolean)
      .map((item) => normalizeSentenceSpacing(String(item).trim()))
      .filter(Boolean);
  }

  if (value == null || value === '') return [];

  if (typeof value === 'string') {
    const trimmed = normalizeSentenceSpacing(value.trim());
    if (!trimmed) return [];

    if (trimmed.includes('\n')) {
      return splitLinesToArray(trimmed);
    }

    const sentenceSplit = trimmed
      .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
      .map((part) => part.trim())
      .filter(Boolean);

    if (sentenceSplit.length > 1) return sentenceSplit;

    const semicolonSplit = trimmed
      .split(/\s*;\s*/)
      .map((part) => part.trim())
      .filter(Boolean);

    if (semicolonSplit.length > 1) return semicolonSplit;

    return [trimmed];
  }

  if (typeof value === 'object') {
    return Object.entries(value)
      .map(([key, val]) => {
        const rendered = stringifyValue(val);
        return rendered ? `${key}: ${rendered}` : null;
      })
      .filter(Boolean);
  }

  return [String(value)];
}

function normalizeTeachersPoints(value) {
  if (value == null || value === '') return '';

  if (Array.isArray(value)) {
    return normalizeSentenceSpacing(
      value
        .map((item) => normalizeSentenceSpacing(String(item || '').trim()))
        .filter(Boolean)
        .join(' ')
    );
  }

  return normalizeSentenceSpacing(
    String(value)
      .replace(/\s*\n+\s*/g, ' ')
      .trim()
  );
}

function teachingPointBeats(value) {
  const paragraph = normalizeTeachersPoints(value);
  if (!paragraph) return [];
  return splitTeachingPointSentences(paragraph);
}

function normalizeDirectiveSources(value) {
  const canonicalizeDirectiveSource = (source) => {
    const raw = normalizeSentenceSpacing(String(source || '').trim());
    if (!raw) return '';

    const lower = raw.toLowerCase();
    if (lower.includes('bls')) return 'BLS PCS 3.4 (2023)';
    if (lower.includes('als')) return 'ALS PCS 5.4 (2025)';
    if (lower.includes('companion')) return 'OBHG ALS PCS Companion v5.4 (2025)';
    return raw;
  };

  const normalized = coerceArray(value)
    .map((item) => canonicalizeDirectiveSource(item))
    .filter(Boolean);

  const sources = [...new Set(normalized)];
  return sources.length ? sources : [...DEFAULT_DIRECTIVE_SOURCES];
}

function mergeDeepStrict(base, incoming) {
  if (Array.isArray(base)) {
    return Array.isArray(incoming) ? incoming : base;
  }

  if (typeof base !== 'object' || base === null) {
    return incoming ?? base;
  }

  const output = { ...base };

  for (const [key, defaultValue] of Object.entries(base)) {
    output[key] = mergeDeepStrict(defaultValue, incoming?.[key]);
  }

  return output;
}

function normalizeClinicalReasoning(value) {
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean).join(' ');
  if (!value || typeof value !== 'object') return '';

  const parts = [
    value.summary,
    value.pathophysiology,
    value.conclusion || value.workingDiagnosis
  ].filter(Boolean);

  if (Array.isArray(value.differentialDiagnosis) && value.differentialDiagnosis.length) {
    const differentialText = value.differentialDiagnosis
      .map((item) => {
        if (typeof item === 'string') return item;
        return item?.condition || '';
      })
      .filter(Boolean)
      .join(', ');

    if (differentialText) {
      parts.push(`Differentials considered: ${differentialText}.`);
    }
  }

  return parts.join(' ').trim();
}

function normalizeEcgInterpretation(value) {
  const raw = normalizeSentenceSpacing(String(value || ''));
  if (!raw) return '';

  const cleaned = raw
    .replace(/[📈📉🫀❤️💓💔]/g, ' ')
    .replace(/\b(?:ecg|rhythm|interpretation|strip|12\s*-?\s*lead)\b/gi, ' ')
    .replace(/[^a-z0-9\s]/gi, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .toLowerCase();

  if (!cleaned) return '';
  if (cleaned === 'not applicable') return 'Not applicable';

  for (const allowed of ECG_WHITELIST) {
    if (cleaned === allowed.toLowerCase()) {
      return allowed;
    }
  }

  return '';
}

function clampListItemText(value, { maxWords = 24, maxChars = 170 } = {}) {
  const normalized = normalizeSentenceSpacing(String(value || '').trim());
  if (!normalized) return '';

  const words = normalized.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords && normalized.length <= maxChars) {
    return ensureCueSentenceEnding(normalized);
  }

  // Do not hard-truncate list items mid-thought; let caller limit item count instead.
  return ensureCueSentenceEnding(normalized);
}

function selectSentencesWithinLimits(sentences, { maxSentences = 4, maxWords = 120, maxChars = 760 } = {}) {
  const cleaned = (Array.isArray(sentences) ? sentences : [])
    .map((sentence) => ensureCueSentenceEnding(normalizeSentenceSpacing(String(sentence || '').trim())))
    .filter(Boolean);

  if (!cleaned.length) return [];

  const selected = [];
  let wordCount = 0;
  let charCount = 0;

  for (const sentence of cleaned) {
    if (selected.length >= maxSentences) break;

    const sentenceWords = sentence.split(/\s+/).filter(Boolean).length;
    const projectedWords = wordCount + sentenceWords;
    const projectedChars = charCount + sentence.length + (selected.length ? 1 : 0);

    if (selected.length > 0 && (projectedWords > maxWords || projectedChars > maxChars)) {
      break;
    }

    selected.push(sentence);
    wordCount = projectedWords;
    charCount = projectedChars;
  }

  return selected.length ? selected : [cleaned[0]];
}

function clampParagraphText(value, { maxSentences = 4, maxWords = 120, maxChars = 760 } = {}) {
  const normalized = normalizeSentenceSpacing(String(value || '').trim());
  if (!normalized) return '';

  const selected = selectSentencesWithinLimits(splitTeachingPointSentences(normalized), {
    maxSentences,
    maxWords,
    maxChars
  });
  return normalizeSentenceSpacing(selected.join(' '));
}

function pickVitalField(rawSet, aliases) {
  if (!rawSet || typeof rawSet !== 'object') return '';

  for (const key of aliases) {
    const value = rawSet[key];
    if (value != null && String(value).trim() !== '') {
      return value;
    }
  }

  return '';
}

function stripLeadingVitalLabel(value) {
  return normalizeSentenceSpacing(String(value || '').trim())
    .replace(/^(?:hr|rr)\s*:?\s*/i, '')
    .trim();
}

function composeCompositeVitalLine(rateValue, volumeValue, rhythmValue) {
  const rate = stripLeadingVitalLabel(rateValue);
  const volume = normalizeSentenceSpacing(String(volumeValue || '').trim());
  const rhythm = normalizeSentenceSpacing(String(rhythmValue || '').trim());

  if (!volume && !rhythm) {
    return rate;
  }

  const rateComponent = rate.includes(',') ? rate.split(',')[0].trim() : rate;
  return [rateComponent, volume, rhythm].filter(Boolean).join(', ');
}

function extractLeadingVitalNumber(value) {
  const match = stripLeadingVitalLabel(value).match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function normalizeVitalSet(rawSet) {
  const source = rawSet && typeof rawSet === 'object' ? rawSet : {};
  const hrRate = stringifyValue(pickVitalField(source, ['hr', 'heartRate', 'heart_rate', 'HR'])).trim();
  const hrRhythm = stringifyValue(
    pickVitalField(source, ['hrRhythm', 'heartRateRhythm', 'heart_rate_rhythm', 'HRRhythm', 'pulseRhythm'])
  ).trim();
  const hrVolume = stringifyValue(
    pickVitalField(source, ['hrVolume', 'heartRateVolume', 'heart_rate_volume', 'HRVolume', 'pulseVolume', 'pulseStrength'])
  ).trim();
  const rrRate = stringifyValue(pickVitalField(source, ['rr', 'respiratoryRate', 'respRate', 'resp_rate', 'RR'])).trim();
  const rrRhythm = stringifyValue(
    pickVitalField(source, ['rrRhythm', 'respiratoryRhythm', 'respRateRhythm', 'respiratory_rate_rhythm', 'RRRhythm'])
  ).trim();
  const rrVolume = stringifyValue(
    pickVitalField(source, ['rrVolume', 'respiratoryVolume', 'respRateVolume', 'respiratory_rate_volume', 'RRVolume'])
  ).trim();

  const normalized = {
    context: stringifyValue(pickVitalField(source, ['context'])).trim(),
    hr: composeCompositeVitalLine(hrRate, hrVolume, hrRhythm),
    rr: composeCompositeVitalLine(rrRate, rrVolume, rrRhythm),
    bp: stringifyValue(pickVitalField(source, ['bp', 'BP', 'bloodPressure', 'blood_pressure'])).trim(),
    spo2: stringifyValue(pickVitalField(source, ['spo2', 'SpO2', 'spO2', 'oxygenSaturation', 'oxygen_saturation'])).trim(),
    etco2: stringifyValue(pickVitalField(source, ['etco2', 'EtCO2', 'ETCO2'])).trim(),
    temp: stringifyValue(pickVitalField(source, ['temp', 'temperature'])).trim(),
    gcs: stringifyValue(pickVitalField(source, ['gcs', 'GCS'])).trim(),
    bgl: stringifyValue(pickVitalField(source, ['bgl', 'BGL', 'glucose', 'bloodGlucose', 'blood_glucose'])).trim(),
    ecgInterpretation: stringifyValue(
      pickVitalField(source, ['ecgInterpretation', 'ecg', 'ECG', 'rhythm', 'rhythmInterpretation'])
    ).trim()
  };

  normalized.ecgInterpretation = normalizeEcgInterpretation(normalized.ecgInterpretation);

  return normalized;
}

function normalizeVitalSigns(value, ecgInterpretation) {
  const source = value && typeof value === 'object' ? value : {};
  const firstRaw = source.firstSet || source.first || {};
  const secondRaw = source.secondSet || source.second || {};
  const additionalRaw = Array.isArray(source.additionalSets) ? source.additionalSets : [];

  const firstSet = normalizeVitalSet(firstRaw);
  const secondSet = normalizeVitalSet(secondRaw);
  const additionalSets = additionalRaw.map((set) => normalizeVitalSet(set));
  const normalizedRootEcg = normalizeEcgInterpretation(ecgInterpretation);

  if (
    normalizedRootEcg &&
    !firstSet.ecgInterpretation
  ) {
    firstSet.ecgInterpretation = normalizedRootEcg;
  }

  return { firstSet, secondSet, additionalSets };
}

function normalizeGrsAnchors(value) {
  const base = defaultGrsAnchors();
  // Always ensure all 7 domains are present
  const domains = Object.keys(base);
  const input = value && typeof value === 'object' ? value : {};
  for (const domain of domains) {
    if (!input[domain]) {
      // Leave as default (empty or fallback will fill)
      continue;
    }
    for (const score of [3, 5, 7]) {
      if (Array.isArray(input[domain][score])) {
        base[domain][score] = input[domain][score].map((item) => String(item).trim()).filter(Boolean);
      }
    }
  }

  // Fallback anchors for resourceUtilization and proceduralSkills
  const fallback = {
    resourceUtilization: {
      3: [
        'Misses available resources or delays calling for help.',
        'Inefficient use of team or equipment.',
        'Fails to anticipate resource needs.'
      ],
      5: [
        'Uses available resources appropriately and in a timely manner.',
        'Coordinates team and equipment for effective care.',
        'Requests additional help when needed.'
      ],
      7: [
        'Anticipates and mobilizes resources proactively.',
        'Optimizes team roles and equipment for seamless care.',
        'Demonstrates exceptional efficiency and foresight.'
      ]
    },
    proceduralSkills: {
      3: [
        'Performs procedures hesitantly or with frequent errors.',
        'Requires repeated prompting or correction.',
        'Inconsistent technique or safety awareness.'
      ],
      5: [
        'Performs procedures competently and safely.',
        'Follows correct technique with minimal prompting.',
        'Demonstrates appropriate procedural preparation.'
      ],
      7: [
        'Executes procedures with confidence and precision.',
        'Anticipates procedural needs and prepares flawlessly.',
        'Models best practices and teaches others.'
      ]
    }
  };

  for (const domain of ['resourceUtilization', 'proceduralSkills']) {
    for (const score of [3, 5, 7]) {
      if (!Array.isArray(base[domain][score]) || base[domain][score].length < 3) {
        base[domain][score] = fallback[domain][score];
      }
    }
  }

  return base;
}

// Remove or reword 'punish/punishing' from all scenario output fields
function removePunishLanguage(obj) {
  if (typeof obj === 'string') {
    return obj.replace(/\bpunish(ing|ment)?\b/gi, 'correct').replace(/\bpunishing\b/gi, 'challenging');
  }
  if (Array.isArray(obj)) {
    return obj.map(removePunishLanguage);
  }
  if (obj && typeof obj === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      out[k] = removePunishLanguage(v);
    }
    return out;
  }
  return obj;
}

function normalizeCaseProgression(value) {
  if (!value || typeof value !== 'object') {
    return {
      withProperTreatment: [],
      withoutProperTreatment: [],
      withIncorrectTreatment: []
    };
  }

  return {
    withProperTreatment: Array.isArray(value.withProperTreatment) ? value.withProperTreatment :
      (value.withProperTreatment || value.treated || value.improves || '').split('\n').filter(s => s.trim()) || [],
    withoutProperTreatment: Array.isArray(value.withoutProperTreatment) ? value.withoutProperTreatment :
      (value.withoutProperTreatment || value.untreated || value.deteriorates || '').split('\n').filter(s => s.trim()) || [],
    withIncorrectTreatment: Array.isArray(value.withIncorrectTreatment) ? value.withIncorrectTreatment :
      (value.withIncorrectTreatment || value.incorrectTreatment || value.worsensWithIncorrectCare || '').split('\n').filter(s => s.trim()) || []
  };
}

function normalizeScenarioData(rawData) {
  const merged = mergeDeepStrict(REQUIRED_FIELDS, rawData || {});
  const rawTransportPhase = rawData?.transportPhase && typeof rawData.transportPhase === 'object'
    ? rawData.transportPhase
    : {};

  const ecgInterpretation =
    merged.vitalSigns?.firstSet?.ecgInterpretation ||
    merged.ecgInterpretation ||
    '';

  merged.vitalSigns = normalizeVitalSigns(merged.vitalSigns, ecgInterpretation);
  merged.clinicalReasoning = normalizeClinicalReasoning(merged.clinicalReasoning);
  merged.grsAnchors = normalizeGrsAnchors(merged.grsAnchors);
  merged.caseProgression = normalizeCaseProgression(merged.caseProgression);

  merged.expectedTreatment = coerceArray(merged.expectedTreatment);
  merged.protocolNotes = coerceArray(merged.protocolNotes);
  merged.learningObjectives = coerceArray(merged.learningObjectives);
  merged.selfReflectionPrompts = coerceArray(merged.selfReflectionPrompts);
  merged.teachersPoints = normalizeTeachersPoints(merged.teachersPoints);
  merged.directiveSources = normalizeDirectiveSources(merged.directiveSources);

  merged.callInformation.dispatchNotes = coerceArray(merged.callInformation.dispatchNotes);
  merged.callInformation.hazardsOrFlags = coerceArray(merged.callInformation.hazardsOrFlags);

  merged.sceneArrival.environmentDetails = coerceArray(merged.sceneArrival.environmentDetails);
  merged.sceneArrival.hazards = coerceArray(merged.sceneArrival.hazards);

  merged.firstImpression.visibleClues = coerceArray(merged.firstImpression.visibleClues);
  merged.firstImpression.initialRedFlags = coerceArray(merged.firstImpression.initialRedFlags);

  merged.initialAssessment.immediatePriorities = coerceArray(merged.initialAssessment.immediatePriorities);
  merged.initialAssessment.immediateInterventions = coerceArray(merged.initialAssessment.immediateInterventions);

  merged.historyGathering.additionalHistory = coerceArray(merged.historyGathering.additionalHistory);
  merged.historyGathering.bystanderInformation = coerceArray(merged.historyGathering.bystanderInformation);
  merged.historyGathering.contradictionsOrBarriers = coerceArray(merged.historyGathering.contradictionsOrBarriers);
  merged.historyGathering.sceneContextClues = coerceArray(merged.historyGathering.sceneContextClues);

  merged.medications = coerceArray(merged.medications);
  merged.allergies = coerceArray(merged.allergies);
  merged.pastMedicalHistory = coerceArray(merged.pastMedicalHistory);
  merged.sample.medications = coerceArray(merged.sample.medications);

  merged.secondaryAssessment.keyFindings = coerceArray(merged.secondaryAssessment.keyFindings);
  merged.secondaryAssessment.missedIfNotAssessed = coerceArray(merged.secondaryAssessment.missedIfNotAssessed);
  merged.secondaryAssessment.evolvingFindings = coerceArray(merged.secondaryAssessment.evolvingFindings);

  merged.additionalAssessments = coerceArray(merged.additionalAssessments);

  // Suppress redundant assessment fields
  suppressRedundantAssessments(merged);

  merged.transportPhase.transportConsiderations = coerceArray([
    ...coerceArray(merged.transportPhase.transportConsiderations),
    ...coerceArray(rawTransportPhase.packaging),
    ...coerceArray(rawTransportPhase.transportDecision)
  ]);
  merged.transportPhase.ongoingCare = coerceArray(merged.transportPhase.ongoingCare);
  merged.transportPhase.reassessmentFocus = coerceArray(merged.transportPhase.reassessmentFocus);
  merged.transportPhase.handoffConsiderations = normalizeSentenceSpacing(
    stringifyValue(
      pickFirstDefined(
        merged.transportPhase.handoffConsiderations,
        rawTransportPhase.handoffConsiderations,
        ''
      )
    )
  );

  if (typeof merged.clinicalReasoning !== 'string') {
    const cr = merged.clinicalReasoning;
    if (cr && typeof cr === 'object') {
      merged.clinicalReasoning = [
        cr.summary, cr.conclusion,
        ...(Array.isArray(cr.ruleInFeatures) ? cr.ruleInFeatures : []),
        ...(Array.isArray(cr.ruleOutFeatures) ? cr.ruleOutFeatures : []),
        ...(Array.isArray(cr.redFlags) ? cr.redFlags : []),
        ...(Array.isArray(cr.treatmentPriorities) ? cr.treatmentPriorities : [])
      ].filter(Boolean).join(' ');
    } else {
      merged.clinicalReasoning = String(cr || '');
    }
  }

  merged.scenarioIntro = normalizeSentenceSpacing(merged.scenarioIntro || '');
  merged.patientPresentation = normalizeSentenceSpacing(merged.patientPresentation || '');
  merged.incidentNarrative = normalizeSentenceSpacing(merged.incidentNarrative || '');
  merged.scenarioRationale = normalizeSentenceSpacing(merged.scenarioRationale || '');
  merged.clinicalReasoning = normalizeSentenceSpacing(merged.clinicalReasoning || '');
  merged.transportPhase.handoffConsiderations = normalizeSentenceSpacing(
    merged.transportPhase.handoffConsiderations || ''
  );

  // Remove or reword 'punish/punishing' from all output fields
  return removePunishLanguage(merged);
}

function buildSemesterDifficultyProfile(semester) {
  switch (String(semester)) {
    case '2':
      return {
        learnerLevel: 'Semester 2 PCP learner',
        medicationAccess: 'none_by_design',
        presentationClarity: 'clear',
        ambiguity: 'low',
        competingProblems: 'low',
        communicationBurden: 'low',
        sceneComplexity: 'low',
        reassessmentBurden: 'basic',
        leadershipDemand: 'low',
        expectedReasoning: 'foundational assessment, communication, and safe basic management only',
        treatmentStyle: 'assessment_transport_focused',
        expectedScenarioShape: [
          'One main problem only',
          'Clear and recognizable presentation',
          'No symptom relief medications required by design',
          'Focus on primary survey, vitals, history, scene safety, oxygen decisions where appropriate, transport, and reassessment',
          'Minimal ambiguity and minimal competing issues',
          'No complex ECG dependence',
          'No advanced destination or leadership burden'
        ],
        instructionText: [
          'This scenario is for a Semester 2 PCP learner.',
          'No medications should be expected or required by design.',
          'Keep the case straightforward, recognizable, and fair.',
          'The educational value should come from scene approach, primary survey, focused assessment, history gathering, communication, oxygen decisions where appropriate, and safe transport planning.',
          'Do not make the case depend on advanced interpretation, subtle contraindication logic, complex leadership, or layered operational decision-making.',
          'The learner should succeed by being organized, safe, and thorough, not by knowing a sophisticated treatment pathway.'
        ]
      };

    case '3':
      return {
        learnerLevel: 'Semester 3 PCP learner',
        medicationAccess: 'clinically_appropriate_pcp_medications_available',
        presentationClarity: 'moderately clear',
        ambiguity: 'moderate',
        competingProblems: 'moderate',
        communicationBurden: 'moderate',
        sceneComplexity: 'moderate',
        reassessmentBurden: 'meaningful',
        leadershipDemand: 'moderate',
        expectedReasoning: 'directive interpretation, treatment selection, contraindication awareness, and reassessment with reasonable autonomy',
        treatmentStyle: 'treat_reassess_adapt',
        expectedScenarioShape: [
          'One main problem with one meaningful complication or decision point',
          'Medications may be appropriate when earned by the case',
          'Reassessment should matter',
          'Moderate ambiguity is acceptable',
          'Operational demands should be present but manageable',
          'The learner should show growing independence and sound treatment sequencing'
        ],
        instructionText: [
          'This scenario is for a Semester 3 PCP learner.',
          'Clinically appropriate PCP medications may be included when justified by the case.',
          'Use moderate complexity with clear teachable decisions, realistic reassessment, and meaningful but manageable scene demands.',
          'The learner should be expected to recognize common patterns, initiate appropriate treatment, notice straightforward contraindications, and adapt after reassessment.',
          'Allow some realistic messiness, but do not overload the case with too many competing issues.',
          'The learner should look increasingly independent, but not yet polished at a near-graduation level.'
        ]
      };

    case '4':
      return {
        learnerLevel: 'Semester 4 PCP learner',
        medicationAccess: 'full_pcp_scope_when_earned',
        presentationClarity: 'less tidy',
        ambiguity: 'moderate_to_high',
        competingProblems: 'high',
        communicationBurden: 'high',
        sceneComplexity: 'high',
        reassessmentBurden: 'significant',
        leadershipDemand: 'high',
        expectedReasoning: 'advanced prioritization, withholding logic, transport and destination thinking, leadership, and near-graduation call organization',
        treatmentStyle: 'lead_prioritize_withhold_when_needed',
        expectedScenarioShape: [
          'One main problem plus layered competing factors or operational pressure',
          'Medication decisions may include appropriate treatment and appropriate withholding',
          'Reassessment must meaningfully alter the call',
          'Transport urgency, destination thinking, or scene leadership should matter',
          'The case may be somewhat messy, ambiguous, or operationally demanding',
          'The learner should demonstrate organization, anticipation, and prioritization'
        ],
        instructionText: [
          'This scenario is for a Semester 4 PCP learner.',
          'All clinically appropriate PCP medication options may be included when justified by the case.',
          'Use fuller PCP scope, greater autonomy, stronger clinical judgment, and more realistic field messiness.',
          'Allow greater ambiguity, competing problems, operational pressure, and responsibility for prioritization, communication, and transport thinking.',
          'The learner should be expected to identify contraindications, withhold treatments appropriately when needed, and adapt meaningfully to changing reassessment findings.',
          'The scenario should reward leadership, organization, anticipation, and near-graduation clinical reasoning rather than simple pattern recognition.'
        ]
      };

    default:
      return {
        learnerLevel: `Semester ${semester} PCP learner`,
        medicationAccess: 'semester-appropriate',
        presentationClarity: 'moderate',
        ambiguity: 'moderate',
        competingProblems: 'moderate',
        communicationBurden: 'moderate',
        sceneComplexity: 'moderate',
        reassessmentBurden: 'moderate',
        leadershipDemand: 'moderate',
        expectedReasoning: 'semester-appropriate clinical reasoning',
        treatmentStyle: 'balanced',
        expectedScenarioShape: [
          'Semester-appropriate difficulty',
          'Reasonable progression',
          'Case should visibly reflect learner level'
        ],
        instructionText: [
          `Tailor the case and expectations to Semester ${semester} learner level in a concrete way.`
        ]
      };
  }
}

function buildMedicationPlan(subtype, semester) {
  if (String(semester) === '2') {
    return {
      style: 'supportive-care-only scenario by design',
      initialMedications: [],
      reassessmentMedications: [],
      transportPhaseMedications: [],
      medicationRestrictions: [
        'Do not include medication administration as an expected learner action.',
        'Do not include symptom relief medications.',
        'Do not make the scenario depend on medication decisions.',
        'If the real-world condition could receive medication, frame the Semester 2 version around recognition, supportive care, reassessment, and transport instead.'
      ],
      stagedTreatmentLogic: [
        'Initial phase: focus on scene safety, primary survey, ABC priorities, and early recognition of the main problem.',
        'Supportive care phase: use positioning, oxygen decisions where appropriate, ventilation support where appropriate, bleeding control where appropriate, patient protection, and ongoing monitoring.',
        'Reassessment phase: trend symptoms, LOC, work of breathing, circulation, pain, and vital signs, then decide on transport urgency.',
        'Transport phase: continue supportive care, communication, and monitoring without introducing medication-based management expectations.'
      ],
      supportiveCareOpportunities: [
        'scene safety',
        'primary survey',
        'airway positioning',
        'oxygen decisions where appropriate',
        'ventilation support where appropriate',
        'focused assessment',
        'history gathering',
        'reassessment',
        'transport decision-making',
        'communication with patient, family, and partner'
      ],
      semesterTwoRules: [
        'Semester 2 scenarios must remain non-medication by design.',
        'Expected treatment must stay supportive and assessment-focused.',
        'Teacher points should emphasize recognition, supportive care, reassessment, and transport.',
        'Learning objectives should not require drug administration.',
        'GRS anchors should not reward medication administration decisions.'
      ]
    };
  }

  const pathway = MEDICATION_PATHWAY_LIBRARY[subtype] || {
    style: 'supportive-care dominant pathway',
    initialMedications: [],
    reassessmentMedications: [],
    transportPhaseMedications: [],
    supportiveCare: ['assessment', 'reassessment', 'transport'],
    scenarioInstructions: ['Use only clinically justified medications.']
  };

  return {
    style: pathway.style || 'supportive-care dominant pathway',
    initialMedications: pathway.initialMedications || [],
    reassessmentMedications: pathway.reassessmentMedications || [],
    transportPhaseMedications: pathway.transportPhaseMedications || [],
    medicationRestrictions: pathway.withholdingLogic || [],
    semesterTwoRules: [],
    stagedTreatmentLogic: [
      (pathway.initialMedications || []).length
        ? `Initial phase: ${(pathway.initialMedications || []).join('; ')}`
        : 'Initial phase: no medication unless clearly indicated.',
      (pathway.reassessmentMedications || []).length
        ? `Reassessment phase: ${(pathway.reassessmentMedications || []).join('; ')}`
        : 'Reassessment phase: reassess and escalate only if warranted.',
      (pathway.transportPhaseMedications || []).length
        ? `Transport phase: ${(pathway.transportPhaseMedications || []).join('; ')}`
        : 'Transport phase: monitor and continue supportive care.'
    ],
    supportiveCareOpportunities: pathway.supportiveCare || []
  };
}

function pick(items) {
  if (!Array.isArray(items) || !items.length) return null;
  return items[Math.floor(Math.random() * items.length)];
}

function selectSubtype(callType) {
  const library = SCENARIO_SUBTYPE_LIBRARY[callType] || SCENARIO_SUBTYPE_LIBRARY.Medical;

  return (
    pick(library) || {
      subtype: 'diabetic_or_metabolic',
      likelyDiagnosis: 'undifferentiated medical presentation',
      chiefComplaints: ['General illness'],
      plausibleDifferentials: ['Medical complaint'],
      symptomPatterns: ['General medical presentation']
    }
  );
}

function buildTypeEnforcementRules(callType) {
  switch (String(callType)) {
    case 'Medical':
      return `
TYPE ENFORCEMENT RULES:
- This scenario MUST be primarily MEDICAL.
- The main problem must be caused by illness, toxicology, metabolic disturbance, infection, neurologic change, dehydration, or another non-traumatic medical process.
- Do NOT generate a trauma-first case, a cardiac-first case, or a respiratory-first case as the primary call family.
- If the case could be summarized as trauma, cardiac, or respiratory instead of medical, it is incorrect and must be rewritten.
`.trim();

    case 'Trauma':
      return `
TYPE ENFORCEMENT RULES:
- This scenario MUST be primarily TRAUMA.
- There must be a clear mechanism of injury.
- The incident narrative, physical exam, differential diagnosis, expected treatment, and case progression must all reflect trauma care.
- Acceptable trauma families include fall trauma, blunt trauma, isolated extremity injury, head injury, wilderness recreation injury, collision injury, or other mechanism-driven injury.
- Do NOT generate overdose, hypoglycemia, dehydration, sepsis, syncope without injury, nausea/vomiting, or other medical complaints as the primary problem.
- If the case could exist without a mechanism of injury, it is incorrect and must be rewritten.
`.trim();

    case 'Cardiac':
      return `
TYPE ENFORCEMENT RULES:
- This scenario MUST be primarily CARDIAC.
- The main problem must be a cardiac presentation such as ACS, ischemic chest pain, arrhythmia, cardiac syncope, CHF/pulmonary edema, cardiogenic shock, or another clearly cardiac process.
- The chief complaint, vitals, differential diagnosis, expected treatment, and progression must all support a cardiac case.
- ECG relevance should usually be meaningful in cardiac scenarios.
- Do NOT generate overdose, hypoglycemia, sepsis, generalized weakness, nausea/vomiting, or vague medical complaints as the primary problem unless they are clearly secondary to a cardiac issue.
- If the case could be summarized as a general medical call instead of a cardiac call, it is incorrect and must be rewritten.
`.trim();

    case 'Respiratory':
      return `
TYPE ENFORCEMENT RULES:
- This scenario MUST be primarily RESPIRATORY.
- The main problem must involve breathing difficulty, oxygenation, ventilation, airway compromise, asthma, COPD, pneumonia, pulmonary edema with respiratory-first presentation, or another clearly respiratory process.
- Work of breathing, respiratory exam findings, oxygen decisions, and respiratory treatment priorities must be central.
- Do NOT generate overdose, diabetic emergency, sepsis without respiratory focus, or trauma as the primary problem.
- If breathing is not one of the main management problems, the scenario is incorrect and must be rewritten.
`.trim();

    case 'Environmental':
      return `
TYPE ENFORCEMENT RULES:
- This scenario MUST be primarily ENVIRONMENTAL.
- The environment must directly affect the patient's physiology or scene management.
- Acceptable examples include heat illness, cold exposure, environmental toxin exposure, immersion, envenomation, or exposure-driven illness.
- Do NOT generate a normal medical or trauma call that simply happens outdoors.
- If the same scenario could occur unchanged in a living room, it is incorrect and must be rewritten.
`.trim();

    default:
      return `
TYPE ENFORCEMENT RULES:
- This scenario MUST clearly match the requested call type: ${callType}.
- If the scenario drifts away from that primary type, it is incorrect and must be rewritten.
`.trim();
  }
}

function buildTypeComplianceChecklist(callType) {
  switch (String(callType)) {
    case 'Medical':
      return `
TYPE COMPLIANCE CHECK BEFORE FINAL JSON:
- Is the chief complaint primarily medical?
- Is the scenario driven by illness rather than injury?
- Do the assessment findings, differentials, and treatment plan all support a medical case?
- If not, rewrite the scenario before returning JSON.
`.trim();

    case 'Trauma':
      return `
TYPE COMPLIANCE CHECK BEFORE FINAL JSON:
- Is there a clear mechanism of injury?
- Do the physical findings match the mechanism?
- Does expected treatment focus on trauma assessment, packaging, bleeding, splinting, SMR decisions, pain, extrication, or trauma transport priorities?
- If not, rewrite the scenario before returning JSON.
`.trim();

    case 'Cardiac':
      return `
TYPE COMPLIANCE CHECK BEFORE FINAL JSON:
- Is the chief complaint clearly cardiac?
- Do the vitals, clinical reasoning, and treatment priorities support a cardiac case?
- Would an instructor clearly describe this as cardiac rather than generic medical?
- If not, rewrite the scenario before returning JSON.
`.trim();

    case 'Respiratory':
      return `
TYPE COMPLIANCE CHECK BEFORE FINAL JSON:
- Is breathing or airway compromise central to the case?
- Do the findings, progression, and treatment plan clearly support a respiratory scenario?
- Would an instructor clearly describe this as respiratory?
- If not, rewrite the scenario before returning JSON.
`.trim();

    case 'Environmental':
      return `
TYPE COMPLIANCE CHECK BEFORE FINAL JSON:
- Does the environment directly shape both physiology and scene management?
- Would this case still make sense if moved indoors without changes?
- If yes, it is not environmental enough and must be rewritten.
`.trim();

    default:
      return `
TYPE COMPLIANCE CHECK BEFORE FINAL JSON:
- Confirm that the final scenario clearly matches the requested call type: ${callType}.
- If it does not, rewrite it before returning JSON.
`.trim();
  }
}

function buildEnvironmentProfile(environment) {
  const env = ENVIRONMENT_DETAIL_LIBRARY[environment] || {
    generalSettings: [environment || 'general setting'],
    sceneElements: ['standard scene factors'],
    accessChallenges: ['standard access considerations'],
    collateralSources: ['available witness']
  };

  return {
    selectedSetting: pick(env.generalSettings) || environment || 'general setting',
    sceneElements: env.sceneElements || [],
    accessChallenges: env.accessChallenges || [],
    collateralSources: env.collateralSources || [],
    environmentInstruction: [
      `Use a realistic ${environment || 'general'} environment.`,
      `Possible settings: ${(env.generalSettings || []).join(', ')}.`,
      `Scene elements: ${(env.sceneElements || []).join(', ')}.`,
      `Access challenges: ${(env.accessChallenges || []).join(', ')}.`,
      `Collateral sources may include: ${(env.collateralSources || []).join(', ')}.`
    ].join(' ')
  };
}

function buildShiftProfile(shiftMode, environment) {
  const normalizedShiftMode = normalizeShiftMode(shiftMode) || 'Day Shift';
  const nightEnvironmentNotes = {
    Urban: 'Use overnight building access, quieter roads, security staff, or sparse foot traffic when relevant.',
    Rural: 'Use dark driveways, limited exterior lighting, slower backup, or long approaches when relevant.',
    Wilderness: 'Use headlamps, poor natural light, colder pre-dawn conditions, or limited visual cues when relevant.',
    Industrial: 'Use reduced overnight staffing, lockouts, supervisors called in from elsewhere, or machine noise in low light.',
    Home: 'Use sleeping households, bedside lamps, dark hallways, or family members woken from sleep when relevant.',
    'Public Space': 'Use skeleton staffing, security, reduced public traffic, or partially closed facilities when relevant.'
  };
  const dayEnvironmentNotes = {
    Urban: 'Use daytime traffic, active buildings, and busier public flow when relevant.',
    Rural: 'Use daylight visibility, active property work, and easier scene orientation when relevant.',
    Wilderness: 'Use visible terrain and weather exposure without forcing darkness as the main barrier.',
    Industrial: 'Use active crews, louder workflows, and day operations when relevant.',
    Home: 'Use normal household activity, caregivers, or family routines when relevant.',
    'Public Space': 'Use normal staff presence, crowds, and public visibility when relevant.'
  };

  const environmentNote = normalizedShiftMode === 'Night Shift'
    ? nightEnvironmentNotes[environment]
    : dayEnvironmentNotes[environment];

  return {
    shiftMode: normalizedShiftMode,
    instructionText: [
      `Shift mode: ${normalizedShiftMode}`,
      `callInformation.shift must be exactly "${normalizedShiftMode}".`,
      normalizedShiftMode === 'Night Shift'
        ? '- callInformation.time must clearly read as an overnight time between about 2200 and 0600.'
        : '- callInformation.time should read as a daytime or early evening time between about 0600 and 2200.',
      normalizedShiftMode === 'Night Shift'
        ? '- The call should feel operationally overnight, not like a daytime call with the lights turned off.'
        : '- The call should feel like a daytime operational context, not like a generic time-neutral call.',
      normalizedShiftMode === 'Night Shift'
        ? '- Dispatch notes, scene arrival, access details, bystander behavior, and transport setup should reflect overnight rhythms when relevant.'
        : '- Dispatch notes, scene arrival, access details, and bystander behavior should reflect active daytime rhythms when relevant.',
      normalizedShiftMode === 'Night Shift'
        ? '- Night shift realism may include tired patients or collateral sources, locked access points, dim lighting, reduced staffing, quieter streets, or delayed on-site support.'
        : '- Day shift realism may include heavier traffic, more bystanders, more open facilities, busier worksites, or easier collateral access.',
      environmentNote ? `- ${environmentNote}` : '',
      '- Keep the complaint clinically grounded; shift mode should shape context, not replace physiology.'
    ].filter(Boolean).join('\n')
  };
}

function buildComplications(subtype) {
  const progression = buildCaseProgressionProfile(subtype);

  const baseComplications = [...(COMPLICATION_LIBRARY.moderate || [])];
  const progressionComplications = [...(progression.midComplications || [])];

  return [...baseComplications, ...progressionComplications];
}

const MID_CALL_EVENT_LIBRARY = {
  acs_chest_pain: [
    'Chest pain suddenly intensifies again after a short period of partial relief.',
    'The patient becomes more nauseated and pale during packaging.',
    'A late collateral detail reveals recent PDE5 inhibitor use, forcing treatment reconsideration.',
    'The patient becomes dizzy when moved to the stretcher, requiring repeat blood pressure assessment.'
  ],
  arrhythmia_or_palpitations: [
    'Symptoms worsen when the patient stands or shifts position.',
    'A more concerning rhythm clue appears on repeat ECG or monitoring.',
    'A witness reveals stimulant use or a prior arrhythmia history late in the call.',
    'The patient has a near-syncope episode during reassessment.'
  ],
  cardiac_syncope: [
    'The patient becomes presyncopal again during movement to the stretcher.',
    'Witness history changes the risk picture by revealing palpitations or chest discomfort before the collapse.',
    'Repeat vitals during packaging show worsening perfusion or blood pressure drift.',
    'The patient becomes more pale and dizzy when moved upright.'
  ],
  chf_or_pulmonary_edema: [
    'The patient becomes too breathless to answer in full sentences.',
    'Blood pressure changes create a new medication decision point.',
    'Chest discomfort becomes more prominent during reassessment.',
    'The patient begins tiring and looks less able to compensate.'
  ],
  asthma: [
    'The patient becomes more breathless and less able to answer questions.',
    'A bystander reveals the patient already used their inhaler several times before EMS arrival.',
    'Auscultation changes after treatment create a repeat-medication decision point.',
    'The patient begins to look tired rather than simply anxious.'
  ],
  copd_exacerbation: [
    'The patient becomes more tired during movement to the ambulance.',
    'Baseline home oxygen use changes how the crew interprets oxygen targets.',
    'Sputum or fever history increases uncertainty between COPD and infection.',
    'Reassessment reveals that symptoms are not improving as much as expected.'
  ],
  pneumonia_or_infective: [
    'The patient becomes more short of breath with movement.',
    'Temperature, perfusion, or mental status worsen on reassessment.',
    'Collateral history reveals a longer illness course than first reported.',
    'Nausea or vomiting becomes more prominent during transport preparation.'
  ],
  allergic_respiratory_process: [
    'Voice changes or throat tightness worsen on reassessment.',
    'The rash becomes more generalized during the call.',
    'The patient becomes more frightened and harder to focus.',
    'Bystanders reveal the exposure was more significant than first believed.'
  ],
  diabetic_or_metabolic: [
    'The patient vomits or becomes nauseated during recovery.',
    'The patient improves mentally but remains weak and not fully back to baseline.',
    'Collateral reveals missed meals, insulin use, or exertion history late in the call.',
    'A second reassessment forces the crew to decide whether improvement is enough to change next steps.'
  ],
  infectious_or_sepsis: [
    'Mental status worsens subtly but meaningfully during reassessment.',
    'Blood pressure or perfusion looks worse on the second or third set of vitals.',
    'A collateral source reveals the illness has been longer or more severe than first reported.',
    'Nausea or vomiting emerges during the call.'
  ],
  nausea_vomiting_or_dehydration: [
    'The patient vomits again during packaging.',
    'Weakness or orthostatic symptoms worsen when the patient is moved upright.',
    'Abdominal pain becomes more prominent on reassessment.',
    'Collateral reveals a more concerning medication, illness, or intake history.'
  ],
  neurologic_or_syncope: [
    'The patient becomes dizzy or presyncopal again during movement.',
    'Witness information changes the differential significantly.',
    'Repeat vitals reveal a more concerning trend than expected.',
    'A glucose or ECG result becomes more relevant than first expected.'
  ],
  geriatric_multi_problem: [
    'Family provides a late medication or baseline cognition detail.',
    'The patient deteriorates subtly rather than dramatically.',
    'Movement worsens weakness or dyspnea.',
    'A vague complaint becomes more clearly serious on the second assessment.'
  ],
  toxicology_or_overdose: [
    'The patient becomes combative or confused after partial improvement.',
    'Respiratory effort improves only partially, forcing a second treatment decision.',
    'Vomiting or aspiration risk becomes more prominent after treatment.',
    'Scene evidence changes how convincing the opioid picture looks.'
  ],
  fall_trauma: [
    'Pain spikes during movement from the scene.',
    'A late detail suggests the fall may have had a medical trigger.',
    'Distal circulation or neurovascular findings change after repositioning.',
    'Nausea develops after pain worsens or after a head-strike detail emerges.'
  ],
  blunt_trauma: [
    'The patient becomes more pale and uncomfortable during packaging.',
    'A hidden injury clue appears on secondary assessment.',
    'Chest or abdominal pain becomes more significant over time.',
    'The mechanism proves more serious than first believed.'
  ],
  isolated_extremity_injury: [
    'Pain worsens sharply when the limb is moved.',
    'Distal circulation, sensation, or movement changes after repositioning.',
    'A deformity becomes more obvious once clothing is removed.',
    'The patient becomes more anxious or resistant because of pain.'
  ],
  head_injury: [
    'Vomiting begins or worsens during the call.',
    'The patient becomes more confused or slower to respond.',
    'A witness provides a more concerning LOC or mechanism detail.',
    'Movement worsens headache, dizziness, or nausea.'
  ],
  heat_illness: [
    'The patient becomes more confused during movement.',
    'Vomiting or dizziness worsens during packaging.',
    'A collapse or near-collapse occurs when the patient tries to stand.',
    'Collateral reveals longer exposure or exertion than first described.'
  ],
  cold_exposure: [
    'The patient becomes more confused when moved.',
    'Collateral reveals alcohol use, prolonged exposure, or inadequate clothing.',
    'A second complaint such as injury or hypoglycemia becomes relevant.',
    'Shivering stops and the presentation becomes more concerning.'
  ],
  exposure_or_toxin: [
    'A second person at the scene becomes symptomatic.',
    'Respiratory irritation worsens after a short delay.',
    'Scene information reveals a more specific exposure source.',
    'The patient becomes more anxious or more unsteady during removal.'
  ]
};

function buildComplexityProfile(complexity) {
  switch (String(complexity)) {
    case 'Simple':
      return {
        label: 'Simple',
        clinicalAmbiguity: 'low',
        sceneBurden: 'low',
        communicationBurden: 'low',
        reassessmentBurden: 'low to moderate',
        competingPriorities: 'low',
        timePressure: 'low',
        extricationOrAccessBurden: 'low',
        patientCooperation: 'generally cooperative and straightforward',
        expectedVitalSetCount: 2,
        midCallEventLikelihood: 'low',
        additionalAssessmentLikelihood: 'low',
        contradictoryHistoryLikelihood: 'low',
        recommendedEventTiming: 'usually none unless the case clearly earns it',
        shapingNotes: [
          'Keep one dominant problem clearly identifiable.',
          'Avoid major scene chaos or layered operational problems.',
          'Use limited ambiguity and minimal competing priorities.',
          'Reassessment can confirm the impression but should not radically change the whole call.',
          'Keep the case fair, clear, and grounded in doing the basics well.'
        ]
      };

    case 'Moderate':
      return {
        label: 'Moderate',
        clinicalAmbiguity: 'moderate',
        sceneBurden: 'moderate',
        communicationBurden: 'moderate',
        reassessmentBurden: 'moderate to high',
        competingPriorities: 'moderate',
        timePressure: 'moderate',
        extricationOrAccessBurden: 'moderate',
        patientCooperation: 'variable but manageable',
        expectedVitalSetCount: 3,
        midCallEventLikelihood: 'medium',
        additionalAssessmentLikelihood: 'medium',
        contradictoryHistoryLikelihood: 'medium',
        recommendedEventTiming: 'after initial assessment, during movement, or after treatment',
        shapingNotes: [
          'Use one dominant problem plus one meaningful complicating factor.',
          'Include one realistic communication, scene, or access challenge.',
          'Allow one misleading feature or mild trap that could briefly pull attention the wrong way.',
          'Reassessment should meaningfully affect concern level, management, or transport urgency.',
          'The case should feel realistic and slightly messy without becoming overloaded.'
        ]
      };

    case 'Complex':
    default:
      return {
        label: 'Complex',
        clinicalAmbiguity: 'high',
        sceneBurden: 'high',
        communicationBurden: 'high',
        reassessmentBurden: 'high',
        competingPriorities: 'high',
        timePressure: 'high',
        extricationOrAccessBurden: 'high',
        patientCooperation: 'variable, difficult, or changing',
        expectedVitalSetCount: 4,
        midCallEventLikelihood: 'high',
        additionalAssessmentLikelihood: 'high',
        contradictoryHistoryLikelihood: 'high',
        recommendedEventTiming: 'during movement, after initial treatment, or during packaging/transport preparation',
        shapingNotes: [
          'Use one dominant problem plus at least two layered complicating factors.',
          'Include meaningful scene, communication, family, bystander, or access burden.',
          'Include ambiguity, false reassurance, or a competing feature that could lead to a believable wrong priority choice.',
          'Reassessment must significantly affect management, risk framing, or transport decisions.',
          'Create real operational strain such as movement difficulty, limited access, patient reluctance, changing cooperation, or delayed packaging.',
          'The learner should have to prioritize between competing demands rather than simply follow a clean sequence.'
        ]
      };
  }
}

function buildVitalTrendProfile(subtype, complexity, semester) {
  const complexityProfile = buildComplexityProfile(complexity);
  const semesterNumber = Number(semester);

  const movementSensitiveSubtypes = new Set([
    'cardiac_syncope',
    'neurologic_or_syncope',
    'isolated_extremity_injury',
    'fall_trauma',
    'heat_illness',
    'cold_exposure'
  ]);

  const treatmentResponsiveSubtypes = new Set([
    'asthma',
    'copd_exacerbation',
    'diabetic_or_metabolic',
    'allergic_respiratory_process',
    'acs_chest_pain',
    'chf_or_pulmonary_edema',
    'toxicology_or_overdose'
  ]);

  const deteriorationProneSubtypes = new Set([
    'infectious_or_sepsis',
    'pneumonia_or_infective',
    'head_injury',
    'exposure_or_toxin',
    'blunt_trauma'
  ]);

  let expectedPattern = 'mixed_response';

  if (movementSensitiveSubtypes.has(subtype)) {
    expectedPattern = 'movement_sensitive';
  } else if (treatmentResponsiveSubtypes.has(subtype)) {
    expectedPattern = 'improves_with_treatment';
  } else if (deteriorationProneSubtypes.has(subtype)) {
    expectedPattern = 'worsens_with_delay';
  }

  let recommendedSets = complexityProfile.expectedVitalSetCount;

  if (semesterNumber === 2) {
    recommendedSets = Math.min(recommendedSets, 2);
  }

  if (
    ['infectious_or_sepsis', 'copd_exacerbation', 'asthma', 'cardiac_syncope', 'head_injury'].includes(subtype) &&
    complexityProfile.label !== 'Simple'
  ) {
    recommendedSets = Math.max(recommendedSets, 3);
  }

  const specificTrendNotesBySubtype = {
    acs_chest_pain: [
      'Blood pressure and pain should be trended carefully after nitroglycerin decisions.',
      'Symptoms may partially improve while risk remains high.',
      'Movement or delayed care may worsen pallor, nausea, or dizziness.'
    ],
    cardiac_syncope: [
      'Movement, standing, or packaging may worsen dizziness or perfusion.',
      'Repeat vitals should help show why temporary improvement is not reassuring.',
      'Heart rate or blood pressure should not feel randomly normal if the risk remains high.'
    ],
    copd_exacerbation: [
      'Oxygen titration and bronchodilator therapy should produce believable, not magical, improvement.',
      'Movement to the ambulance may worsen dyspnea or reveal fatigue.',
      'SpO2, RR, work of breathing, and ETCO2 should tell a coherent respiratory story.'
    ],
    asthma: [
      'Bronchodilator response should affect air movement, RR, and speaking ability.',
      'If the patient worsens, the trend should show fatigue and increasing respiratory concern.',
      'Do not make all changes purely about SpO2.'
    ],
    infectious_or_sepsis: [
      'Temperature, perfusion, blood pressure, heart rate, and mental status should trend like systemic illness.',
      'Delayed care or delayed transport should make later vitals meaningfully worse.',
      'Improvement, if any, should be modest and should not erase the urgency.'
    ],
    isolated_extremity_injury: [
      'Pain, anxiety, and movement may affect heart rate and cooperation.',
      'Vitals do not need dramatic change unless pain, bleeding, or movement justifies it.',
      'Additional vitals are most useful if neurovascular findings or movement meaningfully change the call.'
    ],
    head_injury: [
      'Serial neuro status is more important than generic small vital sign drift.',
      'If the patient worsens, GCS, vomiting, or behaviour should change in a meaningful way.',
      'Transport-phase reassessment may reveal delayed deterioration.'
    ]
  };

  return {
    minimumSets: 2,
    recommendedSets,
    expectedPattern,
    triggersForAdditionalSet: [
      'after treatment',
      'after movement or packaging',
      'after a mid-call event',
      'during transport preparation or transport'
    ],
    specificTrendNotes:
      specificTrendNotesBySubtype[subtype] || [
        'Vitals should reflect the physiology of the case, not a generic slight improvement pattern.',
        'If treatment is appropriate, improvement should be partial and believable.',
        'If treatment is delayed, absent, or incorrect, later vitals should show that consequence.'
      ]
  };
}

function buildAssessmentCadenceProfile(subtype, complexity) {
  const complexityProfile = buildComplexityProfile(complexity);

  const reassessmentHeavySubtypes = new Set([
    'asthma',
    'copd_exacerbation',
    'infectious_or_sepsis',
    'cardiac_syncope',
    'head_injury',
    'toxicology_or_overdose',
    'diabetic_or_metabolic'
  ]);

  const additionalAssessmentLikely =
    complexityProfile.additionalAssessmentLikelihood !== 'low' ||
    reassessmentHeavySubtypes.has(subtype);

  return {
    minimumAssessments: 2,
    additionalAssessmentLikely,
    assessmentTriggers: [
      'after treatment',
      'after movement',
      'after new collateral information',
      'after deterioration or recurrent symptoms',
      'during packaging or transport preparation'
    ],
    notes: [
      'initialAssessment and secondaryAssessment must not simply duplicate each other.',
      'secondaryAssessment should deepen, confirm, or challenge the initial impression.',
      'Use additionalAssessments only when reassessment materially changes the call.'
    ]
  };
}

function buildMidCallEventProfile(subtype, complexity, environmentProfile) {
  const complexityProfile = buildComplexityProfile(complexity);
  const subtypeEvents = MID_CALL_EVENT_LIBRARY[subtype] || [
    'A meaningful reassessment change occurs during the call.',
    'Collateral information changes how the crew interprets the problem.',
    'Movement or packaging worsens symptoms enough to require adaptation.'
  ];

  const shouldIncludeEvent =
    complexityProfile.midCallEventLikelihood === 'high' ||
    complexityProfile.midCallEventLikelihood === 'medium';

  const sceneInteractionOptions = [
    'bystander or family input changes the history',
    'public attention or family pressure affects communication'
  ];

  if (Array.isArray(environmentProfile?.accessChallenges) && environmentProfile.accessChallenges.length) {
    sceneInteractionOptions.push(
      `environmental access issue becomes relevant: ${pick(environmentProfile.accessChallenges) || ''}`.trim()
    );
  }

  if (Array.isArray(environmentProfile?.sceneElements) && environmentProfile.sceneElements.length) {
    sceneInteractionOptions.push(
      `scene factor adds pressure: ${pick(environmentProfile.sceneElements) || ''}`.trim()
    );
  }

  return {
    shouldIncludeEvent,
    eventTiming: complexityProfile.recommendedEventTiming,
    likelyEvent: pick(subtypeEvents) || subtypeEvents[0],
    eventEffects: [
      'requires reassessment',
      'may trigger an additional vital set',
      'may alter transport urgency or treatment priorities'
    ],
    sceneInteraction: pick(sceneInteractionOptions) || ''
  };
}

function buildScenarioCore({
  subtypeData,
  environmentProfile,
  complexity,
  medicationPlan,
  semesterProfile
}) {
  const progression = buildCaseProgressionProfile(subtypeData.subtype);
  const complexityProfile = buildComplexityProfile(complexity);
  const vitalTrendProfile = buildVitalTrendProfile(subtypeData.subtype, complexity, semesterProfile?.learnerLevel?.match(/\d+/)?.[0] || '3');
  const assessmentCadenceProfile = buildAssessmentCadenceProfile(subtypeData.subtype, complexity);
  const midCallEventProfile = buildMidCallEventProfile(
    subtypeData.subtype,
    complexity,
    environmentProfile
  );

  const semesterShapingText =
    semesterProfile?.learnerLevel === 'Semester 2 PCP learner'
      ? [
          'Semester shaping:',
          '- Keep the scenario cleaner and more direct.',
          '- Emphasize assessment, organization, transport, and foundational scene management.',
          '- Do not rely on medication use or complex branching to make the case educational.',
          '- Improvement and deterioration should be simple, believable, and easy to follow.',
          '- Challenges should come from recognition, prioritization, and reassessment rather than advanced treatment decisions.',
          '- Avoid making the case feel like independent-practice level complexity.'
        ].join('\n')
      : semesterProfile?.learnerLevel === 'Semester 3 PCP learner'
        ? [
            'Semester shaping:',
            '- Include a meaningful treatment decision and a meaningful reassessment point.',
            '- Let the patient response change the crew’s next steps.',
            '- Keep the case challenging but fair and teachable.',
            '- Allow some realistic messiness without overloading the learner.',
            '- Build a case that rewards organized reasoning rather than just pattern recognition.'
          ].join('\n')
        : [
            'Semester shaping:',
            '- Make the case more operationally and clinically layered.',
            '- Reassessment should meaningfully alter priorities, transport urgency, or treatment choices.',
            '- Appropriate withholding of treatment may be as important as appropriate treatment.',
            '- Let the learner demonstrate anticipation, prioritization, and scene leadership.',
            '- The case should feel closer to real practice than to a tidy student exercise.'
          ].join('\n');

  const complexityShapingText = [
    'Complexity profile:',
    `- Overall level: ${complexityProfile.label}`,
    `- Clinical ambiguity: ${complexityProfile.clinicalAmbiguity}`,
    `- Scene burden: ${complexityProfile.sceneBurden}`,
    `- Communication burden: ${complexityProfile.communicationBurden}`,
    `- Reassessment burden: ${complexityProfile.reassessmentBurden}`,
    `- Competing priorities: ${complexityProfile.competingPriorities}`,
    `- Time pressure: ${complexityProfile.timePressure}`,
    `- Extrication or access burden: ${complexityProfile.extricationOrAccessBurden}`,
    `- Patient cooperation: ${complexityProfile.patientCooperation}`,
    `- Expected vital set count: ${complexityProfile.expectedVitalSetCount}`,
    `- Mid-call event likelihood: ${complexityProfile.midCallEventLikelihood}`,
    `- Additional assessment likelihood: ${complexityProfile.additionalAssessmentLikelihood}`,
    `- Contradictory history likelihood: ${complexityProfile.contradictoryHistoryLikelihood}`,
    ...complexityProfile.shapingNotes.map((note) => `- ${note}`)
  ].join('\n');

  return {
    progressionInstructions: [
      complexityShapingText,
      '',
      'Case progression rules:',
      '- Progression must feel physiologic, not just narrative.',
      '- With proper treatment, improvement should be specific and believable.',
      '- Without proper treatment, deterioration or stagnation should be specific and believable.',
      '- Incorrect treatment should create a meaningful consequence when clinically appropriate.',
      '- Reassessment findings should change what the learner should notice, think, or do next.',
      '- Movement, packaging, or transport preparation may change the patient or the call dynamics.',
      '',
      'If treated appropriately:',
      ...progression.treated,
      '',
      'If untreated or delayed:',
      ...progression.untreated,
      '',
      'If incorrect treatment is provided:',
      ...progression.incorrect,
      '',
      'Possible mid-scenario complications:',
      ...progression.midComplications
    ].join('\n'),

    vitalTrendInstructions: [
      'Vital trend profile:',
      `- Minimum vital sets: ${vitalTrendProfile.minimumSets}`,
      `- Recommended vital sets for this case: ${vitalTrendProfile.recommendedSets}`,
      `- Expected trend pattern: ${vitalTrendProfile.expectedPattern}`,
      '- Always include firstSet and secondSet.',
      '- Use additionalSets when treatment, movement, packaging, a mid-call event, or transport meaningfully changes the patient.',
      '- Avoid the generic pattern of "bad first set, slightly better second set, then stop."',
      '- Vitals should tell a story connected to physiology, treatment response, and scene progression.',
      'Specific trend notes:',
      ...vitalTrendProfile.specificTrendNotes.map((note) => `- ${note}`),
      'Triggers for additional vital sets:',
      ...vitalTrendProfile.triggersForAdditionalSet.map((trigger) => `- ${trigger}`)
    ].join('\n'),

    assessmentCadenceInstructions: [
      'Assessment cadence profile:',
      `- Minimum assessment phases: ${assessmentCadenceProfile.minimumAssessments}`,
      `- Additional assessment likely: ${assessmentCadenceProfile.additionalAssessmentLikely ? 'yes' : 'no'}`,
      '- initialAssessment should capture the first organized ABC/priority picture.',
      '- secondaryAssessment should deepen, refine, or challenge the initial picture.',
      '- additionalAssessments should be used only when the call meaningfully evolves.',
      'Assessment triggers:',
      ...assessmentCadenceProfile.assessmentTriggers.map((trigger) => `- ${trigger}`),
      'Assessment notes:',
      ...assessmentCadenceProfile.notes.map((note) => `- ${note}`)
    ].join('\n'),

    midCallEventInstructions: [
      'Mid-call event profile:',
      `- Include event: ${midCallEventProfile.shouldIncludeEvent ? 'yes, strongly encouraged' : 'only if the case clearly earns it'}`,
      `- Suggested timing: ${midCallEventProfile.eventTiming}`,
      `- Likely event: ${midCallEventProfile.likelyEvent}`,
      ...(midCallEventProfile.sceneInteraction
        ? [`- Scene interaction: ${midCallEventProfile.sceneInteraction}`]
        : []),
      'Event effects:',
      ...midCallEventProfile.eventEffects.map((effect) => `- ${effect}`),
      '- If a mid-call event is used, it should affect reassessment, transport thinking, treatment decisions, or scene management in a visible way.'
    ].join('\n')
  };
}

function collectScenarioNarrativeText(scenario, { forComplexity = false } = {}) {
  const segments = forComplexity
    ? [
        scenario?.scenarioIntro,
        scenario?.title,
        scenario?.patientPresentation,
        scenario?.incidentNarrative,
        scenario?.clinicalReasoning,
        ...(scenario?.transportPhase?.transportConsiderations || []),
        ...(scenario?.transportPhase?.ongoingCare || []),
        ...(scenario?.historyGathering?.contradictionsOrBarriers || []),
        ...(scenario?.sceneArrival?.hazards || [])
      ]
    : [
        scenario?.scenarioIntro,
        scenario?.title,
        scenario?.patientPresentation,
        scenario?.incidentNarrative,
        scenario?.clinicalReasoning,
        ...(scenario?.expectedTreatment || []),
        ...(scenario?.protocolNotes || []),
      scenario?.teachersPoints,
        ...(scenario?.learningObjectives || []),
        ...(scenario?.transportPhase?.transportConsiderations || []),
        ...(scenario?.transportPhase?.ongoingCare || []),
        ...(scenario?.historyGathering?.contradictionsOrBarriers || []),
        ...(scenario?.sceneArrival?.hazards || [])
      ];

  return segments
    .filter(Boolean)
    .map((segment) => stripTeachingCueMarkup(segment))
    .join(' ')
    .toLowerCase();
}

function collectTeachingCueMetrics(scenario) {
  const sectionsWithCues = new Set();
  const cueFingerprints = new Map();
  const cueTags = new Set();
  let cueCount = 0;
  let genericCueCount = 0;
  let weakVoiceCueCount = 0;

  function walk(value, pathParts = []) {
    if (typeof value === 'string') {
      const matches = getTeachingCueMatches(value);
      if (matches.length) {
        cueCount += matches.length;
        if (pathParts.length) {
          sectionsWithCues.add(pathParts[0]);
        }

        for (const cue of matches) {
          const fingerprint = fingerprintCueText(cue.text);
          if (fingerprint) {
            cueFingerprints.set(fingerprint, (cueFingerprints.get(fingerprint) || 0) + 1);
          }
          if (cue.tag) cueTags.add(cue.tag);
          genericCueCount += countGenericCueSignals(cue.text);
          if (!cueUsesInstructorVoice(cue.text)) {
            weakVoiceCueCount += 1;
          }
        }
      }
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((item) => walk(item, pathParts));
      return;
    }

    if (value && typeof value === 'object') {
      Object.entries(value).forEach(([key, child]) => {
        walk(child, pathParts.length ? pathParts : [key]);
      });
    }
  }

  walk(scenario, []);

  const duplicateCueCount = [...cueFingerprints.values()]
    .filter((count) => count > 1)
    .reduce((acc, count) => acc + (count - 1), 0);

  return {
    cueCount,
    sectionsWithCues: [...sectionsWithCues],
    duplicateCueCount,
    uniqueCueCount: cueFingerprints.size,
    genericCueCount,
    weakVoiceCueCount,
    cueTags: [...cueTags]
  };
}

function createCue(text, tag = '') {
  const normalizedText = compactTeachingCueText(text);
  const normalizedTag = normalizeTeachingCueTag(tag);
  return normalizedTag
    ? `*(💡${normalizedTag}| ${normalizedText})*`
    : `*(💡 ${normalizedText})*`;
}

function appendCueToString(value, cueText, cueTag = '') {
  const current = String(value || '').trim();
  const cue = createCue(cueText, cueTag);
  const existingCues = getTeachingCueMatches(current);
  const incomingFingerprint = fingerprintCueText(cueText);
  if (existingCues.some((existing) => fingerprintCueText(existing.text) === incomingFingerprint)) {
    return current;
  }
  return current ? `${current} ${cue}` : cue;
}

function computeCueSeedOffset(scenario, variationSeed = 0) {
  const seed = [
    scenario?.title,
    scenario?.patientDemographics?.chiefComplaint,
    scenario?.callInformation?.type,
    scenario?.callInformation?.location,
    String(variationSeed || '')
  ]
    .filter(Boolean)
    .join('|');

  if (!seed) return 0;
  return [...seed].reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

function cleanCueAnchor(value, maxLen = 140) {
  const cleaned = normalizeSentenceSpacing(stripTeachingCueMarkup(String(value || '')))
    .replace(/^[-•\d.)\s]+/, '')
    .trim();
  if (!cleaned) return '';
  return trimToWordBoundary(cleaned, maxLen);
}

const GENERIC_CUE_ANCHORS = new Set([
  'the active presentation',
  'the current working diagnosis',
  'this response environment',
  'the first vital trend',
  'the reported mechanism and timeline',
  'scene and history barriers',
  'the next reassessment trigger',
  'the first high-yield treatment step',
  'worsening perfusion and fatigue signs',
  'handoff-ready reassessment priorities',
  'the handoff-critical clinical trajectory',
  'the relevant ontario directive principle',
  'the key presentation details',
  'the first scene impression',
  'the earliest red-flag clue',
  'the reassessment vital context'
]);

function isConcreteCueAnchor(value) {
  const normalized = normalizeSentenceSpacing(String(value || '')).toLowerCase();
  if (!normalized) return false;
  if (GENERIC_CUE_ANCHORS.has(normalized)) return false;
  return normalized.length >= 18;
}

function seededShuffle(items, seed) {
  const arr = [...items];
  let state = (Math.abs(Number(seed) || 0) + 1) % 2147483647;
  const next = () => {
    state = (state * 48271) % 2147483647;
    return state / 2147483647;
  };

  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(next() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function findMedicationDoseAnchor(scenario) {
  const sources = [
    ...(scenario?.expectedTreatment || []),
    ...(scenario?.protocolNotes || []),
    ...(scenario?.initialAssessment?.immediateInterventions || []),
    ...(scenario?.medications || []),
    ...(scenario?.sample?.medications || [])
  ];

  const dosePattern = /\b\d+(?:\.\d+)?\s?(?:mg|mcg|g|ml|mL|units?|iu)\b/i;
  const routePattern = /\b(?:iv|im|po|sl|neb|io|in)\b/i;

  const ranked = sources
    .map((item) => cleanCueAnchor(item, 170))
    .filter(Boolean)
    .filter((text) => {
      const lower = text.toLowerCase();
      const hasMed = MEDICATION_KEYWORDS.some((keyword) => lower.includes(keyword));
      return hasMed && dosePattern.test(text);
    })
    .sort((left, right) => {
      const leftScore = (routePattern.test(left) ? 1 : 0) + (left.toLowerCase().includes('als pcs') ? 1 : 0);
      const rightScore = (routePattern.test(right) ? 1 : 0) + (right.toLowerCase().includes('als pcs') ? 1 : 0);
      return rightScore - leftScore;
    });

  return ranked[0] || '';
}

function findProtocolActionAnchor(scenario) {
  const lines = [
    ...(scenario?.protocolNotes || []),
    ...(scenario?.expectedTreatment || [])
  ]
    .map((line) => cleanCueAnchor(line, 190))
    .filter(Boolean);

  const bareDirectiveOnlyPattern = /^(?:follow\s+)?(?:the\s+)?(?:relevant\s+)?(?:ontario\s+)?(?:bls|als|pcs|companion|directive|standards?)\b/i;
  const actionVerbPattern = /\b(titrate|administer|assist|perform|obtain|repeat|reassess|trend|withhold|avoid|consider|prepare|monitor|verify|confirm|route|dose|transport)\b/i;
  const concretePattern = /\b\d+(?:\.\d+)?\s?(?:mg|mcg|g|ml|mL|units?|iu|%)\b|\b12-lead\b|\bright-sided\b|\bcontraindication\b|\bspo2\b|\betco2\b/i;

  const ranked = lines
    .filter((line) => !bareDirectiveOnlyPattern.test(line))
    .map((line) => {
      const lower = line.toLowerCase();
      let score = 0;
      if (actionVerbPattern.test(line)) score += 3;
      if (concretePattern.test(line)) score += 4;
      if (lower.includes('als pcs') || lower.includes('bls pcs')) score += 1;
      return { line, score };
    })
    .sort((left, right) => right.score - left.score);

  return ranked[0]?.line || '';
}

function findTeachingPitfallAnchor(scenario) {
  const candidates = [
    ...(scenario?.secondaryAssessment?.missedIfNotAssessed || []),
    ...(scenario?.caseProgression?.withIncorrectTreatment || []),
    ...(scenario?.protocolNotes || []),
    ...(scenario?.historyGathering?.contradictionsOrBarriers || [])
  ]
    .map((line) => cleanCueAnchor(line, 170))
    .filter(Boolean);

  const pitfallPattern = /\b(miss|delay|incorrect|wrong|avoid|withhold|contraindication|fail|worsen|deteriorat|not\s+reassess|not\s+assess)\b/i;
  const ranked = candidates
    .map((line) => ({ line, score: pitfallPattern.test(line) ? 4 : 1 }))
    .sort((left, right) => right.score - left.score);

  return ranked[0]?.line || '';
}

function findPresentationAnchor(scenario) {
  return pickCueAnchor(
    scenario?.patientPresentation,
    scenario?.firstImpression?.generalAppearance,
    scenario?.firstImpression?.visibleClues?.[0],
    scenario?.incidentNarrative,
    'the key presentation details'
  );
}

function findSceneAnchor(scenario) {
  return pickCueAnchor(
    scenario?.sceneArrival?.sceneDescription,
    scenario?.sceneArrival?.environmentDetails?.[0],
    scenario?.sceneArrival?.hazards?.[0],
    scenario?.firstImpression?.generalAppearance,
    'the first scene impression'
  );
}

function findFirstImpressionAnchor(scenario) {
  return pickCueAnchor(
    scenario?.firstImpression?.visibleClues?.[0],
    scenario?.firstImpression?.initialRedFlags?.[0],
    scenario?.firstImpression?.generalAppearance,
    scenario?.patientPresentation,
    'the earliest red-flag clue'
  );
}

function findVitalSetAnchor(scenario) {
  return pickCueAnchor(
    scenario?.vitalSigns?.secondSet?.context,
    scenario?.vitalSigns?.firstSet?.context,
    scenario?.secondaryAssessment?.evolvingFindings?.[0],
    'the reassessment vital context'
  );
}

function pickCueAnchor(...values) {
  for (const value of values) {
    const anchor = cleanCueAnchor(value);
    if (anchor) return anchor;
  }
  return '';
}

function cueHintSnippet(value, fallback = 'this finding', maxWords = 11, maxLen = 90) {
  const raw = cleanCueAnchor(value, maxLen)
    .replace(/^(?:the\s+crew\s+is\s+)?dispatched\s+to\s+/i, '')
    .replace(/^(?:the\s+crew\s+)?is\s+dispatched\s+to\s+/i, '')
    .replace(/^(?:the\s+)?patient\s+(?:is|was)\s+/i, '')
    .replace(/^for\s+/i, '')
    .replace(/[.!?]+$/g, '')
    .trim();

  if (!raw) return fallback;
  const words = raw.split(/\s+/).filter(Boolean);
  const clipped = words.length > maxWords ? words.slice(0, maxWords).join(' ') : raw;
  return clipped || fallback;
}

function buildVitalTrendAnchor(firstSet, secondSet) {
  const parseNumber = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  };

  const fSpo2 = parseNumber(firstSet?.spo2);
  const sSpo2 = parseNumber(secondSet?.spo2);
  if (fSpo2 != null && sSpo2 != null && fSpo2 !== sSpo2) {
    const direction = sSpo2 > fSpo2 ? 'improves' : 'drops';
    return `SpO2 ${direction} from ${fSpo2}% to ${sSpo2}%`;
  }

  const fHr = parseNumber(firstSet?.hr);
  const sHr = parseNumber(secondSet?.hr);
  if (fHr != null && sHr != null && fHr !== sHr) {
    const direction = sHr > fHr ? 'rises' : 'falls';
    return `HR ${direction} from ${fHr} to ${sHr}`;
  }

  const fRr = parseNumber(firstSet?.rr);
  const sRr = parseNumber(secondSet?.rr);
  if (fRr != null && sRr != null && fRr !== sRr) {
    const direction = sRr > fRr ? 'rises' : 'falls';
    return `RR ${direction} from ${fRr} to ${sRr}`;
  }

  const bp1 = cleanCueAnchor(firstSet?.bp, 40);
  const bp2 = cleanCueAnchor(secondSet?.bp, 40);
  if (bp1 && bp2 && bp1 !== bp2) {
    return `BP shifts from ${bp1} to ${bp2}`;
  }

  return '';
}

function buildCueContext(scenario) {
  const chiefComplaint =
    scenario?.patientDemographics?.chiefComplaint ||
    scenario?.patientPresentation ||
    scenario?.title ||
    'the active presentation';

  const likelyDiagnosis = pickCueAnchor(
    scenario?.clinicalReasoning,
    Array.isArray(scenario?.differentialDiagnosis) ? scenario.differentialDiagnosis[0] : '',
    scenario?.title,
    'the current working diagnosis'
  );

  const location =
    scenario?.callInformation?.location ||
    scenario?.sceneArrival?.sceneDescription ||
    'this response environment';

  const firstSet = scenario?.vitalSigns?.firstSet || {};
  const secondSet = scenario?.vitalSigns?.secondSet || {};
  const abnormalSignals = [];
  if (firstSet?.spo2 && Number(firstSet.spo2) < 94) abnormalSignals.push(`SpO2 ${firstSet.spo2}%`);
  if (firstSet?.rr && Number(firstSet.rr) >= 24) abnormalSignals.push(`RR ${firstSet.rr}`);
  if (firstSet?.hr && Number(firstSet.hr) >= 110) abnormalSignals.push(`HR ${firstSet.hr}`);
  if (typeof firstSet?.bp === 'string' && firstSet.bp.trim()) abnormalSignals.push(`BP ${firstSet.bp.trim()}`);
  const vitalAnchor = abnormalSignals[0] || buildVitalTrendAnchor(firstSet, secondSet) || 'the first vital trend';

  const vitalTrendAnchor = buildVitalTrendAnchor(firstSet, secondSet) || vitalAnchor;

  const mechanismAnchor = pickCueAnchor(
    scenario?.incidentNarrative,
    scenario?.sample?.eventsLeadingUp,
    scenario?.opqrst?.onset,
    scenario?.callInformation?.dispatchNotes?.[0],
    'the reported mechanism and timeline'
  );

  const barrierAnchor = pickCueAnchor(
    scenario?.historyGathering?.contradictionsOrBarriers?.[0],
    scenario?.sceneArrival?.hazards?.[0],
    scenario?.sceneArrival?.accessIssues,
    'scene and history barriers'
  );

  const reassessmentAnchor = pickCueAnchor(
    scenario?.secondaryAssessment?.evolvingFindings?.[0],
    scenario?.secondaryAssessment?.keyFindings?.[0],
    scenario?.transportPhase?.reassessmentFocus?.[0],
    'the next reassessment trigger'
  );

  const treatmentAnchor = pickCueAnchor(
    scenario?.expectedTreatment?.[0],
    scenario?.initialAssessment?.immediateInterventions?.[0],
    'the first high-yield treatment step'
  );

  const medicationDoseAnchor = findMedicationDoseAnchor(scenario);
  const protocolActionAnchor = findProtocolActionAnchor(scenario);
  const pitfallAnchor = findTeachingPitfallAnchor(scenario);
  const presentationAnchor = findPresentationAnchor(scenario);
  const sceneAnchor = findSceneAnchor(scenario);
  const firstImpressionAnchor = findFirstImpressionAnchor(scenario);
  const vitalSetAnchor = findVitalSetAnchor(scenario);

  const progressionAnchor =
    scenario?.caseProgression?.withoutProperTreatment?.[0] ||
    scenario?.caseProgression?.withIncorrectTreatment?.[0] ||
    'worsening perfusion and fatigue signs';

  const transportAnchor =
    scenario?.transportPhase?.transportConsiderations?.[0] ||
    'handoff-ready reassessment priorities';

  const directiveAnchor =
    scenario?.directiveSources?.[0] ||
    'the relevant Ontario directive principle';

  const handoffAnchor = pickCueAnchor(
    scenario?.transportPhase?.handoffConsiderations,
    scenario?.transportPhase?.ongoingCare?.[0],
    'the handoff-critical clinical trajectory'
  );

  const likelyDiagnosisHint = cueHintSnippet(likelyDiagnosis, 'your working diagnosis', 8, 80)
    .replace(/^(?:this\s+patient\s+is\s+experiencing|patient\s+is\s+experiencing)\s+/i, '')
    .replace(/\blikely\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim() || 'your working diagnosis';

  return {
    chiefComplaint: normalizeSentenceSpacing(chiefComplaint),
    chiefComplaintHint: cueHintSnippet(chiefComplaint, 'this presentation', 8, 70),
    likelyDiagnosis: normalizeSentenceSpacing(likelyDiagnosis),
    likelyDiagnosisHint,
    location: normalizeSentenceSpacing(location),
    locationHint: cueHintSnippet(location, 'scene entry', 6, 60),
    vitalAnchor: normalizeSentenceSpacing(vitalAnchor),
    vitalTrendAnchor: normalizeSentenceSpacing(vitalTrendAnchor),
    mechanismAnchor: normalizeSentenceSpacing(mechanismAnchor),
    mechanismHint: cueHintSnippet(mechanismAnchor, 'the dispatch story', 10, 90),
    barrierAnchor: normalizeSentenceSpacing(barrierAnchor),
    barrierHint: cueHintSnippet(barrierAnchor, 'the biggest history gap', 10, 90),
    reassessmentAnchor: normalizeSentenceSpacing(reassessmentAnchor),
    reassessmentHint: cueHintSnippet(reassessmentAnchor, 'your next reassessment trigger', 9, 80),
    treatmentAnchor: normalizeSentenceSpacing(treatmentAnchor),
    medicationDoseAnchor: normalizeSentenceSpacing(medicationDoseAnchor),
    protocolActionAnchor: normalizeSentenceSpacing(protocolActionAnchor),
    protocolActionHint: cueHintSnippet(protocolActionAnchor, 'the next protocol step', 10, 90),
    pitfallAnchor: normalizeSentenceSpacing(pitfallAnchor),
    presentationAnchor: normalizeSentenceSpacing(presentationAnchor),
    sceneAnchor: normalizeSentenceSpacing(sceneAnchor),
    firstImpressionAnchor: normalizeSentenceSpacing(firstImpressionAnchor),
    vitalSetAnchor: normalizeSentenceSpacing(vitalSetAnchor),
    progressionAnchor: normalizeSentenceSpacing(progressionAnchor),
    progressionHint: cueHintSnippet(progressionAnchor, 'the deterioration branch', 11, 95),
    transportAnchor: normalizeSentenceSpacing(transportAnchor),
    transportHint: cueHintSnippet(transportAnchor, 'the transport priority', 10, 85),
    handoffAnchor: normalizeSentenceSpacing(handoffAnchor),
    handoffHint: cueHintSnippet(handoffAnchor, 'the handoff trajectory', 10, 90),
    directiveAnchor: normalizeSentenceSpacing(directiveAnchor),
    directiveHint: cueHintSnippet(directiveAnchor, 'the governing PCS rule', 8, 70)
  };
}

function buildContextualCueBank(scenario, variationSeed = 0) {
  const c = buildCueContext(scenario);
  const seed = computeCueSeedOffset(scenario, variationSeed);

  // Pull call-type-specific teaching errors from scenario hooks to enrich pitfall cues
  const hookCallType = normalizeCallFamily(scenario?.callInformation?.type || '');
  const scenarioHookEntries = getScenarioHook(hookCallType);
  const hookErrorPool = scenarioHookEntries.flatMap(({ hook }) => hook.commonTeachingErrors || []);
  const primaryHookError = hookErrorPool.length
    ? hookErrorPool[Math.abs(seed) % hookErrorPool.length]
    : '';

  const phaseOffset = {
    presentation: 1,
    narrative: 2,
    arrival: 3,
    history: 4,
    assessment: 5,
    treatment: 6,
    protocol: 7,
    progression: 8,
    transport: 9,
    reasoning: 10
  };
  const pickVariant = (phase, variants) => {
    if (!Array.isArray(variants) || !variants.length) return '';
    const shift = Math.abs(seed + (phaseOffset[phase] || 0));
    const ordered = variants.map((text, idx) => ({
      text,
      idx,
      score:
        ((idx + shift) % variants.length) +
        (hasRecentCueFingerprint(text) ? variants.length : 0) +
        (hasRecentCueOpening(text) ? 2 : 0)
    }));
    ordered.sort((left, right) => left.score - right.score);
    return ordered[0]?.text || variants[0];
  };

  const doseSupport = c.medicationDoseAnchor
    ? ` Use the documented dose exactly: ${c.medicationDoseAnchor}.`
    : '';

  const protocolSupport = c.protocolActionAnchor
    ? ` Protocol-check this step: ${c.protocolActionAnchor}. Name why it fits and what would stop it.`
    : '';

  const canUse = {
    scene: isConcreteCueAnchor(c.sceneAnchor),
    firstImpression: isConcreteCueAnchor(c.firstImpressionAnchor),
    presentation: isConcreteCueAnchor(c.presentationAnchor),
    narrative: isConcreteCueAnchor(c.mechanismAnchor) || isConcreteCueAnchor(c.pitfallAnchor),
    arrival: isConcreteCueAnchor(c.location) || isConcreteCueAnchor(c.mechanismAnchor),
    history: isConcreteCueAnchor(c.barrierAnchor),
    assessment: isConcreteCueAnchor(c.vitalTrendAnchor) || isConcreteCueAnchor(c.reassessmentAnchor),
    vitals: isConcreteCueAnchor(c.vitalSetAnchor) || isConcreteCueAnchor(c.vitalTrendAnchor),
    treatment: isConcreteCueAnchor(c.treatmentAnchor),
    protocol: Boolean(protocolSupport),
    progression: isConcreteCueAnchor(c.progressionAnchor),
    transport: isConcreteCueAnchor(c.transportAnchor) || isConcreteCueAnchor(c.handoffAnchor),
    reasoning: isConcreteCueAnchor(c.likelyDiagnosis) || isConcreteCueAnchor(c.vitalTrendAnchor)
  };

  return {
    scene: pickVariant('presentation', [
      `Use the scene clue first: ${c.sceneAnchor}. Consider how it changes your first priority.`,
      `Read the scene as diagnostic data: ${c.sceneAnchor}. Watch for the risk it adds before you narrow the case.`,
      `Flag the scene risk early: ${c.sceneAnchor}. Note what it changes right now.`
    ]) && canUse.scene
      ? pickVariant('presentation', [
          `Use the scene clue first: ${c.sceneAnchor}. Consider how it changes your first priority.`,
          `Read the scene as diagnostic data: ${c.sceneAnchor}. Watch for the risk it adds before you narrow the case.`,
          `Flag the scene risk early: ${c.sceneAnchor}. Note what it changes right now.`
        ])
      : '',
    firstImpression: canUse.firstImpression ? pickVariant('arrival', [
      `Call out the first red flag: ${c.firstImpressionAnchor}. It should change urgency before you have the full story.`,
      `Do not rush past first impression. ${c.firstImpressionAnchor} should change urgency now. Watch for the next finding that confirms it.`,
      `Anchor your opening decision to this clue: ${c.firstImpressionAnchor}. Explain why it raises urgency.`
    ]) : '',
    presentation: canUse.presentation ? pickVariant('presentation', [
      `Start with the loudest clue: ${c.presentationAnchor}. Keep focus on why it matters now.`,
      `Use the strongest presentation clue: ${c.presentationAnchor}. Tie it to urgency.`,
      `Commit to the key presentation signal: ${c.presentationAnchor}. Keep focus on the first risk it points to.`
    ]) : '',
    narrative: canUse.narrative ? pickVariant('narrative', [
      `Use the story to test your first impression: ${c.mechanismAnchor}. Name the trap here: ${primaryHookError || c.pitfallAnchor || 'early anchoring'}.`,
      `Do not treat the narrative as filler: ${c.mechanismAnchor}. Watch for the clue that could overturn your first read.`,
      `Pressure-test your first read against the story: ${c.mechanismAnchor}. Identify the reasoning trap.`
    ]) : '',
    arrival: canUse.arrival ? pickVariant('arrival', [
      `At ${c.locationHint}, call the immediate threat in one line for this ${c.chiefComplaintHint} call.`,
      `Before interventions, name what could crash first in this ${c.chiefComplaintHint} case.`,
      `On arrival, state the immediate danger in this ${c.chiefComplaintHint} call before acting.`
    ]) : '',
    history: canUse.history ? pickVariant('history', [
      `Ask one focused question about ${c.barrierHint}. Use the answer to move ${c.likelyDiagnosisHint} up or down.`,
      `If the story is messy, pick one missing detail that changes risk or destination.`,
      `Pin down one history gap: ${c.barrierHint}. Use it to adjust your differential rank.`
    ]) : '',
    assessment: canUse.assessment ? pickVariant('assessment', [
      `Look at ${c.vitalAnchor} with ${c.vitalTrendAnchor}. Decide where this patient is heading.`,
      `Do not get stuck on one number. Use ${c.vitalTrendAnchor} as the trend.`,
      `Trend first, then decide: ${c.vitalTrendAnchor}. Keep the likely direction in view.`
    ]) : '',
    vitals: canUse.vitals ? pickVariant('assessment', [
      `Don't just document ${c.vitalSetAnchor}. Decide whether ${c.vitalTrendAnchor} means response, deterioration, or the story is off.`,
      `These vitals should change what you do next. Use ${c.vitalTrendAnchor} and ${c.vitalSetAnchor} to decide if the patient is actually improving.`,
      `Read this set as a decision point: ${c.vitalSetAnchor}. Name the action it triggers.`
    ]) : '',
    treatment: canUse.treatment ? pickVariant('treatment', [
      `Pick your first treatment priority: ${c.treatmentAnchor}. Watch for what should improve first.${doseSupport}`,
      `Pick one treatment target: ${c.treatmentAnchor}. Watch for the finding that confirms benefit.${doseSupport}`,
      `Go after the immediate treatment target: ${c.treatmentAnchor}. Watch which finding should improve first.${doseSupport}`,
      `Treat the highest-risk feature first: ${c.treatmentAnchor}. Define failure using ${c.vitalTrendAnchor}.${doseSupport}`,
      `Commit to one treatment goal: ${c.treatmentAnchor}. Keep the reassessment trigger explicit.${doseSupport}`
    ]) : '',
    protocol: canUse.protocol
      ? pickVariant('protocol', [
          `Protocol check: ${c.protocolActionHint}. Name the finding that supports it.${doseSupport}`,
          `Before you move, link ${c.protocolActionHint} to one real finding: ${c.reassessmentHint}.${doseSupport}`,
          `Quick protocol check: what in this patient supports ${c.protocolActionHint}?${doseSupport}`,
          `Use protocol as a guardrail. Tie ${c.protocolActionHint} to ${c.vitalTrendAnchor}.${doseSupport}`,
          `Verify the protocol step: ${c.protocolActionHint}. State the stop condition before you proceed.${doseSupport}`
        ])
      : '',
    progression: canUse.progression ? pickVariant('progression', [
      `Rehearse the no-treatment branch now: ${c.progressionHint}. ${primaryHookError ? `Watch for ${primaryHookError}.` : 'Name the first red flag.'}`,
      `If ${c.progressionHint} starts to appear, what is your first escalation move?`,
      `Stress-test your plan against the worsening branch: ${c.progressionHint}. Keep the escalation trigger clear.`,
      `Before decline, rehearse the fork in the road: ${c.progressionHint}. ${primaryHookError ? `Avoid ${primaryHookError}.` : 'Name the delayed-action mistake.'}`,
      `Map the deterioration path early: ${c.progressionHint}. Keep the trigger that changes your plan in view.`
    ]) : '',
    transport: canUse.transport ? pickVariant('transport', [
      `On the move, prioritize ${c.transportHint}. Watch ${c.reassessmentHint}.`,
      `Pick one transport monitor target: ${c.transportHint}.`,
      `During transport, protect the priority signal: ${c.transportHint}. Keep in mind what would force escalation.`
    ]) : '',
    reasoning: canUse.reasoning ? pickVariant('reasoning', [
      `Start with ${c.mechanismHint}, add ${c.vitalTrendAnchor}, then settle on your working diagnosis: ${c.likelyDiagnosisHint}.`,
      `Give your best-fit diagnosis for this trend: ${c.likelyDiagnosisHint}. Then look for the clue that would challenge it.`,
      `Keep your current diagnostic frame visible: ${c.likelyDiagnosisHint}. Watch for one finding that could disconfirm it.`
    ]) : ''
  };
}

function ensureTeachingCueCoverage(scenario, includeTeachingCues, variationSeed = 0) {
  if (!includeTeachingCues || !scenario || typeof scenario !== 'object') {
    return scenario;
  }

  const baseline = collectTeachingCueMetrics(scenario);
  const qualityLooksStrong =
    baseline.cueCount >= 6 &&
    baseline.sectionsWithCues.length >= 4 &&
    baseline.duplicateCueCount <= 1 &&
    baseline.genericCueCount <= 1;

  if (qualityLooksStrong) {
    return scenario;
  }

  const addArrayCue = (obj, key, cueText, cueTag) => {
    if (!String(cueText || '').trim()) return;
    if (!obj || typeof obj !== 'object') return;
    if (!Array.isArray(obj[key])) obj[key] = [];
    const candidate = createCue(cueText, cueTag);
    const existingFingerprints = obj[key]
      .flatMap((entry) => getTeachingCueMatches(entry).map((cue) => fingerprintCueText(cue.text)));
    if (!existingFingerprints.includes(fingerprintCueText(cueText))) {
      obj[key].push(candidate);
    }
  };

  const pushArrayCue = (arr, cueText, cueTag) => {
    if (!String(cueText || '').trim()) return;
    if (!Array.isArray(arr)) return;
    const existingFingerprints = arr
      .flatMap((entry) => getTeachingCueMatches(entry).map((cue) => fingerprintCueText(cue.text)));
    if (!existingFingerprints.includes(fingerprintCueText(cueText))) {
      arr.push(createCue(cueText, cueTag));
    }
  };

  const cueBank = buildContextualCueBank(scenario, variationSeed);

  const sectionsWithCues = new Set(baseline.sectionsWithCues || []);
  const hasAny = (arr) => Array.isArray(arr) && arr.some((item) => String(item || '').trim());
  const hasText = (value) => Boolean(String(value || '').trim());

  const placementDefs = [
    {
      key: 'scene',
      section: 'sceneArrival',
      applicability: () =>
        hasText(scenario?.sceneArrival?.sceneDescription) ||
        hasAny(scenario?.sceneArrival?.hazards) ||
        hasAny(scenario?.sceneArrival?.environmentDetails),
      priority: () =>
        (hasAny(scenario?.sceneArrival?.hazards) ? 3 : 0) +
        (hasText(scenario?.sceneArrival?.accessIssues) ? 2 : 0),
      apply: () => {
        scenario.sceneArrival.sceneDescription = appendCueToString(
          scenario?.sceneArrival?.sceneDescription,
          cueBank.scene,
          'arrival'
        );
      }
    },
    {
      key: 'firstImpression',
      section: 'firstImpression',
      applicability: () =>
        hasText(scenario?.firstImpression?.generalAppearance) ||
        hasAny(scenario?.firstImpression?.initialRedFlags) ||
        hasAny(scenario?.firstImpression?.visibleClues),
      priority: () =>
        (hasAny(scenario?.firstImpression?.initialRedFlags) ? 3 : 0) +
        (hasAny(scenario?.firstImpression?.visibleClues) ? 2 : 0),
      apply: () => {
        scenario.firstImpression.generalAppearance = appendCueToString(
          scenario?.firstImpression?.generalAppearance,
          cueBank.firstImpression,
          'arrival'
        );
      }
    },
    {
      key: 'presentation',
      section: 'patientPresentation',
      applicability: () => hasText(scenario?.patientPresentation),
      priority: () =>
        (hasText(scenario?.patientPresentation) ? 2 : 0) +
        (hasAny(scenario?.firstImpression?.visibleClues) ? 2 : 0),
      apply: () => {
        scenario.patientPresentation = appendCueToString(
          scenario?.patientPresentation,
          cueBank.presentation,
          'assessment'
        );
      }
    },
    {
      key: 'narrative',
      section: 'incidentNarrative',
      applicability: () => hasText(scenario?.incidentNarrative),
      priority: () =>
        (hasText(scenario?.incidentNarrative) ? 2 : 0) +
        (hasAny(scenario?.historyGathering?.contradictionsOrBarriers) ? 2 : 0),
      apply: () => {
        scenario.incidentNarrative = appendCueToString(
          scenario?.incidentNarrative,
          cueBank.narrative,
          'history'
        );
      }
    },
    {
      key: 'arrival',
      section: 'initialAssessment',
      applicability: () =>
        hasText(scenario?.initialAssessment?.generalImpression) ||
        hasText(scenario?.firstImpression?.generalAppearance),
      priority: () => (hasAny(scenario?.firstImpression?.initialRedFlags) ? 3 : 1),
      apply: () => {
        scenario.initialAssessment.generalImpression = appendCueToString(
          scenario?.initialAssessment?.generalImpression,
          cueBank.arrival,
          'arrival'
        );
      }
    },
    {
      key: 'history',
      section: 'historyGathering',
      applicability: () =>
        hasAny(scenario?.historyGathering?.additionalHistory) ||
        hasAny(scenario?.historyGathering?.contradictionsOrBarriers) ||
        hasAny(scenario?.historyGathering?.sceneContextClues),
      priority: () =>
        (hasAny(scenario?.historyGathering?.contradictionsOrBarriers) ? 3 : 0) +
        (hasAny(scenario?.historyGathering?.sceneContextClues) ? 2 : 0),
      apply: () => addArrayCue(scenario.historyGathering, 'additionalHistory', cueBank.history, 'history')
    },
    {
      key: 'assessment',
      section: 'secondaryAssessment',
      applicability: () =>
        hasAny(scenario?.secondaryAssessment?.keyFindings) ||
        hasAny(scenario?.secondaryAssessment?.evolvingFindings) ||
        hasAny(scenario?.secondaryAssessment?.missedIfNotAssessed),
      priority: () =>
        (hasAny(scenario?.secondaryAssessment?.evolvingFindings) ? 3 : 0) +
        (hasAny(scenario?.secondaryAssessment?.missedIfNotAssessed) ? 2 : 0),
      apply: () => addArrayCue(scenario.secondaryAssessment, 'missedIfNotAssessed', cueBank.assessment, 'assessment')
    },
    {
      key: 'vitals',
      section: 'vitalSigns',
      applicability: () =>
        hasText(scenario?.vitalSigns?.firstSet?.context) ||
        hasText(scenario?.vitalSigns?.secondSet?.context),
      priority: () =>
        ((scenario?.vitalSigns?.additionalSets || []).length > 0 ? 3 : 0) +
        (hasText(scenario?.vitalSigns?.secondSet?.context) ? 2 : 0),
      apply: () => {
        scenario.vitalSigns.secondSet.context = appendCueToString(
          scenario?.vitalSigns?.secondSet?.context,
          cueBank.vitals,
          'assessment'
        );
      }
    },
    {
      key: 'treatment',
      section: 'expectedTreatment',
      applicability: () => hasAny(scenario?.expectedTreatment),
      priority: () => (hasAny(scenario?.expectedTreatment) ? 2 : 0),
      apply: () => pushArrayCue(scenario.expectedTreatment, cueBank.treatment, 'treatment')
    },
    {
      key: 'protocol',
      section: 'protocolNotes',
      applicability: () => hasAny(scenario?.protocolNotes),
      priority: () =>
        (findProtocolActionAnchor(scenario) ? 4 : 0) +
        (hasAny(scenario?.protocolNotes) ? 1 : 0),
      apply: () => pushArrayCue(scenario.protocolNotes, cueBank.protocol, 'protocol')
    },
    {
      key: 'progression',
      section: 'caseProgression',
      applicability: () =>
        hasAny(scenario?.caseProgression?.withoutProperTreatment) ||
        hasAny(scenario?.caseProgression?.withIncorrectTreatment),
      priority: () =>
        (hasAny(scenario?.caseProgression?.withIncorrectTreatment) ? 3 : 0) +
        (hasAny(scenario?.caseProgression?.withoutProperTreatment) ? 2 : 0),
      apply: () => addArrayCue(scenario.caseProgression, 'withoutProperTreatment', cueBank.progression, 'progression')
    },
    {
      key: 'transport',
      section: 'transportPhase',
      applicability: () =>
        hasAny(scenario?.transportPhase?.transportConsiderations) ||
        hasAny(scenario?.transportPhase?.reassessmentFocus) ||
        hasText(scenario?.transportPhase?.handoffConsiderations),
      priority: () =>
        (hasAny(scenario?.transportPhase?.transportConsiderations) ? 2 : 0) +
        (hasAny(scenario?.transportPhase?.reassessmentFocus) ? 2 : 0) +
        (hasText(scenario?.transportPhase?.handoffConsiderations) ? 1 : 0),
      apply: () => addArrayCue(scenario.transportPhase, 'reassessmentFocus', cueBank.transport, 'transport')
    },
    {
      key: 'reasoning',
      section: 'clinicalReasoning',
      applicability: () => hasText(scenario?.clinicalReasoning),
      priority: () =>
        (hasText(scenario?.clinicalReasoning) ? 2 : 0) +
        ((scenario?.vitalSigns?.additionalSets || []).length > 0 ? 2 : 0),
      apply: () => {
        scenario.clinicalReasoning = appendCueToString(
          scenario.clinicalReasoning,
          cueBank.reasoning,
          'reasoning'
        );
      }
    }
  ];

  const getAtPath = (root, path) => {
    if (!root || typeof root !== 'object') return undefined;
    return path.reduce((current, segment) => {
      if (!current || typeof current !== 'object') return undefined;
      return current[segment];
    }, root);
  };

  const setAtPath = (root, path, value) => {
    if (!root || typeof root !== 'object' || !Array.isArray(path) || !path.length) return;
    const parentPath = path.slice(0, -1);
    const lastKey = path[path.length - 1];
    const parent = parentPath.length ? getAtPath(root, parentPath) : root;
    if (!parent || typeof parent !== 'object') return;
    parent[lastKey] = value;
  };

  const buildStringPlacement = ({ key, section, path, cueKey, cueTag, priority = 0 }) => ({
    key,
    section,
    applicability: () => hasText(getAtPath(scenario, path)),
    priority: () => priority,
    apply: () => {
      const current = getAtPath(scenario, path);
      setAtPath(scenario, path, appendCueToString(current, cueBank[cueKey], cueTag));
    }
  });

  const buildArrayPlacement = ({ key, section, parentPath, arrayKey, cueKey, cueTag, priority = 0 }) => ({
    key,
    section,
    applicability: () => hasAny(getAtPath(scenario, [...parentPath, arrayKey])),
    priority: () => priority,
    apply: () => {
      const parent = getAtPath(scenario, parentPath);
      addArrayCue(parent, arrayKey, cueBank[cueKey], cueTag);
    }
  });

  const dynamicPlacementDefs = [
    buildArrayPlacement({
      key: 'arrival',
      section: 'callInformation',
      parentPath: ['callInformation'],
      arrayKey: 'dispatchNotes',
      cueKey: 'arrival',
      cueTag: 'arrival',
      priority: 5
    }),
    buildStringPlacement({
      key: 'arrival',
      section: 'callInformation',
      path: ['callInformation', 'crewNotes'],
      cueKey: 'arrival',
      cueTag: 'arrival',
      priority: 4
    }),
    buildStringPlacement({
      key: 'presentation',
      section: 'patientDemographics',
      path: ['patientDemographics', 'appearance'],
      cueKey: 'presentation',
      cueTag: 'assessment',
      priority: 4
    }),
    buildStringPlacement({
      key: 'history',
      section: 'patientDemographics',
      path: ['patientDemographics', 'chiefComplaint'],
      cueKey: 'history',
      cueTag: 'history',
      priority: 4
    }),
    buildStringPlacement({
      key: 'history',
      section: 'opqrst',
      path: ['opqrst', 'onset'],
      cueKey: 'history',
      cueTag: 'history',
      priority: 3
    }),
    buildStringPlacement({
      key: 'assessment',
      section: 'sample',
      path: ['sample', 'signsAndSymptoms'],
      cueKey: 'assessment',
      cueTag: 'assessment',
      priority: 4
    }),
    buildStringPlacement({
      key: 'narrative',
      section: 'sample',
      path: ['sample', 'eventsLeadingUp'],
      cueKey: 'narrative',
      cueTag: 'history',
      priority: 3
    }),
    buildArrayPlacement({
      key: 'history',
      section: 'sample',
      parentPath: ['sample'],
      arrayKey: 'medications',
      cueKey: 'history',
      cueTag: 'history',
      priority: 3
    }),
    buildStringPlacement({
      key: 'assessment',
      section: 'physicalExam',
      path: ['physicalExam', 'generalAppearance'],
      cueKey: 'assessment',
      cueTag: 'assessment',
      priority: 4
    }),
    buildStringPlacement({
      key: 'assessment',
      section: 'physicalExam',
      path: ['physicalExam', 'breathing'],
      cueKey: 'assessment',
      cueTag: 'assessment',
      priority: 3
    }),
    buildStringPlacement({
      key: 'assessment',
      section: 'physicalExam',
      path: ['physicalExam', 'circulation'],
      cueKey: 'assessment',
      cueTag: 'assessment',
      priority: 3
    }),
    buildStringPlacement({
      key: 'assessment',
      section: 'physicalExam',
      path: ['physicalExam', 'neuro'],
      cueKey: 'assessment',
      cueTag: 'assessment',
      priority: 3
    }),
    buildArrayPlacement({
      key: 'assessment',
      section: 'initialAssessment',
      parentPath: ['initialAssessment'],
      arrayKey: 'immediatePriorities',
      cueKey: 'assessment',
      cueTag: 'assessment',
      priority: 4
    }),
    buildArrayPlacement({
      key: 'treatment',
      section: 'initialAssessment',
      parentPath: ['initialAssessment'],
      arrayKey: 'immediateInterventions',
      cueKey: 'treatment',
      cueTag: 'treatment',
      priority: 5
    }),
    buildArrayPlacement({
      key: 'assessment',
      section: 'secondaryAssessment',
      parentPath: ['secondaryAssessment'],
      arrayKey: 'keyFindings',
      cueKey: 'assessment',
      cueTag: 'assessment',
      priority: 4
    }),
    buildArrayPlacement({
      key: 'assessment',
      section: 'secondaryAssessment',
      parentPath: ['secondaryAssessment'],
      arrayKey: 'evolvingFindings',
      cueKey: 'vitals',
      cueTag: 'assessment',
      priority: 4
    }),
    buildArrayPlacement({
      key: 'assessment',
      section: 'additionalAssessments',
      parentPath: [],
      arrayKey: 'additionalAssessments',
      cueKey: 'assessment',
      cueTag: 'assessment',
      priority: 3
    }),
    buildStringPlacement({
      key: 'vitals',
      section: 'vitalSigns',
      path: ['vitalSigns', 'firstSet', 'context'],
      cueKey: 'vitals',
      cueTag: 'assessment',
      priority: 4
    }),
    buildArrayPlacement({
      key: 'progression',
      section: 'caseProgression',
      parentPath: ['caseProgression'],
      arrayKey: 'withProperTreatment',
      cueKey: 'progression',
      cueTag: 'progression',
      priority: 3
    }),
    buildArrayPlacement({
      key: 'transport',
      section: 'transportPhase',
      parentPath: ['transportPhase'],
      arrayKey: 'ongoingCare',
      cueKey: 'transport',
      cueTag: 'transport',
      priority: 4
    }),
    buildArrayPlacement({
      key: 'reasoning',
      section: 'learningObjectives',
      parentPath: [],
      arrayKey: 'learningObjectives',
      cueKey: 'reasoning',
      cueTag: 'reasoning',
      priority: 3
    }),
    buildArrayPlacement({
      key: 'reasoning',
      section: 'selfReflectionPrompts',
      parentPath: [],
      arrayKey: 'selfReflectionPrompts',
      cueKey: 'reasoning',
      cueTag: 'reasoning',
      priority: 3
    }),
    buildStringPlacement({
      key: 'reasoning',
      section: 'scenarioRationale',
      path: ['scenarioRationale'],
      cueKey: 'reasoning',
      cueTag: 'reasoning',
      priority: 2
    })
  ];

  const allPlacementDefs = [...placementDefs, ...dynamicPlacementDefs];

  const applicable = allPlacementDefs.filter((item) => item.applicability());
  const available = applicable.length ? applicable : allPlacementDefs;
  const seedOffset = computeCueSeedOffset(scenario, variationSeed);

  const ranked = available
    .map((item, index) => {
      const sectionBonus = sectionsWithCues.has(item.section) ? 0 : 4;
      const rotationBonus = ((index - seedOffset) % available.length + available.length) % available.length;
      const phasePenalty = baseline.cueTags.includes(item.key) ? 1.5 : 0;
      return {
        ...item,
        score: item.priority() + sectionBonus - phasePenalty - rotationBonus * 0.6
      };
    })
    .sort((left, right) => right.score - left.score);

  const pivot = ranked.length ? seedOffset % ranked.length : 0;
  const rotated = ranked.length
    ? [...ranked.slice(pivot), ...ranked.slice(0, pivot)]
    : ranked;
  const topWindow = rotated.slice(0, Math.min(rotated.length, 8));
  const shuffledWindow = seededShuffle(topWindow, seedOffset + baseline.cueCount + Number(variationSeed || 0));
  const remainder = rotated.slice(topWindow.length);
  const selectionOrder = [...shuffledWindow, ...remainder];

  const targetCueCount = Math.max(6, baseline.cueCount);
  const targetSectionCount = 4;
  const maxPlacements = Math.min(ranked.length, Math.max(4, targetCueCount - baseline.cueCount + 2));
  const repetitiveTriadKeys = new Set(['treatment', 'protocol', 'progression']);

  let placementsApplied = 0;
  let triadPlacements = 0;
  for (const placement of selectionOrder) {
    if (placementsApplied >= maxPlacements) break;

    const currentMetrics = collectTeachingCueMetrics(scenario);
    if (
      repetitiveTriadKeys.has(placement.key) &&
      triadPlacements >= 1 &&
      currentMetrics.sectionsWithCues.length < targetSectionCount
    ) {
      continue;
    }

    if (
      currentMetrics.cueCount >= targetCueCount &&
      currentMetrics.sectionsWithCues.length >= targetSectionCount &&
      currentMetrics.duplicateCueCount <= 1
    ) {
      break;
    }

    placement.apply();
    placementsApplied += 1;
    if (repetitiveTriadKeys.has(placement.key)) {
      triadPlacements += 1;
    }
  }

  return scenario;
}

function collectSentenceSpacingIssues(value, path = 'root', issues = []) {
  // Flag likely sentence-boundary spacing errors while avoiding decimals like "3.4".
  const spacingPattern = /[!?](?:["')\]]?)(?=[A-Z])|\.(?:["')\]]?)(?=[A-Z])/g;

  if (typeof value === 'string') {
    const normalized = String(value || '');
    if (spacingPattern.test(normalized)) {
      issues.push(path);
    }
    return issues;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => collectSentenceSpacingIssues(item, `${path}[${index}]`, issues));
    return issues;
  }

  if (value && typeof value === 'object') {
    Object.entries(value).forEach(([key, child]) => {
      collectSentenceSpacingIssues(child, `${path}.${key}`, issues);
    });
  }

  return issues;
}

function estimateScenarioComplexity(scenario) {
  const text = collectScenarioNarrativeText(scenario, { forComplexity: true });
  const sceneBurdenText = [
    ...(scenario?.sceneArrival?.hazards || []),
    ...(scenario?.historyGathering?.contradictionsOrBarriers || []),
    ...(scenario?.transportPhase?.transportConsiderations || [])
  ]
    .map((value) => stripTeachingCueMarkup(String(value || '')).toLowerCase())
    .join(' ');
  const additionalSetCount = (scenario?.vitalSigns?.additionalSets || []).length;
  const hazardCount = (scenario?.sceneArrival?.hazards || []).length;
  const contradictionCount = (scenario?.historyGathering?.contradictionsOrBarriers || []).length;
  const transportFactor = Math.min((scenario?.transportPhase?.transportConsiderations || []).length, 2);
  const accessFactor = scenario?.sceneArrival?.accessIssues ? 1 : 0;
  const highBurdenSignal = Math.min(countKeywordMatches(sceneBurdenText, HIGH_BURDEN_KEYWORDS), 1);
  const withholdingSignal = Math.min(countKeywordMatches(text, WITHHOLDING_KEYWORDS), 1);
  const acuityKeywordSignal = Math.min(countKeywordMatches(text, HIGH_ACUITY_KEYWORDS), 2);

  const parseNumber = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  };
  const parseSystolic = (bp) => {
    const match = String(bp || '').match(/(\d{2,3})\s*\//);
    return match ? Number(match[1]) : null;
  };
  const allVitalSets = [
    scenario?.vitalSigns?.firstSet,
    scenario?.vitalSigns?.secondSet,
    ...(scenario?.vitalSigns?.additionalSets || [])
  ].filter(Boolean);

  let physiologicAcuityScore = 0;
  for (const set of allVitalSets) {
    const spo2 = parseNumber(set?.spo2);
    const rr = parseNumber(set?.rr);
    const gcs = parseNumber(set?.gcs);
    const hr = parseNumber(set?.hr);
    const sbp = parseSystolic(set?.bp);

    if (spo2 != null && spo2 < 90) physiologicAcuityScore += 2;
    if (rr != null && rr >= 30) physiologicAcuityScore += 1;
    if (gcs != null && gcs < 15) physiologicAcuityScore += 1;
    if (hr != null && hr >= 130) physiologicAcuityScore += 1;
    if (sbp != null && sbp < 100) physiologicAcuityScore += 1;
  }

  const burdenScore =
    hazardCount +
    contradictionCount +
    transportFactor +
    accessFactor +
    additionalSetCount * 2 +
    highBurdenSignal +
    withholdingSignal +
    acuityKeywordSignal +
    Math.min(physiologicAcuityScore, 3);

  if (physiologicAcuityScore >= 2 || (acuityKeywordSignal >= 1 && burdenScore >= 5)) {
    return { estimated: 'Moderate', burdenScore, additionalSetCount };
  }

  if (burdenScore >= 8) return { estimated: 'Complex', burdenScore, additionalSetCount };
  if (burdenScore >= 5) return { estimated: 'Moderate', burdenScore, additionalSetCount };
  return { estimated: 'Simple', burdenScore, additionalSetCount };
}

function countMedicationMentionsInScenario(scenario) {
  const relevantText = [
    ...(scenario?.expectedTreatment || []),
    ...(scenario?.protocolNotes || []),
    ...(scenario?.learningObjectives || []),
    scenario?.teachersPoints,
    ...(scenario?.caseProgression?.withProperTreatment || []),
    ...(scenario?.caseProgression?.withoutProperTreatment || []),
    ...(scenario?.caseProgression?.withIncorrectTreatment || []),
    ...(scenario?.grsAnchors?.decisionMaking?.['5'] || []),
    ...(scenario?.grsAnchors?.decisionMaking?.['7'] || [])
  ].join(' ');

  return countKeywordMatches(relevantText, MEDICATION_KEYWORDS);
}

function getNestedValue(source, path) {
  if (!source || typeof source !== 'object') return '';
  return path.split('.').reduce((current, segment) => {
    if (!current || typeof current !== 'object') return '';
    return current[segment];
  }, source);
}

function asTrimmedText(value) {
  return normalizeSentenceSpacing(stripTeachingCueMarkup(stringifyValue(value))).trim();
}

function computeScenarioQualityProfile(scenario) {
  const requiredStringPaths = [
    'scenarioIntro',
    'title',
    'patientPresentation',
    'incidentNarrative',
    'sceneArrival.sceneDescription',
    'firstImpression.generalAppearance',
    'initialAssessment.generalImpression',
    'historyGathering.historySource',
    'clinicalReasoning',
    'transportPhase.handoffConsiderations',
    'scenarioRationale'
  ];

  const missingCoreFields = requiredStringPaths.filter((path) => !asTrimmedText(getNestedValue(scenario, path)));
  const progressionBranchCounts = {
    withProperTreatment: (scenario?.caseProgression?.withProperTreatment || []).filter(Boolean).length,
    withoutProperTreatment: (scenario?.caseProgression?.withoutProperTreatment || []).filter(Boolean).length,
    withIncorrectTreatment: (scenario?.caseProgression?.withIncorrectTreatment || []).filter(Boolean).length
  };

  const totalProgressionSteps =
    progressionBranchCounts.withProperTreatment +
    progressionBranchCounts.withoutProperTreatment +
    progressionBranchCounts.withIncorrectTreatment;

  const expectedTreatmentCount = (scenario?.expectedTreatment || []).filter(Boolean).length;
  const protocolNoteCount = (scenario?.protocolNotes || []).filter(Boolean).length;
  const directiveCount = (scenario?.directiveSources || []).filter(Boolean).length;
  const learningObjectiveCount = (scenario?.learningObjectives || []).filter(Boolean).length;
  const selfReflectionCount = (scenario?.selfReflectionPrompts || []).filter(Boolean).length;

  const transportPlanDepth =
    (scenario?.transportPhase?.transportConsiderations || []).filter(Boolean).length +
    (scenario?.transportPhase?.ongoingCare || []).filter(Boolean).length +
    (scenario?.transportPhase?.reassessmentFocus || []).filter(Boolean).length +
    (asTrimmedText(scenario?.transportPhase?.handoffConsiderations) ? 1 : 0);

  const clinicalReasoningWordCount = asTrimmedText(scenario?.clinicalReasoning)
    .split(/\s+/)
    .filter(Boolean).length;

  const cueMetrics = collectTeachingCueMetrics(scenario);

  let score = 100;
  score -= missingCoreFields.length * 4;
  if (progressionBranchCounts.withProperTreatment < 2) score -= 7;
  if (progressionBranchCounts.withoutProperTreatment < 2) score -= 7;
  if (progressionBranchCounts.withIncorrectTreatment < 2) score -= 7;
  if (totalProgressionSteps < 6) score -= 8;
  if (transportPlanDepth < 4) score -= 6;
  if (expectedTreatmentCount < 5) score -= 5;
  if (protocolNoteCount < 4) score -= 4;
  if (directiveCount < 1) score -= 8;
  if (learningObjectiveCount < 4) score -= 4;
  if (selfReflectionCount < 4) score -= 4;
  if (clinicalReasoningWordCount < 35) score -= 6;

  score = Math.max(0, Math.min(100, score));
  const tier = score >= 85 ? 'strong' : score >= 70 ? 'acceptable' : 'weak';

  return {
    score,
    tier,
    missingCoreFields,
    progressionBranchCounts,
    totalProgressionSteps,
    transportPlanDepth,
    expectedTreatmentCount,
    protocolNoteCount,
    directiveCount,
    learningObjectiveCount,
    selfReflectionCount,
    clinicalReasoningWordCount,
    cueCount: cueMetrics.cueCount,
    cueSectionCount: cueMetrics.sectionsWithCues.length
  };
}

function containsMedicationLanguage(value = '') {
  const lower = stripTeachingCueMarkup(String(value || '')).toLowerCase();
  return MEDICATION_KEYWORDS.some((keyword) => lower.includes(keyword));
}

function containsMedicationIntervention(value = '') {
  // Detects only medication INTERVENTION actions (give, administer, apply, start, inject, etc.)
  // Preserves medication context/history (e.g., "Patient takes X", "History of medications", "CHF on diuretics")
  const lower = stripTeachingCueMarkup(String(value || '')).toLowerCase();
  
  // Intervention verbs (actions a medic takes)
  const interventionVerbs = ['administer', 'give', 'provide', 'apply', 'start', 'initiate', 'inject', 'deliver', 'dispense', 'bolus'];
  
  // If line contains an intervention verb AND a medication keyword, it's an intervention
  const hasInterventionVerb = interventionVerbs.some(verb => lower.includes(verb));
  const hasMedication = MEDICATION_KEYWORDS.some(keyword => lower.includes(keyword));
  
  return hasInterventionVerb && hasMedication;
}

function stripMedicationItems(items, filterType = 'broad') {
  // filterType: 'broad' removes any medication mention; 'interventionOnly' removes only intervention actions
  const normalizedItems = Array.isArray(items) ? items : coerceArray(items);
  if (!normalizedItems.length) return [];
  
  const filterFn = filterType === 'interventionOnly' ? containsMedicationIntervention : containsMedicationLanguage;
  
  return normalizedItems
    .map((item) => normalizeSentenceSpacing(String(item || '').trim()))
    .filter(Boolean)
    .filter((item) => !filterFn(item));
}

function clampSemesterTwoVitals(set) {
  if (!set || typeof set !== 'object') return set;

  const clamped = { ...set };
  const toNumber = (value) => {
    const n = extractLeadingVitalNumber(value);
    return Number.isFinite(n) ? n : null;
  };
  const parseSystolic = (bp) => {
    const match = String(bp || '').match(/(\d{2,3})\s*\//);
    return match ? Number(match[1]) : null;
  };

  const spo2 = toNumber(clamped.spo2);
  const rr = toNumber(clamped.rr);
  const gcs = toNumber(clamped.gcs);
  const hr = toNumber(clamped.hr);
  const sbp = parseSystolic(clamped.bp);

  if (spo2 != null && spo2 < 92) clamped.spo2 = '92';
  if (rr != null && rr >= 30) clamped.rr = '24';
  if (gcs != null && gcs < 15) clamped.gcs = '15';
  if (hr != null && hr >= 130) clamped.hr = '118';
  if (sbp != null && sbp < 100) clamped.bp = '108/70';

  return clamped;
}

function normalizeSimpleList(items, maxItems = 1) {
  if (!Array.isArray(items)) return [];

  return items
    .map((item) => normalizeSentenceSpacing(String(item || '').trim()))
    .filter(Boolean)
    .slice(0, maxItems);
}

function ensureTeachingPointCoverage(scenario) {
  if (!scenario || typeof scenario !== 'object') return scenario;

  const existing = teachingPointBeats(scenario?.teachersPoints || '');
  const kept = [];
  const seen = new Set();
  for (const point of existing) {
    const normalized = normalizeSentenceSpacing(String(point || '').trim());
    if (!normalized) continue;
    const fp = fingerprintCueText(normalized);
    if (!fp || seen.has(fp)) continue;
    seen.add(fp);
    kept.push(normalized);
  }

  const c = buildCueContext(scenario);
  const candidates = [
    `Anchor your first decision to ${c.presentationAnchor || c.chiefComplaint}. This matters because early framing errors delay risk recognition, so on your next call state your top risk out loud in the first minute.`,
    `Use ${c.vitalTrendAnchor || c.vitalAnchor} as a trend, not a single datapoint. Trend-based decisions reduce missed deterioration, so on your next call name the expected next change before reassessment.`,
    `Treat ${c.barrierAnchor || 'history gaps'} as a clinical threat, not a documentation issue. Missing context can produce the wrong treatment path, so on your next call ask one focused question that could change destination or urgency.`,
    `Build transport around ${c.transportAnchor || c.reassessmentAnchor}. Transport planning prevents late-call deterioration, so on your next call declare one monitor target and one escalation trigger before moving.`,
    `Use protocol deliberately around ${c.protocolActionAnchor || c.treatmentAnchor}. Protocol adherence protects safety only when tied to findings, so on your next call verbalize what supports your step and what would make you stop.`,
    `During handoff, prioritize ${c.handoffAnchor || c.vitalTrendAnchor} over generic summaries. Specific trend communication improves continuity, so on your next call give one-line trajectory language: improved, unchanged, or worsening with evidence.`
  ].map((line) => normalizeSentenceSpacing(line));

  for (const candidate of candidates) {
    if (kept.length >= 5) break;
    const fp = fingerprintCueText(candidate);
    if (!fp || seen.has(fp)) continue;
    seen.add(fp);
    kept.push(candidate);
  }

  scenario.teachersPoints = normalizeTeachersPoints(kept.slice(0, 6));
  return scenario;
}

function buildDeterministicDeepTeachingPoints(scenario) {
  const c = buildCueContext(scenario);
  const presentationHint = cueHintSnippet(c.presentationAnchor || c.chiefComplaint, 'the first clue', 8, 70);
  const vitalTrendHint = cueHintSnippet(c.vitalTrendAnchor || c.vitalAnchor, 'the trend that changed the call', 9, 78);
  const protocolHint = cueHintSnippet(c.protocolActionAnchor || c.treatmentAnchor, 'the next protocol step', 10, 84);
  const historyHint = cueHintSnippet(c.barrierAnchor || c.reassessmentAnchor, 'the missing history piece', 9, 78);
  const pitfallHint = cueHintSnippet(c.pitfallAnchor || c.progressionAnchor, 'the reassurance trap', 10, 86);
  const transportHint = cueHintSnippet(c.transportAnchor || c.handoffAnchor, 'the transport problem', 10, 86);

  const beats = [
    `${presentationHint} looked manageable for a minute, but ${vitalTrendHint} should have changed the tone of the call fast.`,
    `${pitfallHint} is where crews get in trouble because the first reassuring story starts outranking the reassessment.`,
    `${historyHint} should have tightened the differential and made ${protocolHint} a deliberate step instead of busywork.`,
    `On the next call, say the main risk out loud early, tell your partner what change you expect next, and build transport around ${transportHint}.`
  ].map((item) => normalizeSentenceSpacing(item));

  return normalizeTeachersPoints(beats);
}

function teachingPointsLookCaseSpecific(scenario) {
  const paragraph = normalizeTeachersPoints(scenario?.teachersPoints || '');
  if (!paragraph) return false;

  const specificityTokens = [...buildCueSpecificityTokenSet(scenario)].filter((token) => token.length >= 5);
  const lower = paragraph.toLowerCase();
  const tokenHits = specificityTokens.reduce((count, token) => count + (lower.includes(token) ? 1 : 0), 0);
  const concreteSignals = /\b(spo2|etco2|rr|hr|bp|gcs|12-lead|transport|handoff|scene|history|movement|deterioration|trend)\b/i.test(paragraph);
  return tokenHits >= 2 || concreteSignals;
}

function ensureTeachingPointsConcise(scenario) {
  if (!scenario || typeof scenario !== 'object') return scenario;
  const paragraph = normalizeTeachersPoints(scenario?.teachersPoints || '');
  if (!paragraph) return scenario;

  const selected = selectSentencesWithinLimits(splitTeachingPointSentences(paragraph), {
    maxSentences: 5,
    maxWords: 130,
    maxChars: 900
  });

  scenario.teachersPoints = normalizeTeachersPoints(selected.join(' '));
  return scenario;
}

function enforceTeachingPointQuality(scenario) {
  if (!scenario || typeof scenario !== 'object') return scenario;

  const quality = analyzeTeachingPointQuality(scenario);
  if (
    quality.total >= 3 &&
    quality.repetitiveCount === 0 &&
    quality.genericPhraseCount === 0 &&
    teachingPointsLookCaseSpecific(scenario)
  ) {
    return ensureTeachingPointsConcise(scenario);
  }

  scenario.teachersPoints = buildDeterministicDeepTeachingPoints(scenario);
  return ensureTeachingPointsConcise(scenario);
}

function enforceScenarioSectionConciseness(scenario) {
  if (!scenario || typeof scenario !== 'object') return scenario;

  scenario.scenarioIntro = clampParagraphText(scenario.scenarioIntro, { maxSentences: 2, maxWords: 60, maxChars: 360 });
  scenario.scenarioRationale = clampParagraphText(scenario.scenarioRationale, { maxSentences: 2, maxWords: 75, maxChars: 420 });
  scenario.clinicalReasoning = clampParagraphText(scenario.clinicalReasoning, { maxSentences: 5, maxWords: 150, maxChars: 900 });

  scenario.expectedTreatment = (scenario.expectedTreatment || [])
    .map((item) => ensureCueSentenceEnding(normalizeSentenceSpacing(String(item || '').trim())))
    .filter(Boolean)
    .slice(0, 8);

  scenario.protocolNotes = (scenario.protocolNotes || [])
    .map((item) => ensureCueSentenceEnding(normalizeSentenceSpacing(String(item || '').trim())))
    .filter(Boolean)
    .slice(0, 6);

  scenario.learningObjectives = normalizeSimpleList(scenario.learningObjectives, 5);
  scenario.selfReflectionPrompts = normalizeSimpleList(scenario.selfReflectionPrompts, 5);

  return scenario;
}

function scenarioHasTwoSetTrendNarrative(scenario) {
  const firstSet = scenario?.vitalSigns?.firstSet || {};
  const secondSet = scenario?.vitalSigns?.secondSet || {};
  const additionalCount = Array.isArray(scenario?.vitalSigns?.additionalSets)
    ? scenario.vitalSigns.additionalSets.length
    : 0;

  if (additionalCount > 0) return true;

  const firstSpo2 = extractLeadingVitalNumber(firstSet?.spo2);
  const secondSpo2 = extractLeadingVitalNumber(secondSet?.spo2);
  const firstRr = extractLeadingVitalNumber(firstSet?.rr);
  const secondRr = extractLeadingVitalNumber(secondSet?.rr);
  const firstHr = extractLeadingVitalNumber(firstSet?.hr);
  const secondHr = extractLeadingVitalNumber(secondSet?.hr);

  const hasObjectiveTrend =
    (Number.isFinite(firstSpo2) && Number.isFinite(secondSpo2) && Math.abs(secondSpo2 - firstSpo2) >= 2) ||
    (Number.isFinite(firstRr) && Number.isFinite(secondRr) && Math.abs(secondRr - firstRr) >= 2) ||
    (Number.isFinite(firstHr) && Number.isFinite(secondHr) && Math.abs(secondHr - firstHr) >= 6);

  const narrativeText = [
    ...(scenario?.caseProgression?.withProperTreatment || []),
    ...(scenario?.caseProgression?.withoutProperTreatment || []),
    ...(scenario?.caseProgression?.withIncorrectTreatment || []),
    ...(scenario?.expectedTreatment || []),
    ...(scenario?.transportPhase?.reassessmentFocus || []),
    ...(scenario?.transportPhase?.ongoingCare || []),
    scenario?.transportPhase?.handoffConsiderations || ''
  ]
    .map((value) => stripTeachingCueMarkup(String(value || '')).toLowerCase())
    .join(' ');

  const hasTrendLanguage =
    /reassess|serial|trend|response|change|changed|improv|worsen|deteriorat|after movement|during movement|after treatment/.test(narrativeText) &&
    /vital|spo2|rr|hr|bp|work of breathing|speech|perfusion|neurovascular|pain|mental status|air entry/.test(narrativeText);

  return hasObjectiveTrend && hasTrendLanguage;
}

function ensureTwoSetTrendCoverage(scenario) {
  if (!scenario || typeof scenario !== 'object') return scenario;

  const additionalCount = Array.isArray(scenario?.vitalSigns?.additionalSets)
    ? scenario.vitalSigns.additionalSets.length
    : 0;

  if (additionalCount > 0 || scenarioHasTwoSetTrendNarrative(scenario)) {
    return scenario;
  }

  const firstContext = normalizeSentenceSpacing(String(scenario?.vitalSigns?.firstSet?.context || '')).trim();
  const secondContext = normalizeSentenceSpacing(String(scenario?.vitalSigns?.secondSet?.context || '')).trim();
  const trendLine =
    firstContext && secondContext
      ? `Use the first-to-second vital trend (${firstContext} to ${secondContext}) to explain response to treatment or movement during reassessment.`
      : 'Use the first-to-second vital trend to explain response to treatment or movement during reassessment.';

  if (!Array.isArray(scenario.expectedTreatment)) {
    scenario.expectedTreatment = coerceArray(scenario.expectedTreatment);
  }
  if (!Array.isArray(scenario.transportPhase?.reassessmentFocus)) {
    scenario.transportPhase = scenario.transportPhase && typeof scenario.transportPhase === 'object'
      ? scenario.transportPhase
      : {};
    scenario.transportPhase.reassessmentFocus = coerceArray(scenario.transportPhase.reassessmentFocus);
  }

  const existingText = [
    ...(scenario.expectedTreatment || []),
    ...(scenario.transportPhase?.reassessmentFocus || []),
    ...(scenario.caseProgression?.withProperTreatment || []),
    ...(scenario.caseProgression?.withoutProperTreatment || []),
    ...(scenario.caseProgression?.withIncorrectTreatment || [])
  ]
    .map((value) => stripTeachingCueMarkup(String(value || '')).toLowerCase())
    .join(' ');

  if (!existingText.includes('trend')) {
    scenario.expectedTreatment.push(ensureCueSentenceEnding(trendLine));
  }

  if (!existingText.includes('reassess')) {
    scenario.transportPhase.reassessmentFocus.push(
      ensureCueSentenceEnding('Reassess after treatment and after movement, then communicate whether the trend is improving, unchanged, or worsening.')
    );
  }

  scenario.expectedTreatment = normalizeSimpleList(scenario.expectedTreatment, 8);
  scenario.transportPhase.reassessmentFocus = normalizeSimpleList(scenario.transportPhase.reassessmentFocus, 5);

  return scenario;
}

function ensureDeterministicMinimumCueCoverage(scenario, includeTeachingCues) {
  if (!includeTeachingCues || !scenario || typeof scenario !== 'object') return scenario;

  const metrics = collectTeachingCueMetrics(scenario);
  if (metrics.cueCount >= 6 && metrics.sectionsWithCues.length >= 4) return scenario;

  const c = buildCueContext(scenario);
  const injectors = [
    () => {
      scenario.callInformation = scenario.callInformation || {};
      scenario.callInformation.crewNotes = appendCueToString(
        scenario?.callInformation?.crewNotes,
        `Start with ${c.sceneAnchor || 'scene clues'} and state the immediate risk before action.`,
        'arrival'
      );
    },
    () => {
      scenario.patientPresentation = appendCueToString(
        scenario?.patientPresentation,
        `Use ${c.presentationAnchor || c.chiefComplaint} to frame urgency and name one reassessment trigger.`,
        'assessment'
      );
    },
    () => {
      scenario.initialAssessment = scenario.initialAssessment || {};
      scenario.initialAssessment.generalImpression = appendCueToString(
        scenario?.initialAssessment?.generalImpression,
        'Before treatment, state what could deteriorate first and why.',
        'assessment'
      );
    },
    () => {
      if (!Array.isArray(scenario.protocolNotes)) scenario.protocolNotes = [];
      scenario.protocolNotes.push(createCue('Link the next protocol step to one concrete finding and one stop condition.', 'protocol'));
    },
    () => {
      scenario.clinicalReasoning = appendCueToString(
        scenario?.clinicalReasoning,
        'Give your working diagnosis, then name one finding that could disconfirm it.',
        'reasoning'
      );
    },
    () => {
      scenario.transportPhase = scenario.transportPhase || {};
      if (!Array.isArray(scenario.transportPhase.reassessmentFocus)) {
        scenario.transportPhase.reassessmentFocus = [];
      }
      scenario.transportPhase.reassessmentFocus.push(
        createCue('During transport, protect one monitor target and state the escalation trigger.', 'transport')
      );
    }
  ];

  for (const inject of injectors) {
    const current = collectTeachingCueMetrics(scenario);
    if (current.cueCount >= 6 && current.sectionsWithCues.length >= 4) break;
    inject();
  }

  return scenario;
}

function enforceScenarioControls(scenario, controls) {
  if (!scenario || typeof scenario !== 'object') return scenario;

  const requestedSemester = String(controls?.semester || '3');
  const requestedComplexity = String(controls?.complexity || 'Moderate');
  const requestedCallType = normalizeCallFamily(controls?.callType || 'Medical');
  const requestedEnvironment = normalizeEnvironmentTag(controls?.environment || '');
  const requestedShiftMode = normalizeShiftMode(controls?.shiftMode) || 'Day Shift';

  if (!scenario.callInformation || typeof scenario.callInformation !== 'object') {
    scenario.callInformation = {};
  }
  scenario.callInformation.type = requestedCallType;
  scenario.callInformation.shift = requestedShiftMode;
  scenario.callInformation.time = alignTimeToShiftMode(
    scenario?.callInformation?.time,
    requestedShiftMode,
    `${scenario?.title || ''}|${scenario?.callInformation?.location || ''}`
  );
  if (requestedEnvironment) {
    scenario.callInformation.environment = requestedEnvironment;
  }

  if (requestedSemester === '2') {
    // For Sem2: strip all med language from treatment/learning; strip only interventions from context
    scenario.expectedTreatment = stripMedicationItems(scenario.expectedTreatment, 'broad');
    scenario.protocolNotes = stripMedicationItems(scenario.protocolNotes, 'interventionOnly');
    scenario.learningObjectives = stripMedicationItems(scenario.learningObjectives, 'broad');
    scenario.teachersPoints = normalizeTeachersPoints(stripMedicationItems(scenario.teachersPoints, 'broad'));
    if (scenario?.caseProgression && typeof scenario.caseProgression === 'object') {
      scenario.caseProgression.withProperTreatment = stripMedicationItems(scenario.caseProgression.withProperTreatment, 'interventionOnly');
      scenario.caseProgression.withoutProperTreatment = stripMedicationItems(scenario.caseProgression.withoutProperTreatment, 'interventionOnly');
      scenario.caseProgression.withIncorrectTreatment = stripMedicationItems(scenario.caseProgression.withIncorrectTreatment, 'interventionOnly');
    }

    if (scenario?.grsAnchors && typeof scenario.grsAnchors === 'object') {
      Object.keys(scenario.grsAnchors).forEach((domain) => {
        [3, 5, 7].forEach((score) => {
          if (Array.isArray(scenario.grsAnchors?.[domain]?.[score])) {
            scenario.grsAnchors[domain][score] = stripMedicationItems(scenario.grsAnchors[domain][score], 'interventionOnly');
          }
        });
      });
    }

    if (!scenario.expectedTreatment.length) {
      scenario.expectedTreatment = [
        'Perform a focused primary and secondary assessment with supportive care, then reassess trends before and during transport.',
        'Prioritize safe transport, communication, and repeated vital sign checks to detect change early.'
      ];
    }

    if (scenario?.sceneArrival && typeof scenario.sceneArrival === 'object') {
      scenario.sceneArrival.hazards = normalizeSimpleList(scenario.sceneArrival.hazards, 1);
      if (scenario.sceneArrival.accessIssues) {
        scenario.sceneArrival.accessIssues = '';
      }
    }

    if (scenario?.historyGathering && typeof scenario.historyGathering === 'object') {
      scenario.historyGathering.contradictionsOrBarriers =
        normalizeSimpleList(scenario.historyGathering.contradictionsOrBarriers, 1);
    }

    if (scenario?.transportPhase && typeof scenario.transportPhase === 'object') {
      scenario.transportPhase.transportConsiderations =
        normalizeSimpleList(scenario.transportPhase.transportConsiderations, 1);
    }

    if (scenario?.vitalSigns && typeof scenario.vitalSigns === 'object') {
      scenario.vitalSigns.firstSet = clampSemesterTwoVitals(scenario.vitalSigns.firstSet);
      scenario.vitalSigns.secondSet = clampSemesterTwoVitals(scenario.vitalSigns.secondSet);
      scenario.vitalSigns.additionalSets = [];
    }
  }

  if (requestedComplexity === 'Simple') {
    if (scenario?.sceneArrival && typeof scenario.sceneArrival === 'object') {
      scenario.sceneArrival.hazards = (scenario.sceneArrival.hazards || []).slice(0, 1);
    }

    if (scenario?.historyGathering && typeof scenario.historyGathering === 'object') {
      scenario.historyGathering.contradictionsOrBarriers =
        (scenario.historyGathering.contradictionsOrBarriers || []).slice(0, 1);
    }

    if (scenario?.transportPhase && typeof scenario.transportPhase === 'object') {
      scenario.transportPhase.transportConsiderations =
        (scenario.transportPhase.transportConsiderations || []).slice(0, 1);
    }

    if (scenario?.vitalSigns && typeof scenario.vitalSigns === 'object') {
      scenario.vitalSigns.additionalSets = (scenario.vitalSigns.additionalSets || []).slice(0, 0);
    }
  }

  if (requestedComplexity === 'Moderate') {
    if (scenario?.sceneArrival && typeof scenario.sceneArrival === 'object') {
      scenario.sceneArrival.hazards = normalizeSimpleList(scenario.sceneArrival.hazards, 1);
      if (scenario.sceneArrival.accessIssues) {
        scenario.sceneArrival.accessIssues = '';
      }
    }

    if (scenario?.historyGathering && typeof scenario.historyGathering === 'object') {
      scenario.historyGathering.contradictionsOrBarriers =
        normalizeSimpleList(scenario.historyGathering.contradictionsOrBarriers, 1);
    }

    if (scenario?.transportPhase && typeof scenario.transportPhase === 'object') {
      scenario.transportPhase.transportConsiderations =
        normalizeSimpleList(scenario.transportPhase.transportConsiderations, 1);
    }

    if (scenario?.vitalSigns && typeof scenario.vitalSigns === 'object') {
      scenario.vitalSigns.additionalSets = (scenario.vitalSigns.additionalSets || []).slice(0, 0);
    }
  }

  return scenario;
}

function detectControlDrift(scenario, controls) {
  const issues = [];
  const requestedSemester = String(controls?.semester || '3');
  const requestedComplexity = String(controls?.complexity || 'Moderate');
  const requestedCallType = normalizeCallFamily(controls?.callType || 'Medical');
  const includeTeachingCues = Boolean(controls?.includeTeachingCues);
  const requestedEnvironment = normalizeEnvironmentTag(controls?.environment || '');
  const requestedShiftMode = normalizeShiftMode(controls?.shiftMode) || 'Day Shift';
  const customPrompt = sanitizeCustomPrompt(controls?.customPrompt || '');
  const complexityAssessment = estimateScenarioComplexity(scenario);
  const medicationMentions = countMedicationMentionsInScenario(scenario);
  const totalVitalSets = 2 + (scenario?.vitalSigns?.additionalSets || []).length;
  const text = collectScenarioNarrativeText(scenario);
  const cueMetrics = collectTeachingCueMetrics(scenario);
  const teachingPointQuality = analyzeTeachingPointQuality(scenario);
  const qualityProfile = computeScenarioQualityProfile(scenario);
  const unsupportedDoseCueCount = countUnsupportedDoseCueReferences(scenario);
  const spacingIssuePaths = collectSentenceSpacingIssues(scenario);
  const inferredCallType = normalizeCallFamily(
    scenario?.callInformation?.type || `${scenario?.title || ''} ${scenario?.clinicalReasoning || ''}`
  );
  const explicitEnvironment = normalizeEnvironmentTag(scenario?.callInformation?.environment || '');
  const inferredShiftMode = inferScenarioShiftMode(scenario);
  const inferredEnvironment = explicitEnvironment || normalizeEnvironmentTag(
    [
      scenario?.callInformation?.location || '',
      scenario?.sceneArrival?.sceneDescription || '',
      ...(scenario?.sceneArrival?.environmentDetails || [])
    ].join(' ')
  );

  if (requestedCallType !== inferredCallType) {
    issues.push({
      severity: 'high',
      code: 'call-type-drift',
      message: `Scenario reads as ${inferredCallType} instead of requested ${requestedCallType}.`
    });
  }

  if (requestedEnvironment && inferredEnvironment && requestedEnvironment !== inferredEnvironment) {
    issues.push({
      severity: 'medium',
      code: 'environment-drift',
      message: `Scenario reads as ${inferredEnvironment} instead of requested ${requestedEnvironment}.`
    });
  }

  if (requestedShiftMode && inferredShiftMode && requestedShiftMode !== inferredShiftMode) {
    issues.push({
      severity: 'medium',
      code: 'shift-drift',
      message: `Scenario reads as ${inferredShiftMode} instead of requested ${requestedShiftMode}.`
    });
  }

  if (requestedSemester === '2') {
    if (medicationMentions > 0) {
      issues.push({
        severity: 'high',
        code: 'semester-2-medications',
        message: 'Semester 2 scenario includes medication-dependent expected learner actions.'
      });
    }

    if (complexityAssessment.estimated !== 'Simple') {
      const isClearlyTooComplex =
        complexityAssessment.estimated === 'Complex' ||
        complexityAssessment.burdenScore >= 8 ||
        totalVitalSets > 2;

      issues.push({
        severity: isClearlyTooComplex ? 'high' : 'medium',
        code: 'semester-2-too-complex',
        message: `Semester 2 scenario feels ${complexityAssessment.estimated.toLowerCase()} instead of straightforward/simple.`
      });
    }

    if (totalVitalSets > 2) {
      issues.push({
        severity: 'medium',
        code: 'semester-2-too-many-vitals',
        message: 'Semester 2 scenario uses more than two vital sign sets.'
      });
    }
  }

  if (requestedSemester === '4') {
    const advancedReasoningScore = countKeywordMatches(text, WITHHOLDING_KEYWORDS);
    if (complexityAssessment.estimated === 'Simple' || totalVitalSets < 3 || advancedReasoningScore === 0) {
      issues.push({
        severity: 'medium',
        code: 'semester-4-not-layered-enough',
        message: 'Semester 4 scenario lacks enough layered reassessment, withholding logic, or operational burden.'
      });
    }
  }

  if (requestedComplexity !== complexityAssessment.estimated) {
    issues.push({
      severity: complexityDistance(requestedComplexity, complexityAssessment.estimated) > 1 ? 'high' : 'medium',
      code: 'complexity-drift',
      message: `Scenario feels ${complexityAssessment.estimated.toLowerCase()} instead of requested ${requestedComplexity.toLowerCase()}.`
    });
  }

  if (totalVitalSets === 2 && !scenarioHasTwoSetTrendNarrative(scenario)) {
    issues.push({
      severity: 'medium',
      code: 'two-set-vitals-trend-thin',
      message: 'Scenario uses only two vital sets but does not clearly document reassessment trend impact in progression, treatment, or transport sections.'
    });
  }

  if (!Array.isArray(scenario?.directiveSources) || !scenario.directiveSources.length) {
    issues.push({
      severity: 'medium',
      code: 'directive-sources-missing',
      message: 'Directive sources are missing.'
    });
  }

  if (customPrompt && !scenarioReflectsCustomPrompt(scenario, customPrompt)) {
    issues.push({
      severity: 'medium',
      code: 'custom-prompt-not-reflected',
      message: 'The generated scenario does not clearly reflect the instructor prompt focus.'
    });
  }

  if (spacingIssuePaths.length) {
    issues.push({
      severity: spacingIssuePaths.length > 8 ? 'high' : 'medium',
      code: 'sentence-spacing-inconsistent',
      message: `Sentence spacing is inconsistent in ${spacingIssuePaths.length} field(s). Ensure a space follows punctuation between sentences.`
    });
  }

  if (qualityProfile.missingCoreFields.length >= 4) {
    issues.push({
      severity: 'medium',
      code: 'core-sections-sparse',
      message: `Core scenario narrative fields are underdeveloped (${qualityProfile.missingCoreFields.length} missing/weak fields). Strengthen scene, impression, assessment, progression, and rationale continuity.`
    });
  }

  if (
    qualityProfile.progressionBranchCounts.withProperTreatment < 2 ||
    qualityProfile.progressionBranchCounts.withoutProperTreatment < 2 ||
    qualityProfile.progressionBranchCounts.withIncorrectTreatment < 2 ||
    qualityProfile.totalProgressionSteps < 6
  ) {
    issues.push({
      severity: 'medium',
      code: 'progression-underdeveloped',
      message: 'Case progression is underdeveloped. Each branch should contain concrete 2-3 step patient changes tied to decisions and reassessment.'
    });
  }

  if (qualityProfile.transportPlanDepth < 4) {
    issues.push({
      severity: 'medium',
      code: 'transport-phase-thin',
      message: 'Transport phase lacks depth. Add transport considerations, ongoing care priorities, reassessment focus, and handoff-critical detail.'
    });
  }

  if (qualityProfile.score < 70) {
    issues.push({
      severity: 'medium',
      code: 'overall-quality-below-target',
      message: `Overall scenario quality score is ${qualityProfile.score}/100 (${qualityProfile.tier}). Improve continuity, progression detail, and section completeness.`
    });
  }

  if (teachingPointQuality.total < 4) {
    issues.push({
      severity: 'high',
      code: 'teaching-points-too-few',
      message: `Instructor debrief is underdeveloped (${teachingPointQuality.total} teaching beat${teachingPointQuality.total === 1 ? '' : 's'}). Provide one case-specific paragraph with 4-6 strong teaching beats.`
    });
  }

  if (teachingPointQuality.repetitiveCount > 0) {
    issues.push({
      severity: teachingPointQuality.repetitiveCount >= 2 ? 'high' : 'medium',
      code: 'teaching-points-repetitive',
      message: `Instructor debrief is repetitive (${teachingPointQuality.repetitiveCount} overlap signal${teachingPointQuality.repetitiveCount === 1 ? '' : 's'}). Vary the teaching beats instead of repeating the same coaching idea.`
    });
  }

  if (teachingPointQuality.runOnCount > 0) {
    issues.push({
      severity: 'medium',
      code: 'teaching-points-run-on',
      message: `Instructor debrief has ${teachingPointQuality.runOnCount} overlong teaching beat${teachingPointQuality.runOnCount === 1 ? '' : 's'}. Keep the paragraph conversational but tight.`
    });
  }

  if (teachingPointQuality.surfaceLevelCount > 0) {
    issues.push({
      severity: 'medium',
      code: 'teaching-points-surface-level',
      message: `Instructor debrief is surface-level in ${teachingPointQuality.surfaceLevelCount} teaching beat${teachingPointQuality.surfaceLevelCount === 1 ? '' : 's'}. Add concrete case detail, clinical rationale, and a specific next-call action.`
    });
  }

  if (teachingPointQuality.genericPhraseCount > 0) {
    issues.push({
      severity: 'medium',
      code: 'teaching-points-generic-language',
      message: `Instructor debrief uses generic boilerplate phrasing (${teachingPointQuality.genericPhraseCount} signal${teachingPointQuality.genericPhraseCount === 1 ? '' : 's'}). Replace it with case-anchored coaching.`
    });
  }

  if (includeTeachingCues) {
    if (cueMetrics.cueCount < 6) {
      issues.push({
        severity: cueMetrics.cueCount === 0 ? 'high' : 'medium',
        code: 'teaching-cues-too-few',
        message: `Teaching cues are too sparse (${cueMetrics.cueCount} total). Add richer cues across the scenario.`
      });
    }

    if (cueMetrics.sectionsWithCues.length < 4) {
      issues.push({
        severity: 'medium',
        code: 'teaching-cues-too-narrow',
        message: `Teaching cues appear in too few sections (${cueMetrics.sectionsWithCues.length}). Spread cues across more high-value sections.`
      });
    }

    if (cueMetrics.duplicateCueCount > 1) {
      issues.push({
        severity: 'medium',
        code: 'teaching-cues-repetitive',
        message: `Teaching cues repeat too much (${cueMetrics.duplicateCueCount} duplicate cues). Vary cue intent by decision point.`
      });
    }

    if (cueMetrics.genericCueCount > 1) {
      issues.push({
        severity: 'medium',
        code: 'teaching-cues-too-generic',
        message: `Teaching cues include generic phrasing signals (${cueMetrics.genericCueCount}). Anchor cues to concrete case details.`
      });
    }

    if (cueMetrics.weakVoiceCueCount > Math.max(1, Math.floor(cueMetrics.cueCount * 0.35))) {
      issues.push({
        severity: 'medium',
        code: 'teaching-cues-voice-weak',
        message: `Teaching cues are not consistently in direct preceptor voice (${cueMetrics.weakVoiceCueCount}/${cueMetrics.cueCount}). Use explicit learner-directed coaching language.`
      });
    }

    if (unsupportedDoseCueCount > 0) {
      issues.push({
        severity: 'medium',
        code: 'teaching-cues-unsupported-dose',
        message: `Teaching cues include ${unsupportedDoseCueCount} unsupported medication dose reference(s). Keep dose coaching only when exact dose text appears in treatment/protocol content.`
      });
    }
  }

  return {
    issues,
    metrics: {
      estimatedComplexity: complexityAssessment.estimated,
      burdenScore: complexityAssessment.burdenScore,
      totalVitalSets,
      medicationMentions,
      inferredCallType,
      cueCount: cueMetrics.cueCount,
      sectionsWithCues: cueMetrics.sectionsWithCues,
      weakVoiceCueCount: cueMetrics.weakVoiceCueCount,
      unsupportedDoseCueCount,
      teachingPointCount: teachingPointQuality.total,
      teachingPointRunOnCount: teachingPointQuality.runOnCount,
      teachingPointSurfaceLevelCount: teachingPointQuality.surfaceLevelCount,
      teachingPointRepetitiveCount: teachingPointQuality.repetitiveCount,
      teachingPointGenericPhraseCount: teachingPointQuality.genericPhraseCount,
      qualityScore: qualityProfile.score,
      qualityTier: qualityProfile.tier,
      missingCoreFieldCount: qualityProfile.missingCoreFields.length,
      progressionStepCount: qualityProfile.totalProgressionSteps,
      transportPlanDepth: qualityProfile.transportPlanDepth,
      spacingIssueCount: spacingIssuePaths.length,
      spacingIssuePaths
    }
  };
}

function shouldRunModelRepair(validation) {
  const issues = Array.isArray(validation?.issues) ? validation.issues : [];
  if (!issues.length) return false;

  if (issues.some((issue) => issue?.severity === 'high')) {
    return true;
  }

  return issues.some(
    (issue) => issue?.severity === 'medium' && MEDIUM_REPAIR_TRIGGER_CODES.has(issue?.code)
  );
}

function splitTeachingPointSentences(text) {
  return normalizeSentenceSpacing(String(text || ''))
    .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function trimDanglingTeachingWords(value) {
  let trimmed = normalizeSentenceSpacing(String(value || ''))
    .replace(/[,:;\-]+\s*$/g, '')
    .trim();

  const danglingPattern = /\b(?:and|or|but|so|because|with|without|to|of|for|per|via|the|a|an|your|their|this|that)\.?$/i;
  while (danglingPattern.test(trimmed)) {
    trimmed = trimmed.replace(danglingPattern, '').trim();
  }

  return trimmed;
}

function clampTeachingPointSentence(sentence, { maxWords = 22, maxChars = 150 } = {}) {
  const normalized = normalizeSentenceSpacing(String(sentence || ''))
    .replace(/[,:;]\s*$/, '')
    .trim();

  if (!normalized) return '';

  const words = normalized.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords && normalized.length <= maxChars) {
    return ensureCueSentenceEnding(normalized);
  }

  const lower = normalized.toLowerCase();
  const clauseBreakers = [', so ', ', but ', ', and ', ' because ', ' which ', ' while ', '; ', ': '];
  let bestSegment = '';

  clauseBreakers.forEach((breaker) => {
    const index = lower.indexOf(breaker.trim().toLowerCase());
    if (index > 0 && index <= maxChars && index > bestSegment.length) {
      bestSegment = normalized.slice(0, index);
    }
  });

  const candidate = bestSegment || words.slice(0, maxWords).join(' ');
  const cleanedCandidate = trimDanglingTeachingWords(trimToWordBoundary(candidate, maxChars));
  return ensureCueSentenceEnding(cleanedCandidate || normalized);
}

function analyzeTeachingPointQuality(scenario) {
  const points = teachingPointBeats(scenario?.teachersPoints)
    .map((point) => normalizeSentenceSpacing(String(point || '').trim()))
    .filter(Boolean);

  let runOnCount = 0;
  let surfaceLevelCount = 0;
  let genericPhraseCount = 0;
  let repetitiveCount = 0;

  const normalizedPoints = points.map((point) => {
    const sentences = splitTeachingPointSentences(point);
    const words = point.toLowerCase().split(/\s+/).filter(Boolean);
    const longSentenceCount = sentences.filter((sentence) => sentence.split(/\s+/).filter(Boolean).length > 24).length;

    if (sentences.length > 3 || words.length > 80 || longSentenceCount > 0) {
      runOnCount += 1;
    }

    const hasCaseAnchor = /\b(spo2|etco2|rr|hr|bp|gcs|ecg|12-lead|right-sided|contraindication|deteriorat|trend|reassess|transport|handoff|scene|history|assessment|protocol|als pcs|bls pcs)\b/i.test(point) || /\b\d+(?:\.\d+)?\b/.test(point);
    const hasRationale = /\b(because|therefore|due to|risk|pathophysiolog|consequence|if\s+you\s+miss|if\s+missed|delayed|worsen|bias|trap|anchor)\b/i.test(point);
    const hasAction = /\b(next call|next time|on your next call|state|name|assign|reassess|repeat|trend|confirm|check|prioritize|escalate|withhold|document|declare|verbalize)\b/i.test(point);

    if (!(hasCaseAnchor && hasRationale && hasAction)) {
      surfaceLevelCount += 1;
    }

    const lower = point.toLowerCase();
    if (TEACHING_POINT_GENERIC_PHRASES.some((phrase) => lower.includes(phrase))) {
      genericPhraseCount += 1;
    }

    return point;
  });

  for (let i = 0; i < normalizedPoints.length; i += 1) {
    for (let j = i + 1; j < normalizedPoints.length; j += 1) {
      if (cuesAreTooSimilar(normalizedPoints[i], normalizedPoints[j])) {
        repetitiveCount += 1;
        break;
      }
    }
  }

  return {
    total: points.length,
    runOnCount,
    surfaceLevelCount,
    genericPhraseCount,
    repetitiveCount
  };
}

async function requestScenarioJson(messages) {
  const retries = Number.isFinite(OPENAI_MAX_RETRIES) && OPENAI_MAX_RETRIES >= 0
    ? OPENAI_MAX_RETRIES
    : 1;

  const isRetryableError = (error) => {
    const status = error?.status || error?.cause?.status || error?.response?.status;
    if (!status) return true;
    return status === 408 || status === 409 || status === 429 || status >= 500;
  };

  const wait = (delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs));

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const completion = await Promise.race([
        openai.chat.completions.create({
          model: OPENAI_MODEL,
          messages,
          temperature: 0.35
        }),
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error(`OpenAI request timed out after ${OPENAI_TIMEOUT_MS}ms`)), OPENAI_TIMEOUT_MS);
        })
      ]);

      const rawOutput = completion.choices[0].message.content;
      const cleaned = sanitizeOutput(rawOutput);

      try {
        return JSON.parse(cleaned);
      } catch {
        const repaired = jsonrepair(cleaned);
        return JSON.parse(repaired);
      }
    } catch (error) {
      if (attempt === retries || !isRetryableError(error)) {
        throw error;
      }

      await wait(300 * (attempt + 1));
    }
  }

  throw new Error('OpenAI request failed after retries.');
}

async function repairScenarioForControlDrift({ systemPrompt, scenario, controls, validation }) {
  const qualityProfile = computeScenarioQualityProfile(scenario);
  const repairPrompt = `
You are repairing an already-generated paramedic scenario so it strictly matches the requested controls.

Return valid JSON only.
Do not change the canonical schema.
Do not add commentary.

Requested controls:
- Semester: ${controls.semester}
- Call Type: ${controls.callType}
- Environment: ${controls.environment}
- Complexity: ${controls.complexity}
- Shift Mode: ${controls.shiftMode}
- Include teaching cues: ${controls.includeTeachingCues}
- Instructor prompt: ${sanitizeCustomPrompt(controls.customPrompt || '') || 'None provided'}

Problems to fix:
${validation.issues.map((issue) => `- ${issue.message}`).join('\n')}

Current quality profile:
- Quality score: ${qualityProfile.score}/100 (${qualityProfile.tier})
- Missing/weak core fields: ${qualityProfile.missingCoreFields.length ? qualityProfile.missingCoreFields.join(', ') : 'none'}
- Progression branch counts: proper ${qualityProfile.progressionBranchCounts.withProperTreatment}, without proper ${qualityProfile.progressionBranchCounts.withoutProperTreatment}, incorrect ${qualityProfile.progressionBranchCounts.withIncorrectTreatment}
- Transport plan depth: ${qualityProfile.transportPlanDepth}
- Expected treatment items: ${qualityProfile.expectedTreatmentCount}
- Protocol note items: ${qualityProfile.protocolNoteCount}
- Clinical reasoning word count: ${qualityProfile.clinicalReasoningWordCount}

Repair priorities:
- Keep the strongest existing content and structure where possible.
- Revise the scenario so semester expectations are concrete, not implied.
- Revise scene burden, ambiguity, reassessment burden, and treatment expectations so complexity clearly matches the request.
- Make time-of-day context obvious when shift mode matters: dispatch timing, scene lighting, access, bystander state, and operational tempo should match the requested shift.
- Keep teachersPoints as one instructor-style paragraph with a few distinct teaching beats, direct coaching voice, concrete case anchors, clinical rationale, and clear next-call improvement advice. Let it read naturally instead of like a fixed template.
- Preserve Ontario directive references and keep directiveSources populated.
- If teaching cues are enabled, increase cue density and section coverage while keeping cues clinically useful.
- Close narrative gaps in any missing core fields so the call reads as one coherent timeline from dispatch through handoff.
- Strengthen caseProgression with concrete physiologic or behavioral changes in all three branches (proper, delayed/absent, incorrect care).
- Expand transportPhase to include practical movement constraints, monitoring priorities, and a useful handoff focus.
- Fix sentence spacing consistency across all fields so there is a space after punctuation between sentences.
- If an instructor prompt is provided, preserve schema and directives while clearly reflecting that requested focus.

Current scenario JSON:
${JSON.stringify(scenario, null, 2)}
`.trim();

  return requestScenarioJson([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: repairPrompt }
  ]);
}

router.post('/', async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: 'Server configuration error: missing OpenAI API key.' });
    }

    const requestValidation = validateGenerationRequest(req.body || {});
    if (!requestValidation.isValid) {
      return res.status(400).json({
        error: 'Invalid scenario request payload.',
        details: requestValidation.errors.join(' ')
      });
    }

    const {
      semester,
      callType: finalCallType,
      environment,
      complexity,
      shiftMode,
      includeTeachingCues,
      customPrompt: normalizedCustomPrompt
    } = requestValidation.value;
    const explicitVariationSeed = Number(req?.body?.variationSeed);
    const generationVariationSeed = Number.isFinite(explicitVariationSeed)
      ? Math.trunc(explicitVariationSeed)
      : Math.trunc(Date.now() + Math.random() * 1000000);

    devLog('PARSED CONTROL DEBUG:', {
      routeBuildTag: ROUTE_BUILD_TAG,
      semester,
      finalCallType,
      environment,
      complexity,
      shiftMode,
      includeTeachingCues,
      hasCustomPrompt: Boolean(normalizedCustomPrompt),
      generationVariationSeed
    });

    const semesterProfile = buildSemesterDifficultyProfile(semester);
    const subtypeData = selectSubtype(finalCallType);
    devLog('SUBTYPE DEBUG:', subtypeData);

    const environmentProfile = buildEnvironmentProfile(environment);
  const shiftProfile = buildShiftProfile(shiftMode, environment);
    const complicationData = buildComplications(subtypeData.subtype);
    const medicationPlan = buildMedicationPlan(subtypeData.subtype, semester);
    const scenarioCore = buildScenarioCore({
      subtypeData,
      environmentProfile,
      complexity,
      medicationPlan,
      semesterProfile
    });

    const [
      instructorProfile,
      fewShots,
      scenarioModifiers,
      alsStandardsText,
      blsStandardsText
    ] = await Promise.all([
      loadInstructorProfile(),
      loadFewShots(),
      loadScenarioModifiers(),
      loadAlsStandards(),
      loadBlsStandards()
    ]);
    const fewShotSelection = buildFewShotBlock(fewShots, {
      callType: finalCallType,
      semester,
      complexity,
      environment,
      subtype: subtypeData.subtype
    });
    const directiveAddendum = buildDirectivePromptAddendum({
      type: finalCallType,
      semester,
      customPrompt: normalizedCustomPrompt,
      title: subtypeData.subtype
    });
    const directiveMetaAddendum = buildDirectiveMetaAddendum();
    const standardsAddendum = buildStandardsPromptAddendum({
      callType: finalCallType,
      semester,
      complexity,
      alsText: alsStandardsText,
      blsText: blsStandardsText
    });
    const hookAddendum = buildScenarioHookAddendum(finalCallType, generationVariationSeed);
    const modifierAddendum = buildScenarioModifierAddendum(scenarioModifiers, {
      callType: finalCallType,
      environment,
      complexity,
      variationSeed: generationVariationSeed
    });

    const systemPrompt = instructorProfile.trim();

const userPrompt = `
Generate exactly one paramedic training scenario as valid JSON only.

Return only valid JSON.
Do not return markdown.
Do not return code fences.
Do not return commentary outside the JSON object.

REFERENCE FEW-SHOT EXAMPLES
Use these examples to match structure, richness, tone, teaching depth, case progression quality, and GRS specificity.
Do not copy them directly.
The few-shot examples define the canonical schema.
Use the same top-level field set, nesting style, and general section shapes as the examples.
Variety should come from clinical content, environment, progression, and teaching nuance, not from changing the JSON structure.

FEW-SHOT MATCH SUMMARY
${fewShotSelection.summary.join('\n')}

${fewShotSelection.block}

SHIFT CONTEXT
${shiftProfile.instructionText}

ONTARIO DIRECTIVE ADDENDUM
${Array.isArray(directiveAddendum) ? directiveAddendum.join('\n') : String(directiveAddendum || '')}
${directiveMetaAddendum.length ? `\nONTARIO DIRECTIVE GOVERNANCE\n${directiveMetaAddendum.join('\n')}` : ''}
${standardsAddendum.length ? `\nONTARIO STANDARDS SNIPPETS\n${standardsAddendum.join('\n')}` : ''}
${hookAddendum.length ? `\nCLINICAL HOOK GUIDANCE\n${hookAddendum.join('\n')}` : ''}
${modifierAddendum.length ? `\nSCENARIO VARIETY MODIFIERS\n${modifierAddendum.join('\n')}` : ''}

In expectedTreatment and protocolNotes, explicitly reference Ontario BLS and ALS principles (oxygen targets, cardiac ischemia workflow, stroke, trauma, etc.) when relevant.
Note when a recommendation is standard BLS or ALS from Ontario directives.
Use explicit phrasing like:
- "O2 titrate 92–96% (COPD 88–92%)"
- "12-lead before nitro in suspected ischemia"
- "Right-sided ECG if inferior STEMI"
- "Assess neurovascular status per ALS PCS"
- "Pain management per BLS/ALS protocols"
- "Consider analgesia if no contraindications per ALS PCS"
protocolNotes must reference Ontario directives in at least 50% of items.

Return these top-level fields:
- scenarioIntro
- title
- callInformation
- patientDemographics
- patientPresentation
- incidentNarrative
- sceneArrival
- firstImpression
- initialAssessment
- historyGathering
- opqrst
- sample
- medications
- allergies
- pastMedicalHistory
- physicalExam
- secondaryAssessment
- additionalAssessments
- vitalSigns
- caseProgression
- transportPhase
- expectedTreatment
- protocolNotes
- learningObjectives
- selfReflectionPrompts
- grsAnchors
- teachersPoints
- scenarioRationale
- clinicalReasoning
- directiveSources

Required object structure:
- callInformation must contain:
{
  "type": "",
  "location": "",
  "time": "",
  "shift": "",
  "dispatchCode": "",
  "dispatchNotes": [],
  "hazardsOrFlags": [],
  "crewNotes": ""
}

- patientDemographics must contain:
{
  "name": "",
  "sex": "",
  "age": "",
  "height": "",
  "weight": "",
  "appearance": "",
  "chiefComplaint": ""
}

- sceneArrival must contain:
{
  "sceneDescription": "",
  "environmentDetails": [],
  "hazards": [],
  "accessIssues": "",
  "bystandersPresent": "",
  "sceneEnergy": ""
}

- firstImpression must contain:
{
  "generalAppearance": "",
  "levelOfDistress": "",
  "apparentSeverity": "",
  "positionFound": "",
  "visibleClues": [],
  "initialRedFlags": []
}

- initialAssessment must contain:
{
  "airway": "",
  "breathing": "",
  "circulation": "",
  "disability": "",
  "exposure": "",
  "generalImpression": "",
  "immediatePriorities": [],
  "immediateInterventions": []
}

- historyGathering must contain:
{
  "historySource": "",
  "additionalHistory": [],
  "bystanderInformation": [],
  "contradictionsOrBarriers": [],
  "sceneContextClues": []
}

- opqrst must contain:
{
  "onset": "",
  "provocation": "",
  "quality": "",
  "radiation": "",
  "severity": "",
  "time": ""
}

- sample must contain:
{
  "signsAndSymptoms": "",
  "allergies": "",
  "medications": [],
  "pastMedicalHistory": "",
  "lastOralIntake": "",
  "eventsLeadingUp": ""
}

- physicalExam must contain:
{
  "generalAppearance": "",
  "airway": "",
  "breathing": "",
  "circulation": "",
  "neuro": "",
  "headNeck": "",
  "chest": "",
  "abdomen": "",
  "pelvis": "",
  "extremities": "",
  "skin": ""
}

- secondaryAssessment must contain:
{
  "generalAppearance": "",
  "breathing": "",
  "circulation": "",
  "keyFindings": [],
  "missedIfNotAssessed": [],
  "evolvingFindings": []
}

Secondary assessment rules:
- Keep this focused on what changed, clarified, or became more important after initial treatment or reassessment.
- Do not repeat the full physical exam unless a finding materially changed.

- additionalAssessments must be an array.
- It may be empty, but it must always be present.
- Use it for extra focused reassessment findings only when clinically appropriate.
- Do not force extra assessments into every call.

- vitalSigns must contain:
{
  "firstSet": { "hr": "", "rr": "", "bp": "", "spo2": "", "etco2": "", "temp": "", "gcs": "", "bgl": "", "ecgInterpretation": "" },
  "secondSet": { "hr": "", "rr": "", "bp": "", "spo2": "", "etco2": "", "temp": "", "gcs": "", "bgl": "", "ecgInterpretation": "" },
  "additionalSets": []
}

Vital signs rules:
- Every scenario must contain at least firstSet and secondSet.
- hr must be one string that combines rate, rhythm, and volume in that order, for example "118, regular, strong".
- rr must be one string that combines rate, rhythm, and volume in that order, for example "28, regular, full".
- Some scenarios should contain one or more additionalSets when clinically appropriate.
- Two vital sets are acceptable when the scenario clearly documents trend-based reassessment elsewhere (caseProgression, expectedTreatment, and transport reassessment focus).
- Use additionalSets for evolving calls, treatment response, deterioration, movement-related change, longer transport, or meaningful reassessment changes.
- Do not force additionalSets into every case.
- Vitals must trend realistically according to the scenario and the care provided or missed.
- Complex scenarios should usually contain 3 or more total vital sets unless the case truly does not require them.

- caseProgression must contain:
{
  "withProperTreatment": [],
  "withoutProperTreatment": [],
  "withIncorrectTreatment": []
}

Case progression rules:
- withProperTreatment must be an array of 2-3 behavioral steps describing how the patient changes with appropriate care.
- withoutProperTreatment must be an array of 2-3 behavioral steps describing how the patient changes if care is delayed, incomplete, or absent.
- withIncorrectTreatment must be an array of 2-3 behavioral steps describing how the patient changes if clinically important mistakes are made.
- Case progression must feel dynamic and physiologic, not scripted like a simple OSCE answer key.
- The patient should evolve like a real call.

- transportPhase must contain:
{
  "transportConsiderations": [],
  "ongoingCare": [],
  "reassessmentFocus": [],
  "handoffConsiderations": ""
}

- clinicalReasoning must contain:
- a concise narrative string explaining the clinical picture, pathophysiology, and why deterioration risks matter.

- directiveSources must be an array of strings indicating which Ontario documents shaped the scenario's decision points, e.g. ["BLS PCS 3.4 (2023)", "ALS PCS 5.4 (2025)", "OBHG ALS PCS Companion v5.4 (2025)"]

Clinical reasoning rules:
- clinicalReasoning should read as one coherent teaching paragraph, not a nested object.
- It should explain the likely process, why the patient looks the way they do, and what deterioration would look like.

Dynamic call timeline rules:
- The scenario must feel like a real call unfolding over time.
- Scene arrival, first impression, assessment, history, vitals, reassessment, and progression must connect logically.
- Avoid making every scenario feel like a fixed station with one frozen assessment block.
- The call should evolve based on patient physiology, treatment choices, missed care, scene factors, and reassessment.
- At minimum, every scenario must include:
  1. scene arrival context
  2. first impression
  3. initial assessment
  4. first vital set
  5. history gathering
  6. secondary assessment
  7. second vital set
  8. case progression through treatment / no treatment / incorrect treatment
  9. transport-phase thinking in the top-level transportPhase object
- Additional assessments and additional vital sets should appear when they improve realism.

Quality rubric (target before returning JSON):
- Overall quality score target: >= 85/100.
- Keep all core narrative fields concrete and call-specific.
- caseProgression should contain at least 2 meaningful steps in each branch.
- transportPhase should include practical detail in transportConsiderations, ongoingCare, reassessmentFocus, and handoffConsiderations.
- expectedTreatment should usually contain 6-8 actionable items.
- protocolNotes should usually contain 4-6 concise items with Ontario references.
- learningObjectives and selfReflectionPrompts should each have at least 4 substantive entries.
- clinicalReasoning should be concise but complete enough to explain pathophysiology and deterioration logic.


GRS rules:
- grsAnchors must contain these EXACT 7 domains:
  - situationalAwareness
  - patientAssessment
  - historyGathering
  - decisionMaking
  - communication
  - resourceUtilization
  - proceduralSkills
- Each domain must contain exactly these score keys: "3", "5", "7"
- Each score key must contain an array
- Each score array must contain at least 3 short, scenario-specific behavioural bullet examples
- Score 3 = developing but inconsistent, delayed, hesitant, or shallow
- Score 5 = competent semester-appropriate performance
- Score 7 = exceptional, anticipatory, organized, calm, and highly effective

ECG rules:
Use ONLY these exact ECG values when appropriate:
${ECG_WHITELIST.map((item) => `- ${item}`).join('\n')}
- Do NOT add rate, qualifiers, extra descriptors, emojis, or any custom text.
- If ECG is relevant, place it in vitalSigns.firstSet.ecgInterpretation
- Update vitalSigns.secondSet.ecgInterpretation only if the rhythm changes
- If additionalSets are used, only include ECG changes when clinically justified
- If the case is isolated trauma (no cardiac component), leave ecgInterpretation blank or use "Not applicable"
- For non-cardiac calls, ecgInterpretation should be blank, "Normal Sinus Rhythm", or "Not applicable"; never emoji or placeholder text.

Scenario parameters:
- Semester: ${semester}
- Call Type: ${finalCallType}
- Environment: ${environment}
- Complexity: ${complexity}
- Shift Mode: ${shiftMode}
- Include teaching cues: ${includeTeachingCues}
- Instructor Prompt (optional): ${normalizedCustomPrompt || 'None provided'}

Instructor prompt handling rules:
- If an instructor prompt is provided, integrate its theme, setting, or emphasis across relevant sections.
- Keep schema, semester level, complexity target, and Ontario directive compliance fully intact.
- Instructor prompt is advisory and should shape scenario details, not override safety or protocol logic.

Teaching cue behavior:
- If Include teaching cues is true, embed practical instructor cues using format *(💡 cue text)*.
- Keep cues simple and elegant. They should read like calm instructor hints, not labeled metadata blocks.
- Each cue should usually be 1-2 short sentences, more like a real-time preceptor memo than a mini-paragraph.
- Keep each cue brief and concrete, ideally under about 40 words and rarely over about 50. If there is no specific high-value coaching point, omit the cue instead of padding it.
- Each cue should have one primary coaching objective: the key clue, why it matters, or the next action. A second short sentence can support that same objective, but do not stack unrelated lessons into one cue.
- Cue voice should sound like an experienced preceptor coaching decision-making in real time.
- Treat each cue as the instructor's substitute voice when no instructor is present; cues should read like direct coaching to the learner.
- Prefer direct, learner-facing language (for example: "you", "name", "assign", "reassess", "state what changed") over neutral narration.
- Keep cue usefulness consistently high across all semesters; semester level should change case demands, not cue value.
- If Include teaching cues is true, aim for cues across multiple sections with roughly 6-10 total cues when the case supports that many high-value coaching moments. Fewer is better than padding weak cues.
- Aim to spread cues across at least 4 high-value sections when clinically appropriate (assessment, vitals, progression, transport, treatment/protocol, reasoning). Do not force coverage into low-value sections.
- Place cues where this specific case has highest teaching leverage (for example barriers, trend shifts, deterioration branches, or transport risk) rather than using a fixed section pattern every time.
- Every cue must reference this specific case (complaint, trend, environment, progression trigger, or transport challenge) rather than generic coaching language.
- When a medication is clearly indicated and dose/route are present in this case, treatment/protocol cues may reference that exact dose line to coach safe execution per ALS PCS.
- Do not invent medication doses in cues; only reference doses already supported by the scenario content and directive context.
- Avoid repeated cue intent; each cue should teach a different decision point or reassessment moment.
- Prefer cues that sharpen reasoning, priorities, reassessment, or pitfall recognition over cues that merely restate scenario facts.
- Avoid generic stand-alone phrases such as "monitor closely", "reassess as needed", or "prepare for transport" unless tied to concrete scenario details.
- Do not use "..." inside cues unless the source content truly requires it; shorten the thought cleanly instead.
- Do not use emojis inside cue text.
- Keep readability high by avoiding cue clustering in only one section.
- If Include teaching cues is false, do not include any cue markup anywhere in the JSON.

Control summary:
- Semester ${semester} should visibly change treatment expectations, ambiguity, and learner burden.
- Complexity ${complexity} should visibly change scene burden, number of meaningful reassessment points, and operational strain.
- Shift mode ${shiftMode} should visibly change time-of-day feel, dispatch texture, access details, and scene lighting or staffing context when relevant.
- The final scenario must be obviously different if either semester or complexity changes.

Hard type enforcement:
${buildTypeEnforcementRules(finalCallType)}

Final internal compliance check:
${buildTypeComplianceChecklist(finalCallType)}

Semester difficulty profile:
${semesterProfile.instructionText.join('\n')}

Semester scenario shape requirements:
${semesterProfile.expectedScenarioShape.join('\n')}

Semester treatment style:
- ${semesterProfile.treatmentStyle}

Semester reasoning target:
- ${semesterProfile.expectedReasoning}

Selected subtype:
- ${subtypeData.subtype}
- Likely diagnosis: ${subtypeData.likelyDiagnosis}
- Chief complaint options: ${subtypeData.chiefComplaints.join(', ')}
- Plausible differentials: ${subtypeData.plausibleDifferentials.join(', ')}
- Symptom patterns: ${subtypeData.symptomPatterns.join(', ')}

Environment:
${environmentProfile.environmentInstruction}

Shift context:
${shiftProfile.instructionText}

Medication plan:
- Style: ${medicationPlan.style || 'supportive-care dominant'}
- Initial medications: ${medicationPlan.initialMedications.join(', ') || 'none'}
- Reassessment medications: ${medicationPlan.reassessmentMedications.join(', ') || 'none'}
- Transport medications: ${medicationPlan.transportPhaseMedications.join(', ') || 'none'}

Medication restrictions:
${medicationPlan.medicationRestrictions?.join('\n') || 'Use only clinically justified medication decisions.'}

Semester-specific medication rules:
${medicationPlan.semesterTwoRules?.join('\n') || 'Semester-appropriate medication expectations apply.'}

Staged treatment logic:
${medicationPlan.stagedTreatmentLogic.join('\n')}

Supportive care opportunities:
${medicationPlan.supportiveCareOpportunities.join('\n')}

Case progression logic:
${scenarioCore.progressionInstructions}

Vital trend logic:
${scenarioCore.vitalTrendInstructions}

Assessment cadence logic:
${scenarioCore.assessmentCadenceInstructions}

Mid-call event logic:
${scenarioCore.midCallEventInstructions}

Complication options:
${complicationData.join('\n')}

Critical output rules:
- Do not leave clinically relevant sections blank.
- Populate every top-level field.
- Populate every required nested object.
- expectedTreatment must be a practical list of paramedic actions.
- Keep expectedTreatment concise: usually 6-8 high-yield items, no padded restatements.
- protocolNotes must be a practical list, not a paragraph.
  - Each item should reference Ontario standards when clinically relevant (e.g., "per BLS PCS", "per ALS PCS").
  - At least 50% of items must include explicit directive references.
- Keep protocolNotes concise: usually 4-6 short items.
- learningObjectives must be populated.
- selfReflectionPrompts must be populated.
- teachersPoints must be populated.
- teachersPoints must be one instructor-style debrief paragraph, not an array.
- The paragraph should usually be compact and natural, with several distinct teaching beats woven together without sounding formulaic.
- Use direct preceptor voice that sounds helpful, clear, and practical. Light humor is allowed when it improves memorability and does not undercut safety.
- Include what happened in this case, why it matters clinically, and concrete improvement advice for the learner's next call.
- Keep the paragraph case-specific and clinically grounded; include a common pitfall, bias, or hesitation trap when it genuinely fits the case.
- Avoid repeating the same teaching intent from sentence to sentence.
- NEVER sound like a generic AI template or textbook rubric. Never use phrases like "This scenario is designed to teach," "It is important to," "Students should," "This highlights the need to," or similar hedge-heavy framing.
- Write like you are actually debriefing this specific call with your crew after it happened, not like you are writing instructional copy.
- Do not use emojis in teachersPoints.
- directiveSources must be populated as an array listing which Ontario documents shaped decision points.
- caseProgression must clearly describe proper treatment, lack of proper treatment, and incorrect treatment.
- initialAssessment and secondaryAssessment must not simply duplicate each other.
- If the patient's condition changes, reassessment findings must visibly change.
- additionalSets should be populated whenever treatment, movement, deterioration, or a mid-call event meaningfully changes the call.
- scenarioIntro should be 1-2 short sentences and should not pre-solve the whole case.
- scenarioRationale should be 2-3 short sentences, not a second full debrief.
- clinicalReasoning should stay concise and teaching-useful, not a full answer key.
- directiveSources is MANDATORY for every scenario.
  - Must include at least one of: ["BLS PCS 3.4 (2023)", "ALS PCS 5.4 (2025)", "OBHG ALS PCS Companion v5.4 (2025)"].
  - Must reflect which Ontario document(s) shaped the decision points in the scenario.
- Dynamic calls should show consequences of treatment, delay, movement, packaging, or new information.
- Avoid generic phrases like "monitor closely", "prepare for transport", or "reassess as needed" unless paired with a concrete finding, trigger, or transport concern.
- The requested Call Type is mandatory, not optional.
- The chief complaint, incidentNarrative, sceneArrival, firstImpression, assessments, clinicalReasoning, expectedTreatment, and caseProgression must all clearly match the requested Call Type.
- Do NOT substitute a generic medical scenario when Trauma, Cardiac, Respiratory, or Environmental was requested.
- If the final scenario does not clearly match the requested Call Type as the PRIMARY call family, rewrite it before returning JSON.
- The scenario must visibly reflect the requested Semester level.
- Semester 2 must be assessment-focused and non-medication by design.
- If Semester 2 is selected, do not include medication administration as an expected learner action.
- If Semester 2 is selected, expectedTreatment must remain supportive-care focused.
- If Semester 2 is selected, protocolNotes must not instruct medication administration.
- If Semester 2 is selected, teachersPoints must emphasize recognition, supportive care, reassessment, and transport rather than medications.
- If Semester 2 is selected, learningObjectives must not require drug administration.
- If Semester 2 is selected, GRS anchors must not reward medication administration decisions.
- Semester 3 should include reasonable treatment and reassessment decisions when justified.
- Semester 4 should show stronger autonomy, prioritization, withholding logic when appropriate, and more layered decision-making.
- The final scenario should be noticeably different if the semester is changed.
- The scenario must feel like a dynamic paramedic call, not just a static OSCE station.
- Make the scenario realistic, educational, internally coherent, semester-appropriate, and faithful to the requested type.
`.trim();

    const parsed = await requestScenarioJson([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ]);

    let normalized = applyTeachingCuePreference(
      normalizeScenarioData(parsed),
      Boolean(includeTeachingCues)
    );
    normalized = enforceScenarioControls(normalized, {
      semester,
      complexity,
      callType: finalCallType,
      environment,
      shiftMode
    });
    normalized = enforceTeachingCueSpecificity(normalized, Boolean(includeTeachingCues));
    normalized = enforceTeachingCueSectionDiscipline(normalized, Boolean(includeTeachingCues));
    normalized = ensureTeachingCueCoverage(normalized, Boolean(includeTeachingCues), generationVariationSeed);
    normalized = enforceTeachingCueSectionDiscipline(normalized, Boolean(includeTeachingCues));
    normalized = enforceDoseCueSafety(normalized, Boolean(includeTeachingCues));
    normalized = ensureTeachingCueCoverage(normalized, Boolean(includeTeachingCues), generationVariationSeed + 101);
    normalized = ensureDeterministicMinimumCueCoverage(normalized, Boolean(includeTeachingCues));
    normalized = ensureTeachingPointCoverage(normalized);
    normalized = enforceTeachingPointQuality(normalized);
    normalized = ensureTwoSetTrendCoverage(normalized);
    normalized = enforceScenarioSectionConciseness(normalized);

    const looksEmpty =
      !normalized.title &&
      !normalized.scenarioIntro &&
      !normalized.patientPresentation &&
      !normalized.incidentNarrative &&
      !normalized.sceneArrival?.sceneDescription &&
      !normalized.firstImpression?.generalAppearance &&
      !normalized.initialAssessment?.generalImpression &&
      !normalized.callInformation?.location &&
      !normalized.patientDemographics?.chiefComplaint &&
      !(normalized.caseProgression?.withProperTreatment || []).length &&
      !(normalized.transportPhase?.transportConsiderations || []).length &&
      !normalized.transportPhase?.handoffConsiderations &&
      !normalized.clinicalReasoning &&
      !(normalized.expectedTreatment || []).length &&
      !(normalized.learningObjectives || []).length &&
      !(normalized.teachersPoints || []).length;

    if (looksEmpty) {
      console.error('Model returned structurally valid but empty scenario JSON:', parsed);
      return res.status(500).json({
        error: 'Scenario generation returned empty content. Prompt schema needs retry.'
      });
    }

    let validation = detectControlDrift(normalized, {
      semester,
      complexity,
      callType: finalCallType,
      environment,
      shiftMode,
      includeTeachingCues,
      customPrompt: normalizedCustomPrompt
    });

    const shouldAttemptModelRepair = shouldRunModelRepair(validation);

    if (shouldAttemptModelRepair) {
      let bestScenario = normalized;
      let bestValidation = validation;
      const repairAttemptLimit = bestValidation.issues.some((issue) => issue.severity === 'high')
        ? CONTROL_REPAIR_MAX_ATTEMPTS
        : 1;

      for (let repairAttempt = 1; repairAttempt <= repairAttemptLimit; repairAttempt += 1) {
        devWarn(`Scenario control drift detected, attempting repair ${repairAttempt}/${repairAttemptLimit}:`, bestValidation);

        const repairedParsed = await repairScenarioForControlDrift({
          systemPrompt,
          scenario: bestScenario,
          controls: {
            semester,
            complexity,
            callType: finalCallType,
            environment,
            shiftMode,
            includeTeachingCues,
            customPrompt: normalizedCustomPrompt
          },
          validation: bestValidation
        });

        const repairedNormalized = applyTeachingCuePreference(
          normalizeScenarioData(repairedParsed),
          Boolean(includeTeachingCues)
        );
        enforceScenarioControls(repairedNormalized, {
          semester,
          complexity,
          callType: finalCallType,
          environment,
          shiftMode
        });
        const specificitySafeRepaired = enforceTeachingCueSpecificity(repairedNormalized, Boolean(includeTeachingCues));
        const sectionDisciplinedRepaired = enforceTeachingCueSectionDiscipline(
          specificitySafeRepaired,
          Boolean(includeTeachingCues)
        );
        ensureTeachingCueCoverage(
          sectionDisciplinedRepaired,
          Boolean(includeTeachingCues),
          generationVariationSeed + repairAttempt
        );
        const postCoverageSectionDisciplined = enforceTeachingCueSectionDiscipline(
          sectionDisciplinedRepaired,
          Boolean(includeTeachingCues)
        );
        const doseSafeRepaired = enforceDoseCueSafety(postCoverageSectionDisciplined, Boolean(includeTeachingCues));
        const finalCueCoveredRepaired = ensureTeachingCueCoverage(
          doseSafeRepaired,
          Boolean(includeTeachingCues),
          generationVariationSeed + repairAttempt + 101
        );
        const deterministicCueCoveredRepaired = ensureDeterministicMinimumCueCoverage(
          finalCueCoveredRepaired,
          Boolean(includeTeachingCues)
        );
        const teachingPointSafeRepaired = ensureTeachingPointCoverage(deterministicCueCoveredRepaired);
        const deepTeachingPointSafeRepaired = enforceTeachingPointQuality(teachingPointSafeRepaired);
        const trendSafeRepaired = ensureTwoSetTrendCoverage(deepTeachingPointSafeRepaired);
        const conciseRepaired = enforceScenarioSectionConciseness(trendSafeRepaired);

        const repairedValidation = detectControlDrift(conciseRepaired, {
          semester,
          complexity,
          callType: finalCallType,
          environment,
          shiftMode,
          includeTeachingCues,
          customPrompt: normalizedCustomPrompt
        });

        if (repairedValidation.issues.length < bestValidation.issues.length) {
          bestScenario = conciseRepaired;
          bestValidation = repairedValidation;
        }

        if (!bestValidation.issues.length || !bestValidation.issues.some((issue) => issue.severity === 'high')) {
          break;
        }
      }

      normalized = bestScenario;
      validation = bestValidation;
    } else if (validation.issues.length) {
      devWarn('Skipping model repair loop because only non-critical medium issues were detected.');
    }

    // Final deterministic quality fail-safe: if only teaching-point quality remains high,
    // rewrite points in-process and revalidate once before returning a hard failure.
    if (validation.issues.some((issue) => issue.severity === 'high')) {
      const hasTeachingPointHigh = validation.issues.some((issue) =>
        issue.code === 'teaching-points-surface-level' ||
        issue.code === 'teaching-points-too-few' ||
        issue.code === 'teaching-points-run-on' ||
        issue.code === 'teaching-points-repetitive' ||
        issue.code === 'teaching-points-generic-language'
      );

      if (hasTeachingPointHigh) {
        normalized = ensureDeterministicMinimumCueCoverage(normalized, Boolean(includeTeachingCues));
        normalized = ensureTeachingPointCoverage(normalized);
        normalized = enforceTeachingPointQuality(normalized);
        normalized = ensureTwoSetTrendCoverage(normalized);
        normalized = enforceScenarioSectionConciseness(normalized);
        normalized = enforceScenarioControls(normalized, {
          semester,
          complexity,
          callType: finalCallType,
          environment,
          shiftMode
        });

        validation = detectControlDrift(normalized, {
          semester,
          complexity,
          callType: finalCallType,
          environment,
          shiftMode,
          includeTeachingCues,
          customPrompt: normalizedCustomPrompt
        });
      }
    }

    if (validation.issues.some((issue) => issue.severity === 'high')) {
      console.error('Scenario generation failed control validation:', validation);
      return res.status(500).json({
        error: 'Scenario generation drifted from the requested semester or complexity.',
        details: validation.issues.map((issue) => issue.message).join(' ')
      });
    }

    normalized.customPrompt = normalizedCustomPrompt;
    rememberScenarioCueFingerprints(normalized);
    res.json(normalized);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Scenario generation failed.' });
  }
});

export default router;