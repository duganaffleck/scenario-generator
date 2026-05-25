import 'dotenv/config';
import express from 'express';
import OpenAI from 'openai';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { jsonrepair } from 'jsonrepair';
import { buildDirectivePromptAddendum, buildForbiddenTreatmentTerms } from '../data/ontarioDirectiveRules.js';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const parsePositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};


const GENERATION_DEPTH_PROFILES = {
  'Quick Draft': {
    label: 'Quick Draft',
    model: process.env.OPENAI_MODEL_QUICK || 'gpt-5.4-mini',
    temperature: 0.75,
    maxTokens: parsePositiveInt(process.env.OPENAI_MAX_TOKENS_QUICK, 20000),
    promptInstruction:
      'Prioritize speed and structural completeness. Keep scenarioIntro to 2 sentences. Keep patientPresentation to 2 to 3 sentences. Keep incidentNarrative to 3 to 4 sentences. Keep physicalExam to one specific finding per field with no elaboration. Keep caseProgression to 2 points per track. Keep clinicalReasoning.summary to 2 sentences. Keep GRS anchors to one direct sentence per bullet. Keep teachersPoints to 2 to 3 sentences. Keep selfReflectionPrompts to 3 prompts. Do not omit required fields. Keep every section scenario-specific even when short.'
  },

  Detailed: {
    label: 'Detailed',
    model: process.env.OPENAI_MODEL_DETAILED || 'gpt-5.5',
    temperature: 1,
    maxTokens: parsePositiveInt(process.env.OPENAI_MAX_TOKENS_DETAILED, 24000),
    promptInstruction:
      'Prioritize instructor-quality depth and clinical realism throughout. Write scenarioIntro as 3 to 5 sentences that name the teaching purpose. Write patientPresentation as a full paragraph with behavioral, positional, and speech details. Write incidentNarrative as a full timeline with contextual and clinical detail. Write physicalExam with specific findings and brief clinical context per field. Write caseProgression with 3 to 4 points per track showing realistic clinical cause and effect. Write clinicalReasoning with a full argument per differential including mechanism and distinguishing features. Write GRS anchors as 2 to 3 sentences per bullet describing specific observable behaviors tied to this call. Write teachersPoints as a full 4-sentence paragraph. Write selfReflectionPrompts as 4 to 5 specific clinical reasoning questions.'
  }
};

function getGenerationDepthProfile(generationDepth = 'Quick Draft') {
  return GENERATION_DEPTH_PROFILES[generationDepth] ||
         GENERATION_DEPTH_PROFILES['Quick Draft'];
}

function getScenarioFrictionInstruction(scenarioFriction = 'Clean') {
  switch (scenarioFriction) {
    case 'Pressured':
      return [
        'Use pressured scenario friction: add layered but fair operational pressure that meaningfully affects the call.',
        'Use two or more relevant friction elements such as access limitations, family or bystander pressure, communication barriers, equipment/logistics problems, movement intolerance, refusal tension, privacy issues, weather, terrain, or transport deterioration.',
        'Friction must change how the crew manages assessment, reassessment, packaging, communication, or transport; it must not be random chaos or a gotcha.',
        'Keep the case coherent, psychologically safe, and appropriate to the selected semester and clinical complexity.'
      ].join(' ');
    case 'Clean':
    default:
      return [
        'Use a clean scene: keep the operational environment relatively straightforward and focused.',
        'Include at most one minor access, communication, bystander, equipment, or movement issue only when it naturally fits the selected environment.',
        'Do not overcomplicate the scene; the learning value should mainly come from assessment, clinical reasoning, and appropriate care.',
        'Still include reassessment and transport thinking when clinically relevant.'
      ].join(' ');
  }
}



function getShiftModeInstruction(shiftMode = 'Day Shift') {
  const isNightShift = String(shiftMode).toLowerCase().includes('night');

  if (isNightShift) {
    return [
      'Night Shift Mode is ON: set callInformation.time between 22:00 and 06:00 unless the instructor prompt explicitly requires a different time.',
      'Include at least two grounded night-shift details such as low light, locked doors, sleepy witnesses, delayed discovery, reduced collateral, closed services, building access issues, tired family, quiet-but-unsafe streets, or harder medication/history confirmation.',
      'Night Shift Mode should change scene texture, timeline reliability, access, collateral history, and reassessment traps; it should not automatically make the case clinically harder unless complexity or friction also supports that.',
      'Avoid cartoon horror, spooky clichés, or exaggerated darkness. Keep the tone realistic and paramedic-specific.'
    ].join(' ');
  }

  return [
    'Night Shift Mode is OFF: use daytime or evening timing unless the instructor prompt clearly asks for overnight, midnight, after-bedtime, or night-shift timing.',
    'Do not default to 02:00-04:00 calls just for flavour when Night Shift Mode is off.',
    'Scene texture should come from the selected environment, complexity, and scenario friction rather than night-shift atmosphere.'
  ].join(' ');
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

function defaultSceneArrival() {
  return {
    sceneDescription: '',
    environmentDetails: [],
    hazards: [],
    accessIssues: '',
    bystandersPresent: '',
    sceneEnergy: ''
  };
}

function defaultFirstImpression() {
  return {
    generalAppearance: '',
    levelOfDistress: '',
    apparentSeverity: '',
    positionFound: '',
    visibleClues: [],
    initialRedFlags: []
  };
}

function defaultInitialAssessment() {
  return {
    airway: '',
    breathing: '',
    circulation: '',
    disability: '',
    exposure: '',
    generalImpression: ''
  };
}

function defaultHistoryGathering() {
  return {
    historySource: '',
    additionalHistory: [],
    bystanderInformation: [],
    contradictionsOrBarriers: [],
    sceneContextClues: []
  };
}

function defaultSecondaryAssessment() {
  return {
    generalAppearance: '',
    breathing: '',
    circulation: '',
    keyFindings: [],
    missedIfNotAssessed: [],
    evolvingFindings: []
  };
}

function defaultGrsAnchors() {
  return {
    situationalAwareness: { 3: [], 5: [], 7: [] },
    patientAssessment: { 3: [], 5: [], 7: [] },
    historyGathering: { 3: [], 5: [], 7: [] },
    decisionMaking: { 3: [], 5: [], 7: [] },
    proceduralSkill: { 3: [], 5: [], 7: [] },
    resourceUtilization: { 3: [], 5: [], 7: [] },
    communication: { 3: [], 5: [], 7: [] }
  };
}

function defaultCaseProgression() {
  return {
    withProperTreatment: [],
    withoutProperTreatment: [],
    withIncorrectTreatment: [],
    movementOrTransportChanges: []
  };
}

function defaultTransportPhase() {
  return {
    transportConsiderations: [],
    ongoingCare: [],
    reassessmentFocus: [],
    handoffConsiderations: ''
  };
}

function defaultInstructorGuidance() {
  return {
    instructorPriorities: [],
    psychologicalSafetyDebrief: ''
  };
}

const REQUIRED_FIELDS = {
  scenarioIntro: '',
  title: '',
  callInformation: {
    type: '',
    location: '',
    time: '',
    dispatchCode: '',
    dispatchNotes: [],
    hazardsOrFlags: [],
    crewNotes: ''
  },
  sceneArrival: defaultSceneArrival(),
  firstImpression: defaultFirstImpression(),
  patientDemographics: defaultPatientDemographics(),
  patientPresentation: '',
  incidentNarrative: '',
  opqrst: {
    onset: '',
    provocation: '',
    quality: '',
    radiation: '',
    severity: '',
    time: ''
  },
  initialAssessment: defaultInitialAssessment(),
  historyGathering: defaultHistoryGathering(),
  secondaryAssessment: defaultSecondaryAssessment(),
  additionalAssessments: [],
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
  vitalSigns: {
    firstSet: defaultVitalSet(),
    secondSet: defaultVitalSet(),
    additionalSets: []
  },
  ecgFindings: {
    ecgType: "",
    rhythmInterpretation: "",
    twelveLeadFindings: "",
    fifteenLeadFindings: "",
    ecgClinicalNote: "",
    patternKey: "",
  },
  caseProgression: defaultCaseProgression(),
  transportPhase: defaultTransportPhase(),
  instructorGuidance: defaultInstructorGuidance(),
  expectedTreatment: [],
  protocolNotes: [],
  learningObjectives: [],
  vocationalLearningOutcomes: [],
  selfReflectionPrompts: [],
  grsAnchors: defaultGrsAnchors(),
  teachersPoints: '',
  scenarioRationale: '',
  clinicalReasoning: {
    summary: '',
    differentialDiagnosis: [],
    conclusion: ''
  }
};

router.options('/', (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.sendStatus(204);
});

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
    .map((line) => line.replace(/^[-•\d.)\s]+/, '').trim())
    .filter(Boolean);
}

function stringifyValue(value) {
  if (value == null || value === '') return '';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}


function removeEmDashes(value = '') {
  return String(value).replace(/\s*-\s*/g, ' - ').replace(/\s{2,}/g, ' ').trim();
}

function scrubEmDashesDeep(value) {
  if (typeof value === 'string') return removeEmDashes(value);
  if (Array.isArray(value)) return value.map((item) => scrubEmDashesDeep(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, scrubEmDashesDeep(item)])
    );
  }
  return value;
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
      .map((item) => String(item).trim())
      .filter(Boolean);
  }

  if (value == null || value === '') return [];

  if (typeof value === 'string') {
    const trimmed = value.trim();
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
  if (typeof value === 'string') {
    return {
      ...REQUIRED_FIELDS.clinicalReasoning,
      summary: value.trim()
    };
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ...REQUIRED_FIELDS.clinicalReasoning };
  }

  const differentialDiagnosis = Array.isArray(value.differentialDiagnosis)
    ? value.differentialDiagnosis.map((item) => ({
        condition: item?.condition || '',
        supportingFeatures: item?.supportingFeatures || '',
        rulingOutFeatures: item?.rulingOutFeatures || ''
      }))
    : [];

  return {
    summary: value.summary || value.pathophysiologySummary || '',
    differentialDiagnosis,
    conclusion: value.conclusion || value.workingDiagnosis || ''
  };
}

function sanitizeVitalSet(raw = {}, ecgInterpretation = '') {
  const set = { ...defaultVitalSet(), ...(raw && typeof raw === 'object' ? raw : {}) };

  if (ecgInterpretation && ECG_WHITELIST.includes(ecgInterpretation) && !set.ecgInterpretation) {
    set.ecgInterpretation = ecgInterpretation;
  }

  if (set.ecgInterpretation && !ECG_WHITELIST.includes(set.ecgInterpretation)) {
    set.ecgInterpretation = '';
  }

  if (set.ecgInterpretation && set.hr) {
    const hrNum = parseInt(String(set.hr).replace(/[^0-9]/g, ''), 10);
    if (!isNaN(hrNum)) {
      if (set.ecgInterpretation === 'Sinus Tachycardia' && hrNum <= 100) {
        set.ecgInterpretation = hrNum < 60 ? 'Sinus Bradycardia' : 'Normal Sinus Rhythm';
      } else if (set.ecgInterpretation === 'Sinus Bradycardia' && hrNum >= 60) {
        set.ecgInterpretation = hrNum > 100 ? 'Sinus Tachycardia' : 'Normal Sinus Rhythm';
      } else if (set.ecgInterpretation === 'Normal Sinus Rhythm' && (hrNum < 60 || hrNum > 100)) {
        set.ecgInterpretation = hrNum > 100 ? 'Sinus Tachycardia' : 'Sinus Bradycardia';
      }
    }
  }

  return set;
}

function normalizeVitalSigns(value, ecgInterpretation) {
  const source = value && typeof value === 'object' ? value : {};
  const firstRaw = source.firstSet || source.first || {};
  const secondRaw = source.secondSet || source.second || {};
  const additionalSets = Array.isArray(source.additionalSets)
    ? source.additionalSets.map((set) => sanitizeVitalSet(set)).filter((set) => Object.values(set).some(Boolean))
    : [];
  const firstSet = sanitizeVitalSet(firstRaw, ecgInterpretation);
  const secondSet = sanitizeVitalSet(secondRaw, firstSet.ecgInterpretation);
  const normalizedAdditional = additionalSets.map((set, i) => {
    if (!set.ecgInterpretation) {
      const prev = i === 0 ? secondSet : additionalSets[i - 1];
      set.ecgInterpretation = prev?.ecgInterpretation || firstSet.ecgInterpretation || '';
    }
    return set;
  });
  return {
    firstSet,
    secondSet,
    additionalSets: normalizedAdditional
  };
}

function normalizeCaseProgression(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};

  return {
    withProperTreatment: coerceArray(source.withProperTreatment),
    withoutProperTreatment: coerceArray(source.withoutProperTreatment || source.withDelayedOrNoTreatment || source.withNoTreatment),
    withIncorrectTreatment: coerceArray(source.withIncorrectTreatment || source.incorrectTreatment),
    movementOrTransportChanges: coerceArray(source.movementOrTransportChanges || source.transportChanges || source.movementChanges)
  };
}

function normalizeTransportPhase(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};

  return {
    transportConsiderations: coerceArray(source.transportConsiderations),
    ongoingCare: coerceArray(source.ongoingCare),
    reassessmentFocus: coerceArray(source.reassessmentFocus),
    handoffConsiderations: stringifyValue(source.handoffConsiderations || source.handoff || '').trim()
  };
}

function normalizeTeachingParagraph(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean).join(' ');
  }

  if (value && typeof value === 'object') {
    return Object.values(value).map((item) => stringifyValue(item).trim()).filter(Boolean).join(' ');
  }

  return stringifyValue(value).trim();
}

function normalizeInitialAssessment(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const allowed = defaultInitialAssessment();

  for (const key of Object.keys(allowed)) {
    allowed[key] = stringifyValue(source[key] || '').trim();
  }

  return allowed;
}

function normalizeInstructorGuidance(source = {}, normalized = {}) {
  const guidanceSource = source.instructorGuidance && typeof source.instructorGuidance === 'object' && !Array.isArray(source.instructorGuidance)
    ? source.instructorGuidance
    : {};
  const initial = source.initialAssessment && typeof source.initialAssessment === 'object' && !Array.isArray(source.initialAssessment)
    ? source.initialAssessment
    : {};

  return {
    instructorPriorities: coerceArray(
      guidanceSource.instructorPriorities ||
      guidanceSource.immediatePriorities ||
      source.instructorPriorities ||
      initial.immediatePriorities
    ),
    psychologicalSafetyDebrief: normalizeTeachingParagraph(
      guidanceSource.psychologicalSafetyDebrief ||
      guidanceSource.debriefFraming ||
      source.psychologicalSafetyDebrief ||
      ''
    )
  };
}


function normalizeGrsAnchors(value) {
  const base = defaultGrsAnchors();
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};

  for (const domain of Object.keys(base)) {
    const incomingDomain = source[domain];
    if (!incomingDomain || typeof incomingDomain !== 'object' || Array.isArray(incomingDomain)) {
      continue;
    }

    for (const score of ['3', '5', '7']) {
      base[domain][score] = coerceArray(incomingDomain[score]).slice(0, 3);
    }
  }

  return base;
}


function textHasAny(text, terms) {
  return terms.some((term) => text.includes(term));
}

function inferChiefComplaint({ existingChiefComplaint = '', selectedType = '', scenarioText = '' }) {
  const existing = String(existingChiefComplaint || '').trim();
  const typeLower = String(selectedType || '').toLowerCase();
  const text = String(scenarioText || '').toLowerCase();

  const strongCardiacSignals = textHasAny(text, [
    'chest pressure',
    'central chest',
    'crushing chest',
    'heavy chest',
    'chest discomfort',
    'radiates to left arm',
    'radiates to jaw',
    'jaw radiation',
    'stemi',
    'acute coronary',
    'cardiac ischemia',
    'myocardial infarction',
    'nitroglycerin',
    'asa',
    'v4r'
  ]);

  const chestPainLooksStale = /^chest\s+(pain|pressure)$/i.test(existing) && typeLower !== 'cardiac' && !strongCardiacSignals;
  if (existing && !chestPainLooksStale) return existing;

  if (typeLower === 'cardiac') {
    if (textHasAny(text, ['palpitations', 'rapid heart', 'svt', 'atrial fibrillation', 'atrial flutter'])) return 'Palpitations';
    return 'Chest pain';
  }

  if (typeLower === 'respiratory' || textHasAny(text, ['short of breath', 'difficulty breathing', 'wheez', 'asthma', 'copd', 'respiratory distress'])) {
    return 'Shortness of breath';
  }

  if (typeLower === 'trauma' || textHasAny(text, ['pedestrian struck', 'collision', 'fracture', 'pinned'])) {
    return 'Traumatic injury';
  }

  if (textHasAny(text, ['confusion', 'confused', 'delirium', 'paranoid', 'altered mentation', 'altered mental status', 'not acting normally', 'off baseline'])) return 'Altered mental status';
  if (textHasAny(text, ['hypogly', 'low blood sugar', 'low sugar', 'glucagon'])) return 'Altered level of consciousness';
  if (textHasAny(text, ['fever', 'chills', 'sepsis', 'urinary', 'burning urination', 'foul-smelling urine'])) return 'Fever and weakness';
  if (textHasAny(text, ['near-syncope', 'syncope', 'dizzy', 'dizziness', 'weakness', 'lightheaded'])) return 'Weakness and dizziness';
  if (textHasAny(text, ['vomit', 'nausea', 'retching', 'diarrhea'])) return 'Vomiting and weakness';

  return existing || 'Medical complaint';
}

function fillScenarioGaps(normalized, options = {}) {
  const allScenarioText = [
    normalized.title,
    normalized.scenarioIntro,
    stringifyValue(normalized.callInformation),
    normalized.patientPresentation,
    normalized.incidentNarrative,
    stringifyValue(normalized.opqrst),
    stringifyValue(normalized.sample),
    ...(normalized.medications || []),
    ...(normalized.allergies || []),
    ...(normalized.pastMedicalHistory || []),
    stringifyValue(normalized.caseProgression?.withProperTreatment),
    stringifyValue(normalized.caseProgression?.withoutProperTreatment),
    stringifyValue(normalized.caseProgression?.withIncorrectTreatment),
    stringifyValue(normalized.caseProgression?.movementOrTransportChanges),
    stringifyValue(normalized.transportPhase),
    stringifyValue(normalized.instructorGuidance),
    normalized.teachersPoints,
    normalized.scenarioRationale,
    normalized.clinicalReasoning?.summary,
    normalized.clinicalReasoning?.conclusion
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const text = allScenarioText;
  const exam = normalized.physicalExam || defaultPhysicalExam();
  const demographics = normalized.patientDemographics || defaultPatientDemographics();

  const fillIfBlank = (key, value) => {
    if (!exam[key] && value) exam[key] = value;
  };

  const respiratory =
    text.includes('asthma') ||
    text.includes('wheez') ||
    text.includes('short of breath') ||
    text.includes('sob') ||
    text.includes('respiratory distress') ||
    text.includes('copd') ||
    text.includes('bronchodilator') ||
    text.includes('salbutamol') ||
    text.includes('ventolin') ||
    text.includes('difficulty breathing');

  const cardiac =
    text.includes('chest pain') ||
    text.includes('stemi') ||
    text.includes('nstemi') ||
    text.includes('palpitations') ||
    text.includes('syncope') ||
    text.includes('arrhythmia') ||
    text.includes('acute coronary') ||
    text.includes('heart attack') ||
    text.includes('atrial fibrillation') ||
    text.includes('atrial flutter') ||
    text.includes('svt');

  const trauma =
    text.includes('fall') ||
    text.includes('mvc') ||
    text.includes('mva') ||
    text.includes('collision') ||
    text.includes('trauma') ||
    text.includes('injury') ||
    text.includes('bleeding') ||
    text.includes('fracture') ||
    text.includes('deformity');

  const hypoglycemia =
    text.includes('hypogly') ||
    text.includes('low sugar') ||
    text.includes('low blood sugar') ||
    text.includes('diabetic') ||
    text.includes('glucagon') ||
    text.includes('insulin') ||
    text.includes('blood glucose');

  if (!demographics.age) demographics.age = '35';
  if (!demographics.sex) demographics.sex = 'Unknown';
  if (!demographics.weight) demographics.weight = '70 kg';

  demographics.chiefComplaint = inferChiefComplaint({
    existingChiefComplaint: demographics.chiefComplaint,
    selectedType: options.type,
    scenarioText: text
  });

  if (!exam.generalAppearance) {
    exam.generalAppearance =
      normalized.patientPresentation ||
      normalized.scenarioIntro ||
      'Patient appears unwell and requires focused assessment.';
  }

  if (respiratory) {
    fillIfBlank('airway', 'Patent, able to maintain airway.');
    fillIfBlank('breathing', 'Increased work of breathing with abnormal breath sounds or respiratory distress features.');
    fillIfBlank('circulation', 'Peripheral perfusion present, pulse requires reassessment.');
    fillIfBlank('neuro', 'Alert and oriented unless fatigue or hypoxia worsens.');
    fillIfBlank('headNeck', 'No obvious acute upper airway trauma or neck abnormalities.');
    fillIfBlank('chest', 'Respiratory findings consistent with the presentation.');
    fillIfBlank('abdomen', 'Soft, non-tender, no relevant acute findings.');
    fillIfBlank('pelvis', 'Stable, no relevant acute findings.');
    fillIfBlank('extremities', 'No obvious acute deformity or neurovascular deficit.');
    fillIfBlank('skin', 'Skin findings consistent with respiratory stress level.');
  }

  if (cardiac) {
    fillIfBlank('airway', 'Patent, no immediate airway compromise.');
    fillIfBlank('breathing', 'Breathing pattern may be mildly increased due to pain, anxiety, or perfusion issues.');
    fillIfBlank('circulation', 'Pulse present, assess rate, rhythm, perfusion, and skin signs carefully.');
    fillIfBlank('neuro', 'Alert and oriented unless perfusion worsens.');
    fillIfBlank('headNeck', 'No obvious acute head or neck findings.');
    fillIfBlank('chest', 'Chest discomfort or pressure without primary traumatic findings unless otherwise stated.');
    fillIfBlank('abdomen', 'Soft, non-tender unless atypical presentation suggests otherwise.');
    fillIfBlank('pelvis', 'Stable, no relevant acute findings.');
    fillIfBlank('extremities', 'No obvious acute deformity or deficit.');
    fillIfBlank('skin', 'May be pale, cool, or diaphoretic.');
  }

  if (trauma) {
    fillIfBlank('airway', 'Patent unless trauma pattern suggests otherwise.');
    fillIfBlank('breathing', 'Assess chest rise, effort, and breath sounds for trauma-related compromise.');
    fillIfBlank('circulation', 'Assess for bleeding, perfusion, and evolving signs of shock.');
    fillIfBlank('neuro', 'Assess LOC, GCS, and neuro deficits relevant to mechanism.');
    fillIfBlank('headNeck', 'Assess for tenderness, deformity, swelling, or trauma-related findings.');
    fillIfBlank('chest', 'Assess for tenderness, bruising, deformity, or pain with breathing.');
    fillIfBlank('abdomen', 'Assess for tenderness, guarding, distension, or bruising.');
    fillIfBlank('pelvis', 'Assess carefully for stability, tenderness, and movement-related pain.');
    fillIfBlank('extremities', 'Inspect for deformity, pain, swelling, and distal neurovascular status.');
    fillIfBlank('skin', 'May be pale, cool, diaphoretic, bruised, or bleeding depending on injuries.');
  }

  if (hypoglycemia) {
    fillIfBlank('airway', 'Airway patent, monitor closely if LOC is reduced.');
    fillIfBlank('breathing', 'Breathing adequate unless level of consciousness declines.');
    fillIfBlank('circulation', 'Pulse present, skin may be cool, pale, or diaphoretic.');
    fillIfBlank('neuro', 'Altered mental status ranging from confusion to decreased LOC.');
    fillIfBlank('headNeck', 'No obvious trauma-related findings unless otherwise stated.');
    fillIfBlank('chest', 'No primary acute chest findings.');
    fillIfBlank('abdomen', 'Soft, non-tender, no primary acute findings.');
    fillIfBlank('pelvis', 'Stable, no relevant acute findings.');
    fillIfBlank('extremities', 'Moves all limbs unless otherwise stated.');
    fillIfBlank('skin', 'Cool, pale, or diaphoretic.');
  }

  fillIfBlank('airway', 'Patent.');
  fillIfBlank('breathing', 'Breathing present, no immediately obvious compromise on initial exam.');
  fillIfBlank('circulation', 'Peripheral perfusion present, no immediately obvious circulatory collapse.');
  fillIfBlank('neuro', 'Mental status documented appropriately for presentation.');
  fillIfBlank('headNeck', 'No obvious acute head or neck findings.');
  fillIfBlank('chest', 'No obvious acute chest findings on initial assessment.');
  fillIfBlank('abdomen', 'Soft, non-tender, no obvious acute findings.');
  fillIfBlank('pelvis', 'Stable, no obvious tenderness, deformity, or instability.');
  fillIfBlank('extremities', 'No obvious deformity, major edema, or acute neurovascular deficit.');
  fillIfBlank('skin', 'Skin findings appropriate to presentation.');

  normalized.patientDemographics = demographics;
  normalized.physicalExam = exam;
  normalized.teachersPoints = normalizeTeachingParagraph(normalized.teachersPoints);
  normalized.learningObjectives = coerceArray(normalized.learningObjectives);
  normalized.vocationalLearningOutcomes = coerceArray(normalized.vocationalLearningOutcomes);
  normalized.selfReflectionPrompts = coerceArray(normalized.selfReflectionPrompts);
  normalized.additionalAssessments = coerceArray(normalized.additionalAssessments);
  normalized.expectedTreatment = coerceArray(normalized.expectedTreatment);
  normalized.protocolNotes = coerceArray(normalized.protocolNotes);
  normalized.medications = coerceArray(normalized.medications);
  normalized.allergies = coerceArray(normalized.allergies);
  normalized.pastMedicalHistory = coerceArray(normalized.pastMedicalHistory);
  normalized.instructorGuidance = normalized.instructorGuidance || defaultInstructorGuidance();
  normalized.instructorGuidance.instructorPriorities = coerceArray(normalized.instructorGuidance.instructorPriorities);
  normalized.instructorGuidance.psychologicalSafetyDebrief = normalizeTeachingParagraph(
    normalized.instructorGuidance.psychologicalSafetyDebrief
  );

  if (!normalized.instructorGuidance.psychologicalSafetyDebrief) {
    normalized.instructorGuidance.psychologicalSafetyDebrief =
      'Debrief this case around observable decisions, reassessment timing, communication, and next-call improvement. If learners anchored on an early impression, first identify why that frame was understandable, then name the specific findings that should have widened the differential or changed the plan.';
  }

  return normalized;
}

function normalizeScenario(parsed, options = {}) {
  const source = parsed && typeof parsed === 'object' ? parsed : {};
  const normalized = mergeDeepStrict(REQUIRED_FIELDS, source);

  normalized.learningObjectives = coerceArray(source.learningObjectives);
  normalized.vocationalLearningOutcomes = coerceArray(source.vocationalLearningOutcomes);
  normalized.selfReflectionPrompts = coerceArray(
    pickFirstDefined(source.selfReflectionPrompts, source.selfReflectiveQuestions)
  );
  normalized.additionalAssessments = coerceArray(source.additionalAssessments);
  normalized.expectedTreatment = coerceArray(source.expectedTreatment);
  normalized.protocolNotes = coerceArray(source.protocolNotes);

  // Post-generation scrub: remove items containing directive-forbidden terms
  const { semester: optSemester, type: optType, customPrompt: optCustomPrompt } = options;
  if (optSemester || optType) {
    const forbidden = buildForbiddenTreatmentTerms({
      semester: optSemester,
      type: optType,
      customPrompt: optCustomPrompt || '',
      title: normalized.title || '',
    });
    if (forbidden.length > 0) {
      const hasForbidden = (item) =>
        typeof item === 'string' && forbidden.some((f) => item.toLowerCase().includes(f));
      normalized.expectedTreatment = normalized.expectedTreatment.filter((item) => !hasForbidden(item));
      normalized.protocolNotes = normalized.protocolNotes.filter((item) => !hasForbidden(item));
    }
  }

  normalized.medications = coerceArray(source.medications);
  normalized.allergies = coerceArray(source.allergies);
  normalized.pastMedicalHistory = coerceArray(source.pastMedicalHistory);
  normalized.teachersPoints = normalizeTeachingParagraph(source.teachersPoints);

  const nestedFirstEcg = source?.vitalSigns?.firstSet?.ecgInterpretation;
  const nestedSecondEcg = source?.vitalSigns?.secondSet?.ecgInterpretation;
  const topLevelEcg = source?.ecgInterpretation;

  const ecgInterpretation = [nestedFirstEcg, nestedSecondEcg, topLevelEcg].find((value) =>
    ECG_WHITELIST.includes(value)
  );

  normalized.vitalSigns = normalizeVitalSigns(source.vitalSigns, ecgInterpretation);

  if (source.ecgFindings && typeof source.ecgFindings === "object") {
    normalized.ecgFindings = {
      ecgType: (source.ecgFindings.ecgType || "").toLowerCase().replace(/\s*-\s*/g, '-').trim(),
      rhythmInterpretation: source.ecgFindings.rhythmInterpretation || "",
      twelveLeadFindings: source.ecgFindings.twelveLeadFindings || "",
      fifteenLeadFindings: source.ecgFindings.fifteenLeadFindings || "",
      ecgClinicalNote: source.ecgFindings.ecgClinicalNote || "",
      patternKey: source.ecgFindings.patternKey || "",
    };
  }

  normalized.initialAssessment = normalizeInitialAssessment(source.initialAssessment);
  normalized.caseProgression = normalizeCaseProgression(source.caseProgression);
  normalized.transportPhase = normalizeTransportPhase(source.transportPhase);
  normalized.instructorGuidance = normalizeInstructorGuidance(source, normalized);
  normalized.clinicalReasoning = normalizeClinicalReasoning(source.clinicalReasoning);
  normalized.grsAnchors = normalizeGrsAnchors(source.grsAnchors);

  const patientDemographicsSource = pickFirstObject(source.patientDemographics);
  normalized.patientDemographics = patientDemographicsSource
    ? mergeDeepStrict(defaultPatientDemographics(), patientDemographicsSource)
    : defaultPatientDemographics();

  const chiefComplaint = pickFirstDefined(
    source?.patientDemographics?.chiefComplaint,
    source.chiefComplaint,
    source.chief_complaint,
    source.cc
  );

  if (chiefComplaint) {
    normalized.patientDemographics.chiefComplaint = chiefComplaint;
  }

  const physicalExamSource = pickFirstObject(
    source.physicalExam,
    source.physicalAssessment,
    source.exam,
    source.assessment
  );

  normalized.physicalExam = physicalExamSource
    ? mergeDeepStrict(defaultPhysicalExam(), physicalExamSource)
    : defaultPhysicalExam();

  if (options.customPrompt) {
    normalized.customPrompt = options.customPrompt;
  }

  return scrubEmDashesDeep(fillScenarioGaps(normalized, options));
}

function getEnvironmentInstruction(environment) {
  switch (environment) {
    case 'Urban':
      return [
        'Use a believable urban call context with realistic noise, access issues, nearby traffic, building layout, or public presence when relevant.',
        'Urban scenes should feel operationally busy but not chaotic unless complexity justifies it.',
        'Use city-specific scene realism such as elevators, apartment access, crowded sidewalks, bystanders, or delayed egress when appropriate.'
      ].join(' ');
    case 'Rural':
      return [
        'Use a believable rural context with longer transport considerations, fewer nearby resources, and more self-reliant scene management.',
        'Rural scenes should reflect distance, access limits, farming/property details, small community settings, or delayed backup when relevant.',
        'Let the rural setting influence decisions without making every case purely about transport time.'
      ].join(' ');
    case 'Wilderness':
      return [
        'Use a clearly remote setting with terrain, weather exposure, delayed extrication, limited equipment positioning, and difficult access.',
        'Wilderness scenes should meaningfully affect assessment, packaging, movement, and transport planning.',
        'Make the environment matter to the case, not just serve as background flavour.'
      ].join(' ');
    case 'Industrial':
      return [
        'Use an industrial setting with realistic PPE concerns, machinery hazards, confined spaces, noise, worksite layout, or supervisor/coworker involvement when relevant.',
        'Industrial scenes should feel structured and hazard-aware.',
        'Make scene safety, mechanism, and access control more important than in a standard home call.'
      ].join(' ');
    case 'Home':
      return [
        'Use a realistic residential setting with family dynamics, medications on scene, clutter, privacy issues, narrow workspaces, or emotional context when relevant.',
        'Home scenes should feel personal and lived-in rather than generic.',
        'Use the residence to support history gathering, collateral information, and practical movement challenges.'
      ].join(' ');
    case 'Public Space':
      return [
        'Use a public setting with realistic crowd pressure, embarrassment, noise, bystanders, visibility, and scene-control demands.',
        'Public scenes should affect communication, privacy, and patient cooperation when relevant.',
        'Make the public setting a real operational factor rather than a cosmetic label.'
      ].join(' ');
    default:
      return `Use the selected environment (${environment}) in a concrete, operationally meaningful way.`;
  }
}

function getComplexityInstruction(complexity) {
  switch (complexity) {
    case 'Simple':
      return [
        'Keep the case clean, teachable, and centered on one dominant problem.',
        'History should be reliable, mostly consistent, and straightforward to gather.',
        'Physical assessment findings should be clear and directly support the working diagnosis.',
        'Vital signs should be abnormal in a recognizable expected direction rather than borderline or ambiguous.',
        'The differential diagnosis should have one clear leading diagnosis and at most one plausible alternative.',
        'Avoid excessive branching, unusual combinations, or stacked complications.',
        'The educational value should come from doing the basics well, choosing the right treatment, and completing a clean reassessment loop.'
      ].join(' ');
    case 'Complex':
      return [
        'Layer the case with competing cues, clinical ambiguity, operational demands, or evolving deterioration.',
        'History should have gaps, inconsistencies, or competing explanations that require active clarification to resolve.',
        'Physical assessment findings should include at least one misleading or unexpected finding that requires interpretation rather than pattern-matching.',
        'Vital signs should be borderline, evolving, or only partially explained rather than clearly abnormal in one direction.',
        'The differential diagnosis should include at least two plausible competing diagnoses that require active reasoning to separate.',
        'Include at least one complicating factor such as a relevant comorbidity, a medication interaction, a contraindication decision point, a scene challenge, or a patient factor that changes management.',
        'Require stronger prioritization, reassessment, and differentiation between plausible problems.',
        'Use realistic uncertainty but do not make the scenario unfair or incoherent.',
        'The complexity should challenge organization, judgment, and transport and resource planning.'
      ].join(' ');
    default:
      return getComplexityInstruction(
        complexity === 'Complex' ? 'Complex' : 'Simple'
      );
  }
}

function getTypeInstruction(type) {
  switch (type) {
    case 'Medical':
      return [
        'Make this clearly a medical presentation driven by history, physiology, assessment findings, and evolving clinical reasoning.',
        'Do not let it drift into trauma unless trauma is clearly secondary and incidental.',
        'The main teaching value should come from assessment, interpretation, treatment decisions, and reassessment.'
      ].join(' ');
    case 'Trauma':
      return [
        'Make this clearly trauma-driven, with mechanism, scene context, injury pattern, and trauma priorities shaping the case.',
        'The mechanism and physical findings must align.',
        'Do not make it feel like a medical call wearing a trauma costume.'
      ].join(' ');
    case 'Cardiac':
      return [
        'Make this clearly cardiac in presentation, differential, and treatment priorities.',
        'The scenario should feel like a genuine cardiac call, not just a vague medical case with chest discomfort added.',
        'Ensure the vitals, symptoms, and ECG relevance all support the cardiac framing.'
      ].join(' ');
    case 'Respiratory':
      return [
        'Make this clearly respiratory, with breathing findings, work of breathing, oxygenation/ventilation concerns, and respiratory treatment priorities driving the case.',
        'The patient presentation should feel anchored in airway or breathing problems.',
        'Do not let the case become broadly medical unless a secondary issue truly matters.'
      ].join(' ');
    case 'Environmental':
      return [
        'Make the environmental exposure or setting central to the case physiology and scene management.',
        'The scenario should clearly depend on heat, cold, toxin, exposure, entrapment, or environment-linked factors.',
        'Do not make the environment feel interchangeable with a normal medical call.'
      ].join(' ');
    default:
      return `Make the scenario clearly and convincingly match the selected type: ${type}.`;
  }
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
        instructionText: 'This scenario is for a Semester 2 PCP learner. ' +
          'No medications must appear in expectedTreatment or protocolNotes. ' +
          'The case must be solvable through assessment, communication, ' +
          'positioning, oxygen decisions, and safe transport only. ' +
          'GRS anchors must not reference medication decisions, ' +
          'contraindication checks, or advanced directive knowledge. ' +
          'Score 5 represents a learner who is organized, communicates ' +
          'clearly, and completes a structured assessment safely. ' +
          'Do not make the case feel hand-held or patronizing, ' +
          'but do not hide the answer behind ambiguity.'
      };

    case '3':
      return {
        learnerLevel: 'Semester 3 PCP learner',
        medicationAccess: 'all clinically appropriate PCP medications available',
        presentationClarity: 'moderately clear',
        ambiguity: 'moderate',
        competingProblems: 'moderate',
        communicationBurden: 'moderate',
        sceneComplexity: 'moderate',
        reassessmentBurden: 'meaningful',
        leadershipDemand: 'moderate',
        expectedReasoning: 'directive interpretation, treatment selection, contraindication awareness, and reassessment with reasonable autonomy',
        instructionText: 'This scenario is for a Semester 3 PCP learner. ' +
          'PCP medications are available when clinically justified. ' +
          'The learner should recognize common patterns, initiate ' +
          'appropriate treatment, check contraindications, and reassess. ' +
          'Include at least one medication decision point when the type ' +
          'supports it. GRS score 5 represents a learner who acts ' +
          'correctly without being prompted, not one who needs coaching ' +
          'through each step. Allow realistic messiness but keep the ' +
          'case fair and teachable.'
      };

    case '4':
      return {
        learnerLevel: 'Semester 4 PCP learner',
        medicationAccess: 'all clinically appropriate PCP medications available',
        presentationClarity: 'less tidy',
        ambiguity: 'moderate to high',
        competingProblems: 'high',
        communicationBurden: 'high',
        sceneComplexity: 'high',
        reassessmentBurden: 'significant',
        leadershipDemand: 'high',
        expectedReasoning: 'advanced prioritization, contraindication recognition, destination thinking, leadership, and near-graduation call organization',
        instructionText: 'This scenario is for a Semester 4 PCP learner. ' +
          'This is a near-graduation learner. Do not hand-hold. ' +
          'The case should require prioritization under pressure, ' +
          'contraindication recognition, destination thinking, and ' +
          'leadership of a messy scene. ' +
          'GRS score 5 represents competent near-graduation performance. ' +
          'Score 7 requires anticipatory thinking, not just correct action. ' +
          'At least one decision should require withholding a treatment ' +
          'or adapting the plan based on reassessment findings. ' +
          'The case should feel like something a real crew would ' +
          'debrief after shift.'
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
        instructionText: `Tailor the case and expectations to Semester ${semester} learner level in a concrete way.`
      };
  }
}

function buildScenarioCore({ semester, type, environment, complexity, uniqueness, customPrompt }) {
  const typeLower = String(type || '').toLowerCase();
  const promptLower = String(customPrompt || '').toLowerCase();
  const semesterProfile = buildSemesterDifficultyProfile(semester);

  const pick = (items) => items[Math.floor(Math.random() * items.length)];

  const environmentSettings = {
    Urban: [
      'apartment building',
      'downtown sidewalk',
      'busy intersection',
      'shopping plaza',
      'restaurant',
      'transit stop'
    ],
    Rural: [
      'farm property',
      'country road shoulder',
      'small town residence',
      'remote cottage',
      'rural nursing station area',
      'barn or workshop'
    ],
    Wilderness: [
      'trailhead',
      'forest path',
      'campsite',
      'remote lakeside area',
      'hiking trail',
      'backcountry access point'
    ],
    Industrial: [
      'warehouse floor',
      'construction site',
      'factory break area',
      'loading dock',
      'machine shop',
      'industrial yard'
    ],
    Home: [
      'private residence',
      'apartment bedroom',
      'bathroom floor',
      'kitchen area',
      'living room',
      'front porch'
    ],
    'Public Space': [
      'arena concourse',
      'grocery store aisle',
      'community centre',
      'school hallway',
      'parking lot',
      'public washroom'
    ]
  };

  const uniquenessModifiers = {
    Common: [
      'straightforward presentation with familiar field cues',
      'recognizable training call with realistic detail',
      'common dispatch pattern with clear educational value'
    ],
    Varied: [
      'less routine setting or presentation style',
      'slightly less expected combination of context and complaint',
      'fresh but believable field presentation'
    ],
    'Rare/Obscure': [
      'rarer but still teachable presentation pattern',
      'less common field situation with fair clues',
      'unusual but realistic case framing'
    ]
  };

  let callFamily = 'general_medical';
  let likelyDiagnosis = 'undifferentiated_medical_complaint';
  let plausibleDifferentials = ['other reasonable differentials supported by presentation'];
  let symptomPattern = 'general medical presentation with believable field cues';
  let generalSetting = pick(environmentSettings[environment] || [environment]);
  let acuity = complexity === 'Complex' ? 'high' : complexity === 'Simple' ? 'low_to_moderate' : 'moderate';

  if (typeLower === 'cardiac' || promptLower.includes('chest pain') || promptLower.includes('palpitation') || promptLower.includes('cardiac arrest') || promptLower.includes('stemi') || promptLower.includes('arrhythmia')) {
    callFamily = pick([
      'acs_or_stemi',
      'dysrhythmia_or_palpitations',
      'cardiac_arrest_or_post_rosc',
      'heart_failure_or_pulmonary_edema',
      'hypertensive_emergency',
      'cardiac_syncope_or_near_syncope',
    ]);

    const cardiacSeeds = {
      acs_or_stemi: {
        diagnosis: pick(['inferior STEMI pattern', 'anterior STEMI pattern', 'lateral STEMI pattern', 'NSTEMI or unstable angina pattern', 'ACS with atypical presentation', 'Wellens syndrome concern', 'De Winter pattern']),
        differentials: ['ACS', 'pericarditis', 'pulmonary embolism'],
        pattern: pick(['chest pressure or discomfort with autonomic features, exertional context, and ECG-driven decision points', 'atypical ACS presentation with diaphoresis, nausea, and jaw or arm radiation', 'ischemic chest pain with contraindication decision points around nitroglycerin or ASA'])
      },
      dysrhythmia_or_palpitations: {
        diagnosis: pick(['SVT with rapid narrow complex tachycardia', 'atrial fibrillation with rapid ventricular response', 'atrial flutter with 2:1 block', 'symptomatic bradycardia from AV block or medication toxicity', 'ventricular tachycardia in a patient with structural heart disease']),
        differentials: ['SVT', 'atrial fibrillation', 'sinus tachycardia'],
        pattern: pick(['paroxysmal palpitations with abrupt onset and hemodynamic concern', 'irregular pulse with rapid rate and autonomic symptoms in a known cardiac patient', 'bradycardia with near-syncope and medication history suggesting toxicity'])
      },
      cardiac_arrest_or_post_rosc: {
        diagnosis: pick(['shockable cardiac arrest (VF or pulseless VT)', 'non-shockable cardiac arrest (PEA or asystole)', 'post-ROSC with hemodynamic instability']),
        differentials: ['VF arrest', 'PEA arrest', 'asystole'],
        pattern: pick(['witnessed cardiac arrest with bystander CPR and shockable rhythm requiring resuscitation decisions', 'unwitnessed arrest with unknown downtime and PEA requiring cause identification', 'post-ROSC patient with unstable hemodynamics and 12-lead interpretation'])
      },
      heart_failure_or_pulmonary_edema: {
        diagnosis: pick(['acute decompensated heart failure with pulmonary edema', 'cardiogenic pulmonary edema with severe respiratory distress', 'heart failure exacerbation with volume overload']),
        differentials: ['flash pulmonary edema', 'COPD exacerbation', 'pneumonia'],
        pattern: pick(['severe respiratory distress with frothy sputum, crackles, and a cardiac history', 'orthopnea and paroxysmal nocturnal dyspnea with bilateral crackles and elevated JVP', 'acute dyspnea in a known heart failure patient with ankle edema and medication non-compliance'])
      },
      hypertensive_emergency: {
        diagnosis: pick(['hypertensive emergency with end-organ involvement', 'severely elevated BP with neurologic or cardiac symptoms', 'hypertensive urgency with headache and visual changes']),
        differentials: ['hypertensive emergency', 'stroke', 'ACS'],
        pattern: pick(['severely elevated blood pressure with headache, visual changes, and altered mentation', 'hypertensive crisis in a patient with known hypertension who ran out of medications', 'elevated BP with chest pain requiring differentiation between hypertensive emergency and ACS'])
      },
      cardiac_syncope_or_near_syncope: {
        diagnosis: pick(['cardiac syncope from dysrhythmia', 'vasovagal syncope with cardiac risk factors requiring differentiation', 'orthostatic hypotension with near-syncope in a cardiac patient']),
        differentials: ['cardiac syncope', 'vasovagal syncope', 'orthostatic hypotension'],
        pattern: pick(['witnessed syncope in a patient with known cardiac history and palpitations before loss of consciousness', 'near-syncope with bradycardia in a patient on rate-controlling medications', 'syncope with prodrome of chest pain requiring ECG-driven differentiation'])
      }
    };

    const seed = cardiacSeeds[callFamily] || cardiacSeeds.acs_or_stemi;
    likelyDiagnosis = seed.diagnosis;
    plausibleDifferentials = seed.differentials;
    symptomPattern = seed.pattern;
  }
  else if (typeLower === 'respiratory' || promptLower.includes('shortness of breath') || promptLower.includes('asthma') || promptLower.includes('breathing')) {
    callFamily = pick([
      'asthma_or_bronchospasm',
      'copd_exacerbation',
      'pulmonary_embolism',
      'pneumonia_or_infection',
      'upper_airway_or_anaphylaxis',
      'flash_pulmonary_edema',
    ]);

    const respiratorySeeds = {
      asthma_or_bronchospasm: {
        diagnosis: pick(['acute asthma exacerbation', 'severe bronchospasm with poor air entry', 'exercise-induced bronchospasm']),
        differentials: ['asthma', 'COPD', 'anaphylaxis'],
        pattern: pick(['diffuse wheeze with prolonged expiration and poor air entry requiring bronchodilator decisions', 'asthma attack with accessory muscle use and SpO2 decline in a young patient', 'bronchospasm with incomplete response to first treatment requiring reassessment'])
      },
      copd_exacerbation: {
        diagnosis: pick(['COPD exacerbation with hypoxia', 'severe COPD with CO2 retention risk', 'COPD with infectious trigger']),
        differentials: ['COPD exacerbation', 'pneumonia', 'pulmonary edema'],
        pattern: pick(['severe dyspnea in a known COPD patient with oxygen titration decisions and tripod positioning', 'COPD exacerbation with cough, sputum, and fever requiring differentiation from pneumonia', 'respiratory distress in a barrel-chested patient requiring careful oxygen decisions to avoid CO2 retention'])
      },
      pulmonary_embolism: {
        diagnosis: pick(['pulmonary embolism with pleuritic chest pain', 'massive PE with hemodynamic instability', 'PE presenting as undifferentiated dyspnea']),
        differentials: ['pulmonary embolism', 'pneumonia', 'ACS'],
        pattern: pick(['sudden onset pleuritic chest pain and dyspnea in a post-surgical or immobile patient', 'tachycardia, hypoxia, and right heart strain on ECG with a Wells score concern', 'undifferentiated dyspnea with no wheeze and a deep vein thrombosis risk history'])
      },
      pneumonia_or_infection: {
        diagnosis: pick(['community-acquired pneumonia with hypoxia', 'aspiration pneumonia in a neurologically impaired patient', 'pneumonia with sepsis features']),
        differentials: ['pneumonia', 'pulmonary embolism', 'heart failure'],
        pattern: pick(['fever, productive cough, and focal crackles in an elderly patient with low oxygen', 'aspiration pneumonia in a patient with dysphagia or reduced consciousness', 'productive respiratory illness with systemic infection signs requiring sepsis consideration'])
      },
      upper_airway_or_anaphylaxis: {
        diagnosis: pick(['anaphylaxis with bronchospasm and airway compromise', 'croup with stridor in a pediatric patient', 'epiglottitis with drooling and high fever']),
        differentials: ['anaphylaxis', 'croup', 'foreign body aspiration'],
        pattern: pick(['acute bronchospasm and stridor after allergen exposure with urticaria and hypotension', 'pediatric stridor at rest with barking cough and seal-like quality requiring epinephrine consideration', 'adult with high fever, drooling, and muffled voice sitting upright who refuses to lie down'])
      },
      flash_pulmonary_edema: {
        diagnosis: pick(['flash pulmonary edema from acute cardiac decompensation', 'cardiogenic pulmonary edema in a hypertensive patient', 'pulmonary edema with severe hypoxia requiring CPAP consideration']),
        differentials: ['pulmonary edema', 'asthma', 'COPD'],
        pattern: pick(['sudden severe dyspnea at rest with frothy pink sputum, diaphoresis, and bilateral crackles', 'respiratory distress in a hypertensive cardiac patient requiring CPAP decision at Semester 3 or 4', 'acute pulmonary edema with SpO2 in the 80s requiring rapid treatment and transport decisions'])
      }
    };

    const seed = respiratorySeeds[callFamily] || respiratorySeeds.asthma_or_bronchospasm;
    likelyDiagnosis = seed.diagnosis;
    plausibleDifferentials = seed.differentials;
    symptomPattern = seed.pattern;
  }
  else if (typeLower === 'trauma' || promptLower.includes('fall') || promptLower.includes('collision') || promptLower.includes('injury') || promptLower.includes('trauma')) {
    callFamily = pick([
      'blunt_trauma_or_moi',
      'penetrating_trauma',
      'head_or_spinal_trauma',
      'chest_trauma',
      'abdominal_trauma',
      'burns_or_blast',
      'pediatric_trauma',
    ]);

    const traumaSeeds = {
      blunt_trauma_or_moi: {
        diagnosis: pick(['significant blunt trauma with multi-system injury concern', 'MVA mechanism with internal injury risk', 'fall from height with spinal and extremity concerns']),
        differentials: ['hemorrhagic shock', 'occult internal injury', 'spinal injury'],
        pattern: pick(['significant mechanism with vital sign instability and occult injury concern requiring transport priority decisions', 'blunt trauma with distracting injury and possible spinal concern requiring assessment discipline', 'MVA with multiple patients requiring scene management, triage, and priority decisions'])
      },
      penetrating_trauma: {
        diagnosis: pick(['penetrating abdominal trauma with internal bleeding concern', 'stab wound to the chest with pneumothorax risk', 'gunshot wound with hemorrhage and shock']),
        differentials: ['hemorrhagic shock', 'pneumothorax', 'tension pneumothorax'],
        pattern: pick(['penetrating abdominal injury with hemodynamic instability requiring rapid transport', 'stab wound to the chest with absent breath sounds and tracheal deviation concern', 'penetrating trauma with TXA decision point and transport urgency'])
      },
      head_or_spinal_trauma: {
        diagnosis: pick(['traumatic brain injury with altered GCS', 'cervical spine injury with mechanism and neurologic concern', 'intracranial bleed with Cushings triad signs']),
        differentials: ['TBI', 'intoxication', 'hypoglycemia masking neurologic injury'],
        pattern: pick(['head injury with declining GCS, Cushings response, and transport urgency without airway intervention at PCP scope', 'cervical spine mechanism with extremity paresthesia requiring immobilization and assessment discipline', 'altered consciousness after head trauma requiring hypoglycemia rule-out before attributing to injury'])
      },
      chest_trauma: {
        diagnosis: pick(['rib fractures with breathing compromise', 'pneumothorax from chest wall trauma', 'flail chest with paradoxical movement']),
        differentials: ['pneumothorax', 'rib fractures', 'hemothorax'],
        pattern: pick(['chest wall trauma with splinting, decreased breath sounds, and respiratory deterioration', 'blunt chest trauma with rib fractures and SpO2 decline requiring position and oxygen decisions', 'flail segment with paradoxical movement and increasing respiratory distress'])
      },
      abdominal_trauma: {
        diagnosis: pick(['blunt abdominal trauma with internal bleeding concern', 'seatbelt injury with hollow viscus risk', 'splenic injury from left-sided blunt trauma']),
        differentials: ['internal hemorrhage', 'hollow viscus injury', 'pelvic fracture'],
        pattern: pick(['abdominal tenderness after blunt mechanism with hemodynamic instability suggesting internal bleeding', 'lap belt mark with abdominal guarding in a restrained driver after moderate impact', 'left flank pain with hypotension after left-sided blunt trauma suggesting splenic injury'])
      },
      burns_or_blast: {
        diagnosis: pick(['thermal burns with airway concern', 'chemical exposure with skin and airway injury', 'blast injury with primary and secondary effects']),
        differentials: ['inhalation injury', 'chemical burn', 'blast lung'],
        pattern: pick(['facial burns with singed nasal hairs and hoarse voice requiring airway priority decisions', 'chemical exposure with skin and eye involvement requiring decontamination before patient contact', 'blast mechanism with multiple injury patterns and possible pneumothorax'])
      },
      pediatric_trauma: {
        diagnosis: pick(['pediatric trauma with weight-based assessment challenge', 'child fall with developmental inconsistency concern', 'pediatric MVA with occult injury risk']),
        differentials: ['significant pediatric trauma', 'non-accidental injury', 'spinal injury'],
        pattern: pick(['pediatric patient after significant mechanism with limited history and weight-based vital sign interpretation', 'child with injury pattern inconsistent with stated mechanism requiring careful documentation', 'pediatric MVA requiring age-appropriate assessment and communication with distressed caregivers'])
      }
    };

    const seed = traumaSeeds[callFamily] || traumaSeeds.blunt_trauma_or_moi;
    likelyDiagnosis = seed.diagnosis;
    plausibleDifferentials = seed.differentials;
    symptomPattern = seed.pattern;
  }
  else if (typeLower === 'environmental' || promptLower.includes('heat') || promptLower.includes('cold') || promptLower.includes('exposure')) {
    callFamily = pick([
      'heat_illness',
      'cold_exposure_or_hypothermia',
      'toxin_or_poisoning',
      'near_drowning',
      'altitude_or_diving',
    ]);

    const environmentalSeeds = {
      heat_illness: {
        diagnosis: pick(['heat stroke with altered mentation', 'heat exhaustion with dehydration', 'exertional heat illness in an athlete']),
        differentials: ['heat stroke', 'heat exhaustion', 'hypoglycemia'],
        pattern: pick(['hot dry skin and altered consciousness in an elderly patient found in an unventilated space', 'exertional heat illness in a summer athlete with collapse and confusion', 'heat exposure with hypotension, tachycardia, and inability to cool requiring rapid transport'])
      },
      cold_exposure_or_hypothermia: {
        diagnosis: pick(['moderate hypothermia with altered consciousness', 'severe hypothermia with cardiac risk', 'frostbite with local tissue injury']),
        differentials: ['hypothermia', 'hypoglycemia', 'CVA'],
        pattern: pick(['altered elderly patient found in a cold home with slow pulse and shivering absence', 'outdoor exposure with core temperature concern and Osborn J-wave ECG finding', 'frostbite with rewarming decisions and transport priority based on systemic temperature'])
      },
      toxin_or_poisoning: {
        diagnosis: pick(['opioid toxidrome with respiratory depression', 'stimulant toxidrome with tachycardia and agitation', 'organophosphate exposure with cholinergic features']),
        differentials: ['opioid overdose', 'stimulant toxidrome', 'hypoglycemia'],
        pattern: pick(['unresponsive patient with pinpoint pupils and slow respirations requiring toxidrome recognition', 'agitated tachycardic patient with stimulant toxidrome and hyperthermia', 'cholinergic toxidrome after pesticide exposure with SLUDGE features'])
      },
      near_drowning: {
        diagnosis: pick(['submersion injury with respiratory compromise', 'near-drowning with aspiration and hypoxia', 'cold water submersion with hypothermia and drowning']),
        differentials: ['submersion injury', 'hypothermia', 'cardiac arrest from drowning'],
        pattern: pick(['pulled from water with respiratory distress, cough, and decreasing SpO2', 'cold water submersion with cardiac arrest and hypothermia requiring resuscitation decisions', 'near-drowning in warm water with pulmonary edema developing during transport'])
      },
      altitude_or_diving: {
        diagnosis: pick(['decompression sickness after diving', 'altitude sickness with cerebral edema concern', 'arterial gas embolism from rapid ascent']),
        differentials: ['decompression sickness', 'stroke', 'inner ear injury'],
        pattern: pick(['diver with joint pain, rash, and neurologic symptoms after rapid ascent', 'hiker with severe headache and ataxia at high altitude requiring descent priority', 'post-dive altered consciousness with focal deficits requiring hyperbaric consultation transport'])
      }
    };

    const seed = environmentalSeeds[callFamily] || environmentalSeeds.heat_illness;
    likelyDiagnosis = seed.diagnosis;
    plausibleDifferentials = seed.differentials;
    symptomPattern = seed.pattern;
  }
  else if (typeLower === 'ob/peds' || typeLower === 'ob' || typeLower === 'peds' || promptLower.includes('obstetric') || promptLower.includes('pediatric') || promptLower.includes('pregnancy') || promptLower.includes('child') || promptLower.includes('infant') || promptLower.includes('labour') || promptLower.includes('labor')) {
    callFamily = pick([
      'obstetric_labour_or_delivery',
      'obstetric_complication',
      'pediatric_respiratory',
      'pediatric_medical',
      'pediatric_seizure',
      'neonatal_resuscitation',
    ]);

    const obPedsSeeds = {
      obstetric_labour_or_delivery: {
        diagnosis: pick(['active labour with imminent delivery', 'precipitous delivery in an uncontrolled setting', 'normal delivery with post-partum hemorrhage concern']),
        differentials: ['active labour', 'abruptio placentae', 'post-partum hemorrhage'],
        pattern: pick(['patient in active labour with contractions 2 minutes apart and urge to push requiring delivery preparation', 'precipitous delivery in a home or vehicle with neonate requiring assessment and APGAR evaluation', 'post-delivery patient with significant vaginal bleeding requiring uterine assessment and transport urgency'])
      },
      obstetric_complication: {
        diagnosis: pick(['pre-eclampsia with severe features', 'eclampsia with seizure activity', 'placental abruption with pain and bleeding', 'ectopic pregnancy with hemorrhagic shock']),
        differentials: ['pre-eclampsia', 'eclampsia', 'abruption'],
        pattern: pick(['pregnant patient with severe headache, visual changes, and elevated BP requiring eclampsia management', 'seizure in a pregnant patient requiring magnesium consideration at appropriate semester level', 'abdominal pain and vaginal bleeding in a pregnant patient with hemodynamic instability'])
      },
      pediatric_respiratory: {
        diagnosis: pick(['croup with inspiratory stridor', 'bronchiolitis in an infant with wheeze and apnea risk', 'pediatric asthma with severe distress', 'epiglottitis with drooling and high fever']),
        differentials: ['croup', 'bronchiolitis', 'foreign body aspiration'],
        pattern: pick(['barking cough and inspiratory stridor in a toddler with low-grade fever and mild distress', 'infant with diffuse wheeze, poor feeding, and SpO2 in the low 90s requiring positioning and transport decisions', 'child with sudden choking followed by stridor and unilateral decreased breath sounds'])
      },
      pediatric_medical: {
        diagnosis: pick(['febrile seizure in a toddler', 'pediatric hypoglycemia in a diabetic child', 'meningitis concern in a febrile infant', 'pediatric anaphylaxis after allergen exposure']),
        differentials: ['febrile seizure', 'meningitis', 'hypoglycemia'],
        pattern: pick(['brief tonic-clonic seizure in a febrile toddler with full recovery and parental anxiety requiring reassurance and transport decision', 'lethargic infant with high fever, bulging fontanelle, and rash requiring urgent transport consideration', 'pediatric anaphylaxis with epinephrine auto-injector decision and weight estimation'])
      },
      pediatric_seizure: {
        diagnosis: pick(['status epilepticus in a known epileptic child', 'first seizure in a school-age child', 'febrile seizure in a toddler with prolonged activity']),
        differentials: ['epilepsy', 'febrile seizure', 'hypoglycemia'],
        pattern: pick(['ongoing seizure in a child lasting more than 5 minutes requiring glucose check and seizure management', 'post-ictal child with history of epilepsy requiring medication history and reassessment', 'first-ever seizure in an older child with no fever requiring differentiation and safe transport'])
      },
      neonatal_resuscitation: {
        diagnosis: pick(['neonate requiring resuscitation after delivery', 'premature birth with respiratory depression', 'neonate with poor tone and apnea after delivery']),
        differentials: ['birth asphyxia', 'meconium aspiration', 'congenital anomaly'],
        pattern: pick(['neonate born at scene with no cry, poor tone, and apnea requiring APGAR assessment and stimulation decisions', 'premature delivery with small neonate requiring temperature management and rapid transport', 'meconium-stained fluid delivery requiring airway management decisions within PCP scope'])
      }
    };

    const seed = obPedsSeeds[callFamily] || obPedsSeeds.obstetric_labour_or_delivery;
    likelyDiagnosis = seed.diagnosis;
    plausibleDifferentials = seed.differentials;
    symptomPattern = seed.pattern;
  }
  else if (typeLower === 'medical') {
    callFamily = pick([
      'diabetic_or_metabolic',
      'infectious_or_sepsis',
      'nausea_vomiting_dehydration',
      'neurologic_or_syncope',
      'geriatric_multi_problem',
      'psych_or_behavioral',
      'toxicology_or_overdose',
      'renal_or_electrolyte',
      'gi_or_abdominal',
      'allergic_or_anaphylaxis',
    ]);

    const medicalSeeds = {
      diabetic_or_metabolic: {
        diagnosis: pick(['hypoglycemia with altered consciousness', 'hyperglycemia with DKA features', 'diabetic emergency with atypical presentation']),
        differentials: ['hypoglycemia', 'DKA', 'stroke'],
        pattern: pick(['altered diabetic patient with diaphoresis, shakiness, and low BGL requiring glucose decision', 'DKA presentation with Kussmaul breathing, fruity breath, and dehydration', 'diabetic patient with altered mental status where hypoglycemia and stroke overlap in presentation'])
      },
      infectious_or_sepsis: {
        diagnosis: pick(['sepsis with early shock features', 'septic shock with hemodynamic instability', 'systemic infection with undifferentiated presentation']),
        differentials: ['sepsis', 'dehydration', 'cardiac cause'],
        pattern: pick(['fever, tachycardia, altered mentation, and hypotension in an elderly patient with suspected source', 'sepsis pattern in a patient with urinary symptoms, confusion, and poor perfusion', 'undifferentiated deterioration in a nursing home patient requiring sepsis screening'])
      },
      nausea_vomiting_dehydration: {
        diagnosis: pick(['gastroenteritis with dehydration', 'nausea and vomiting with metabolic concern', 'dehydration with orthostatic hypotension']),
        differentials: ['gastroenteritis', 'appendicitis', 'bowel obstruction'],
        pattern: pick(['vomiting and diarrhea with significant dehydration and orthostatic vital signs', 'nausea in a diabetic patient requiring glucose check before antiemetic', 'dehydration with electrolyte concern in an elderly patient who cannot tolerate oral fluids'])
      },
      neurologic_or_syncope: {
        diagnosis: pick(['stroke or TIA with focal deficit', 'syncope requiring cardiac versus neurologic differentiation', 'seizure with post-ictal confusion']),
        differentials: ['stroke', 'hypoglycemia', 'syncope'],
        pattern: pick(['facial droop and arm drift in a patient with speech difficulty requiring FAST screen and stroke bypass decision', 'syncope in an older patient requiring ECG and cardiac differentiation from vasovagal', 'post-seizure confusion requiring glucose check and differentiation from ongoing neurologic event'])
      },
      geriatric_multi_problem: {
        diagnosis: pick(['geriatric fall with multiple comorbidities', 'undifferentiated decline in an elderly patient', 'polypharmacy complication in a geriatric patient']),
        differentials: ['sepsis', 'cardiac cause', 'medication toxicity'],
        pattern: pick(['elderly patient with weakness, confusion, and multiple medications requiring systematic history and sepsis screening', 'nursing home patient with undifferentiated decline and no clear chief complaint requiring structured assessment', 'geriatric patient with medication non-compliance and multiple system findings'])
      },
      psych_or_behavioral: {
        diagnosis: pick(['acute psychiatric presentation requiring safety assessment', 'agitation from unknown cause requiring medical rule-out', 'suicidal ideation with medical complication concern']),
        differentials: ['psychiatric emergency', 'hypoglycemia', 'toxicology'],
        pattern: pick(['agitated patient with unknown cause requiring medical rule-out before psychiatric framing', 'behaviorally disturbed patient where glucose, toxicology, and head injury must be excluded', 'patient with psychiatric history and altered consciousness requiring organic cause search'])
      },
      toxicology_or_overdose: {
        diagnosis: pick(['opioid overdose with respiratory depression', 'mixed drug ingestion with altered mentation', 'accidental medication overdose in an elderly patient']),
        differentials: ['opioid toxidrome', 'sedative overdose', 'hypoglycemia'],
        pattern: pick(['unresponsive patient with slow respirations and pinpoint pupils requiring toxidrome recognition and naloxone decision', 'altered patient with unknown ingestion requiring systematic toxidrome assessment', 'elderly patient with accidental medication overdose and bradycardia'])
      },
      renal_or_electrolyte: {
        diagnosis: pick(['missed dialysis with hyperkalemia', 'renal failure with volume overload', 'electrolyte disturbance with ECG changes']),
        differentials: ['hyperkalemia', 'uremia', 'pulmonary edema'],
        pattern: pick(['dialysis patient who missed treatment with weakness, peaked T waves, and bradycardia', 'renal failure with fluid overload and respiratory distress requiring careful oxygen decisions', 'electrolyte disturbance with ECG findings guiding transport urgency'])
      },
      gi_or_abdominal: {
        diagnosis: pick(['upper GI bleed with hemodynamic instability', 'acute abdomen requiring surgical evaluation', 'bowel obstruction with vomiting and distension']),
        differentials: ['GI hemorrhage', 'ruptured viscus', 'mesenteric ischemia'],
        pattern: pick(['hematemesis with tachycardia and hypotension requiring hemorrhagic shock management', 'severe abdominal pain with peritoneal signs requiring differentiation and transport priority', 'vomiting with distension and no bowel sounds in an elderly patient with prior abdominal surgery'])
      },
      allergic_or_anaphylaxis: {
        diagnosis: pick(['anaphylaxis with bronchospasm and hypotension', 'severe allergic reaction requiring epinephrine', 'anaphylaxis with delayed presentation after allergen exposure']),
        differentials: ['anaphylaxis', 'vasovagal syncope', 'asthma'],
        pattern: pick(['urticaria, bronchospasm, and hypotension after known allergen exposure requiring epinephrine decision', 'allergic reaction with airway involvement in a patient whose auto-injector was already used', 'biphasic anaphylaxis concern requiring extended monitoring and transport decision'])
      }
    };

    const seed = medicalSeeds[callFamily] || medicalSeeds.diabetic_or_metabolic;
    likelyDiagnosis = seed.diagnosis;
    plausibleDifferentials = seed.differentials;
    symptomPattern = seed.pattern;
  }

  const complexityProgression = {
    Simple: {
      withProperTreatment: 'clear improvement or stabilization with timely basic or directive-appropriate care',
      withoutProperTreatment: 'persistent symptoms, delayed improvement, or mild deterioration that remains teachable'
    },
    Moderate: {
      withProperTreatment: 'believable improvement with reassessment, though the patient may still need ongoing monitoring and transport',
      withoutProperTreatment: 'noticeable deterioration, poorer symptom control, or accumulating risk if care is delayed or incomplete'
    },
    Complex: {
      withProperTreatment: 'partial improvement or stabilization, but ongoing risk, reassessment demands, and transport urgency remain important',
      withoutProperTreatment: 'meaningful deterioration, rising instability, or increased operational and clinical risk if priorities are missed'
    }
  };

  const semesterFlavor =
    String(semester) === '2'
      ? 'clearer and more structured for an earlier learner'
      : String(semester) === '3'
        ? 'moderately messy with realistic but manageable decision points'
        : 'messier, less tidy, and more operationally demanding for a near-graduation learner';

  const uniquenessFlavor = pick(
    uniquenessModifiers[uniqueness] || ['realistic and internally coherent presentation']
  );

  return {
    semester,
    callFamily,
    likelyDiagnosis,
    plausibleDifferentials,
    patientContext: {
      environment,
      uniqueness,
      generalSetting,
      bystanderExpectation: 'determined separately by includeBystanders',
      sceneFlavor: `${uniquenessFlavor}; ${semesterFlavor}`
    },
    clinicalPresentation: {
      acuity,
      clarity: semesterProfile.presentationClarity,
      symptomPattern
    },
    progressionStyle: {
      withProperTreatment: complexityProgression[complexity]?.withProperTreatment || 'believable improvement or stabilization',
      withoutProperTreatment: complexityProgression[complexity]?.withoutProperTreatment || 'believable deterioration, delayed improvement, or persistent risk'
    }
  };
}
function buildMedicationPlan({ semester, type, customPrompt, scenarioCore }) {
  const typeLower = String(type || '').toLowerCase();
  const promptLower = String(customPrompt || '').toLowerCase();
  const callFamily = String(scenarioCore?.callFamily || '').toLowerCase();

  if (String(semester) === '2') {
    return {
      style: 'non-medication scenario by design',
      likelyMedicationOpportunities: [],
      contraindicationChecks: [],
      supportiveCareOpportunities: [
        'assessment',
        'scene management',
        'oxygen decision if clinically indicated',
        'serial reassessment',
        'positioning and packaging',
        'transport decision-making',
        'communication'
      ],
      oxygenGuidance: 'Use oxygen only if clinically indicated under current Ontario BLS PCS standards. Titrate to SpO2 92-96% for most patients.',
      instructionText: [
        'This is a non-medication scenario by design for Semester 2.',
        'Do not require medication administration to solve the case.',
        'Expected treatment should focus on assessment, supportive care, communication, oxygen decisions when indicated, reassessment, and transport.'
      ].join(' ')
    };
  }

  let medicationChance = 0.75;
  if (String(semester) === '4') medicationChance = 0.85;
  const includeMedication = Math.random() < medicationChance;

  if (!includeMedication) {
    return {
      style: 'supportive-care-dominant scenario',
      likelyMedicationOpportunities: [],
      contraindicationChecks: [],
      supportiveCareOpportunities: [
        'serial reassessment',
        'transport decision-making',
        'communication',
        'scene management',
        'oxygen decision based on clinical presentation'
      ],
      oxygenGuidance: 'Use oxygen only when clinically indicated. Titrate to SpO2 92-96% for most patients.',
      instructionText: [
        'This scenario should focus on assessment, decision making, reassessment, and transport planning rather than medications.',
        'It is acceptable and realistic that no medications are required in this case.'
      ].join(' ')
    };
  }

  // ── CARDIAC: ACS / STEMI ─────────────────────────────────────────────────
  if (callFamily.includes('acs_or_stemi') || promptLower.includes('chest pain') || promptLower.includes('stemi') || promptLower.includes('acs')) {
    return {
      style: 'cardiac ischemia medication decision scenario',
      likelyMedicationOpportunities: [
        'ASA 160-325mg when clinically indicated — apply directive as if no prior care rendered',
        'Nitroglycerin 0.4mg SL when BP supports it and conditions are met: prior history OR IV established',
        'Repeat nitroglycerin every 5 minutes if still symptomatic and BP allows, to a max of 3 doses',
        'Morphine only after 3rd nitroglycerin dose when pain is severe — ACP only in most cases; confirm scope'
      ],
      contraindicationChecks: [
        '12-lead ECG before nitroglycerin consideration — goal within first 10 minutes',
        'V4R if inferior STEMI identified — nitroglycerin contraindicated in RV STEMI',
        'Nitroglycerin contraindicated if SBP near 100 mmHg or tachycardia present',
        'Nitroglycerin contraindicated with PDE5 inhibitor use in past 48 hours (sildenafil, tadalafil, vardenafil, etc.)',
        'Do not resume nitroglycerin if vitals fall outside parameters even if they normalize',
        'ASA allergy or active GI bleed'
      ],
      supportiveCareOpportunities: [
        '12-lead and 15-lead ECG acquisition and interpretation',
        'serial reassessment of pain and vitals',
        'STEMI bypass or urgent transport destination decision',
        'IV access when nitroglycerin is planned for first-time ischemia'
      ],
      oxygenGuidance: 'Do not apply oxygen unless SpO2 falls below 94% or hypoxia is clinically evident. Cardiac ischemia alone is not an indication for oxygen.',
      instructionText: [
        'ECG drives the medication decision. 12-lead before nitroglycerin.',
        'For inferior STEMI, V4R is required before nitroglycerin to rule out RV involvement.',
        'Nitroglycerin for first-time suspected ischemia requires prior history OR an established IV.',
        'Do not give nitroglycerin in RV STEMI, with PDE5 inhibitors, or when SBP is near 100 mmHg or trending down.',
        'Once vitals fall outside directive parameters, do not resume that medication even if vitals normalize.'
      ].join(' ')
    };
  }

  // ── CARDIAC: DYSRHYTHMIA / PALPITATIONS ──────────────────────────────────
  if (callFamily.includes('dysrhythmia') || callFamily.includes('palpitation') || promptLower.includes('svt') || promptLower.includes('atrial fibrillation') || promptLower.includes('palpitation')) {
    return {
      style: 'tachydysrhythmia assessment and management scenario',
      likelyMedicationOpportunities: [
        'Modified Valsalva maneuver for stable SVT — PCP and ACP scope, requires base hospital authorization as PCP auxiliary',
        'Identify whether tachycardia is physiologic compensation (pain, hypovolemia, fever, hypoxia) — treat cause, not rhythm',
        '12-lead ECG to differentiate narrow vs wide complex tachycardia before any intervention'
      ],
      contraindicationChecks: [
        'Do not treat compensatory tachycardia with Valsalva or any rate-controlling intervention',
        'Wide complex tachycardia — adenosine and amiodarone are ACP only; PCP role is monitoring, 12-lead, and transport',
        'Hemodynamically unstable tachydysrhythmia — synchronized cardioversion is ACP with base hospital authorization',
        'SVT Treat and Discharge criteria require base hospital patch and specific eligibility — pregnant patients excluded from T&D'
      ],
      supportiveCareOpportunities: [
        '12-lead ECG acquisition and interpretation',
        'rhythm differentiation narrow vs wide complex',
        'hemodynamic assessment and serial vitals',
        'transport and destination decision',
        'ALS intercept consideration if unstable'
      ],
      oxygenGuidance: 'Oxygen only if hypoxia or hemodynamic compromise is present. Titrate to SpO2 92-96%.',
      instructionText: [
        'Confirm the tachycardia is not a compensatory response before treating it as a dysrhythmia.',
        '12-lead is essential for SVT vs other narrow complex vs wide complex differentiation.',
        'Modified Valsalva is the PCP intervention for stable SVT — requires base hospital authorization as auxiliary.',
        'Adenosine, amiodarone, cardioversion are ACP only. PCP role in unstable dysrhythmia is transport and ALS intercept.'
      ].join(' ')
    };
  }

  // ── CARDIAC: ARREST / POST-ROSC ──────────────────────────────────────────
  if (callFamily.includes('cardiac_arrest') || promptLower.includes('cardiac arrest') || promptLower.includes('arrest') || promptLower.includes('vsa')) {
    return {
      style: 'cardiac arrest resuscitation scenario',
      likelyMedicationOpportunities: [
        'Single dose IM epinephrine 1:1000 (1mg) ONLY if arrest is directly attributable to anaphylaxis — this is the only epinephrine indication within PCP scope for cardiac arrest',
        'Epinephrine IV/IO in cardiac arrest is ACP only — do NOT include this as a PCP treatment in expectedTreatment or protocolNotes',
        'Post-ROSC: fluid bolus 10ml/kg to max 1000ml if SBP below 90 and lungs clear',
        'Do not give naloxone in confirmed cardiac arrest — it has no routine role here'
      ],
      contraindicationChecks: [
        'Epinephrine timing: administer after first rhythm analysis and defibrillation attempt in shockable arrest',
        'No routine naloxone in confirmed cardiac arrest regardless of suspected opioid cause',
        'Post-ROSC oxygen: target SpO2 94-98%, avoid 100% — oxygen free radicals worsen outcome',
        'Post-ROSC ETCO2 target 30-40 mmHg — avoid hyperventilation',
        'Medical TOR criteria: patch after 20 minutes if considering termination',
        'Glucometry has no value in VSA patient — do not check BGL during arrest'
      ],
      supportiveCareOpportunities: [
        'high quality CPR with minimal interruptions',
        'early defibrillation for shockable rhythms',
        'rhythm interpretation every 2 minutes',
        'reversible cause identification using 4Hs and 4Ts',
        'supraglottic airway when indicated',
        'post-ROSC monitoring and transport'
      ],
      oxygenGuidance: 'During arrest: high concentration oxygen. Post-ROSC: titrate to SpO2 94-98%, avoid 100%.',
      instructionText: [
        'High quality CPR with minimal interruption is the priority.',
        'Epinephrine dose and timing must follow the medical cardiac arrest directive.',
        'No naloxone in confirmed arrest even if opioid cause is suspected.',
        'Post-ROSC targets: SpO2 94-98%, ETCO2 30-40 mmHg, SBP at or above 90 mmHg.',
        'Avoid hyperventilation post-ROSC.'
      ].join(' ')
    };
  }

  // ── CARDIAC: HEART FAILURE / PULMONARY EDEMA ─────────────────────────────
  if (callFamily.includes('heart_failure') || callFamily.includes('pulmonary_edema') || promptLower.includes('pulmonary edema') || promptLower.includes('heart failure')) {
    return {
      style: 'acute cardiogenic pulmonary edema scenario',
      likelyMedicationOpportunities: [
        'CPAP for severe respiratory distress with acute pulmonary edema — PCP auxiliary requires base hospital authorization',
        'Nitroglycerin under Acute Cardiogenic Pulmonary Edema directive — ECG not required before first dose in this directive',
        'ASA if concurrent cardiac ischemia is suspected — patient may receive nitroglycerin from ACPE directive and ASA from cardiac ischemia directive',
        'Patient cannot receive nitroglycerin from both ACPE and cardiac ischemia directives — one directive only'
      ],
      contraindicationChecks: [
        'Confirm cardiogenic versus non-cardiogenic pulmonary edema — nitroglycerin only for cardiogenic',
        'CPAP is appropriate for non-cardiogenic pulmonary edema as well as cardiogenic',
        'If STEMI identified on ECG, follow cardiac ischemia directive nitroglycerin schedule (max 3 doses)',
        'If nitroglycerin causes hypotension, withhold further doses — fluid bolus permitted despite crackles in this situation',
        'Salbutamol may be considered if wheezing is present — wheezing in early pulmonary edema may be from airway edema not bronchospasm'
      ],
      supportiveCareOpportunities: [
        '12-lead ECG acquisition as soon as possible',
        'positioning upright or semi-recumbent',
        'oxygen titration',
        'serial reassessment of respiratory status',
        'CPAP initiation and titration when authorized'
      ],
      oxygenGuidance: 'High concentration oxygen appropriate given hypoxia typically present. Titrate once stable.',
      instructionText: [
        'CPAP is a key intervention for acute cardiogenic pulmonary edema at PCP auxiliary level with base hospital authorization.',
        'Nitroglycerin does not require ECG before first dose under the ACPE directive — acquire ECG as soon as possible.',
        'Do not double-count nitroglycerin across two directives.',
        'If nitroglycerin causes hypotension, stop further doses and consider fluid bolus even with crackles present.'
      ].join(' ')
    };
  }

  // ── CARDIAC: SYNCOPE ─────────────────────────────────────────────────────
  if (callFamily.includes('syncope') || promptLower.includes('syncope') || promptLower.includes('faint')) {
    return {
      style: 'syncope assessment scenario',
      likelyMedicationOpportunities: [
        '12-lead ECG to evaluate for dysrhythmia or ischemic cause',
        'Oral glucose or glucagon if hypoglycemia identified as contributing cause',
        'No routine medication for vasovagal syncope — focus is on cause identification'
      ],
      contraindicationChecks: [
        'Rule out cardiac, hypoglycemic, and neurologic causes before accepting vasovagal diagnosis',
        'Check BGL in any altered or post-syncopal patient with diabetes history',
        '12-lead ECG before any cardiac medication decision'
      ],
      supportiveCareOpportunities: [
        'structured cause differentiation',
        'BGL check',
        '12-lead ECG',
        'serial reassessment and vital trend monitoring',
        'transport decision based on etiology'
      ],
      oxygenGuidance: 'Oxygen only if hypoxia or hemodynamic compromise present.',
      instructionText: [
        'Syncope requires active cause identification not passive reassurance.',
        'BGL and 12-lead ECG are the two most important investigations before a disposition decision.'
      ].join(' ')
    };
  }

  // ── RESPIRATORY ──────────────────────────────────────────────────────────
  if (typeLower === 'respiratory' || callFamily.includes('respiratory') || promptLower.includes('asthma') || promptLower.includes('shortness of breath') || promptLower.includes('breathing')) {

    if (callFamily.includes('asthma') || callFamily.includes('bronchospasm')) {
      return {
        style: 'asthma bronchospasm medication scenario',
        likelyMedicationOpportunities: [
          'Epinephrine IM (asthmatics only) for severe bronchoconstriction when life threat is present',
          'Salbutamol immediately following epinephrine for asthmatics',
          'Salbutamol MDI or nebulized for moderate bronchospasm',
          'Dexamethasone to reduce morbidity — not immediate rescue, does not have fast onset'
        ],
        contraindicationChecks: [
          'Epinephrine is for asthmatics only — not for COPD',
          'CPAP is for COPD only — not for asthma',
          'Dexamethasone has no immediate life-saving effect — do not frame it as primary rescue',
          'Watch for air trapping and fatigue — allow adequate expiratory phase if ventilating',
          'For COPD or asthma patients in respiratory failure with initial ETCO2 above 50 mmHg, maintain ETCO2 50-60 mmHg'
        ],
        supportiveCareOpportunities: [
          'positioning',
          'oxygen titration to SpO2 92-96%',
          'serial reassessment after bronchodilator',
          'work of breathing trend monitoring',
          'fatigue recognition and transport escalation'
        ],
        oxygenGuidance: 'Titrate oxygen to SpO2 92-96%. Avoid unnecessary high-flow oxygen.',
        instructionText: [
          'Epinephrine is for asthmatics only — never for COPD.',
          'CPAP is for COPD only — never for asthma.',
          'Salbutamol should follow epinephrine immediately in asthmatic patients.',
          'Dexamethasone reduces morbidity but is not a rescue medication.',
          'Watch for fatigue and silent chest — these are late findings requiring immediate escalation.'
        ].join(' ')
      };
    }

    if (callFamily.includes('copd')) {
      return {
        style: 'COPD exacerbation medication scenario',
        likelyMedicationOpportunities: [
          'Salbutamol MDI or nebulized as first-line bronchodilator',
          'Ipratropium may be added per local service protocol',
          'Dexamethasone to reduce morbidity',
          'CPAP for severe COPD respiratory distress — PCP auxiliary requires base hospital authorization'
        ],
        contraindicationChecks: [
          'CPAP is appropriate for COPD — not for asthma',
          'Epinephrine is not for COPD — asthmatics only',
          'For initial ETCO2 above 50 mmHg in respiratory failure, target ETCO2 50-60 mmHg to prevent worsening hypercapnia',
          'Oxygen titration to SpO2 88-92% for known COPD patients to avoid CO2 retention'
        ],
        supportiveCareOpportunities: [
          'positioning upright or tripod',
          'oxygen titration to SpO2 88-92%',
          'ETCO2 monitoring and trending',
          'serial reassessment after bronchodilator',
          'CPAP consideration when authorized'
        ],
        oxygenGuidance: 'Titrate oxygen to SpO2 88-92% for known COPD. Avoid high-concentration oxygen unless no reliable SpO2.',
        instructionText: [
          'Oxygen target for COPD is 88-92% not the general 92-96% target.',
          'CPAP is appropriate for COPD and requires base hospital authorization at PCP auxiliary level.',
          'Epinephrine has no role in COPD.'
        ].join(' ')
      };
    }

    if (callFamily.includes('pulmonary_embolism')) {
      return {
        style: 'suspected pulmonary embolism scenario',
        likelyMedicationOpportunities: [
          'Oxygen for hypoxia — titrate to SpO2 92-96%',
          'Analgesia if pleuritic chest pain is significant and patient meets directive conditions',
          'No specific PE reversal medication at PCP scope — supportive care and transport priority'
        ],
        contraindicationChecks: [
          'Do not give nitroglycerin for PE-related chest pain — not cardiac ischemia',
          'Consider right heart strain on ECG before any cardiac medication',
          '12-lead ECG to support clinical picture'
        ],
        supportiveCareOpportunities: [
          'oxygen titration',
          'positioning upright',
          '12-lead ECG',
          'serial vital sign monitoring',
          'urgent transport to capable facility'
        ],
        oxygenGuidance: 'Oxygen for hypoxia, titrate to SpO2 92-96%.',
        instructionText: [
          'PE is primarily a transport and supportive care call at PCP scope.',
          'Do not treat PE chest pain with nitroglycerin.',
          'ECG may show right heart strain pattern — this supports clinical reasoning but does not change PCP treatment.'
        ].join(' ')
      };
    }

    return {
      style: 'respiratory medication decision scenario',
      likelyMedicationOpportunities: [
        'Salbutamol if bronchospasm is present and clinically supported',
        'Dexamethasone if inflammatory component is present',
        'Epinephrine for asthmatics only if severe bronchospasm',
        'CPAP for COPD or pulmonary edema if authorized'
      ],
      contraindicationChecks: [
        'Confirm asthma versus COPD — treatment logic differs',
        'Epinephrine for asthma only',
        'CPAP for COPD and pulmonary edema only — not asthma',
        'Reassess after each treatment'
      ],
      supportiveCareOpportunities: ['positioning', 'oxygen titration', 'serial reassessment', 'transport escalation'],
      oxygenGuidance: 'Titrate oxygen to SpO2 92-96% general, 88-92% for known COPD.',
      instructionText: ['Respiratory treatment decisions should be earned by the presentation. Reassessment after treatment matters.'].join(' ')
    };
  }

  // ── DIABETIC / METABOLIC ─────────────────────────────────────────────────
  if (callFamily.includes('diabetic') || promptLower.includes('hypogly') || promptLower.includes('glucagon') || promptLower.includes('blood sugar')) {
    return {
      style: 'hypoglycemia medication decision scenario',
      likelyMedicationOpportunities: [
        'Oral glucose when patient is alert enough to swallow safely — use 15g simple carbohydrates, 15-15 rule',
        'Glucagon IM or intranasal (Baqsimi 3mg) when patient cannot safely swallow',
        'Dextrose IV (D10W or D50W) if IV is established and patient cannot take oral or glucagon has failed',
        'Reassess BGL after treatment before determining further care'
      ],
      contraindicationChecks: [
        'Oral glucose requires intact swallowing and alertness — do not give if unsafe to swallow',
        'If glucagon was given with no improvement and IV subsequently established, administer dextrose regardless of time elapsed since glucagon',
        'Do not give multiple doses of same medication — transport if two doses of glucagon or dextrose required',
        'Treat and discharge criteria require confirmed improvement, safe to care for self, follow up plan, and base hospital patch'
      ],
      supportiveCareOpportunities: [
        'BGL confirmation before and after treatment',
        'swallowing safety assessment',
        'serial reassessment of mental status',
        'transport decision even after improvement if insulin-dependent or cause unclear'
      ],
      oxygenGuidance: 'Oxygen only if hypoxia or altered consciousness with airway concern.',
      instructionText: [
        'The real decision is oral glucose versus glucagon versus dextrose — it depends on level of consciousness and swallowing safety.',
        'Reassess BGL after treatment.',
        'Transport even after improvement if the cause is unclear or the patient is insulin-dependent.',
        'Treat and discharge requires specific criteria and a base hospital patch.'
      ].join(' ')
    };
  }

  // ── ALLERGIC / ANAPHYLAXIS ───────────────────────────────────────────────
  if (callFamily.includes('allergic') || callFamily.includes('anaphylaxis') || promptLower.includes('anaphylaxis') || promptLower.includes('allergic reaction') || promptLower.includes('epinephrine')) {
    return {
      style: 'anaphylaxis or allergic reaction medication scenario',
      likelyMedicationOpportunities: [
        'Epinephrine 1:1000 IM 0.01mg/kg to max 0.5mg — anterolateral mid-thigh preferred site',
        'Diphenhydramine IV or IM as secondary treatment — does not prevent upper airway edema or shock',
        'Salbutamol for bronchospasm not responsive to epinephrine — adjunctive only',
        'IV fluid bolus if severe hypotension persists after epinephrine',
        'Repeat epinephrine if symptoms return or fail to respond — patients with diaphoresis, flushing, or dyspnea may need multiple doses'
      ],
      contraindicationChecks: [
        'Diphenhydramine is not a substitute for epinephrine — do not delay epinephrine to give diphenhydramine',
        'Dexamethasone has no role in prehospital anaphylaxis — little evidence of benefit',
        'Watch for biphasic reaction — symptoms can return 1 to 48 hours after initial resolution without re-exposure',
        'Salbutamol is adjunctive to epinephrine — does not address upper airway edema',
        'Epinephrine via auto-injector is valid — consider additional doses if patient already used theirs'
      ],
      supportiveCareOpportunities: [
        'airway assessment and monitoring',
        'positioning',
        'oxygen for hypoxia',
        'serial reassessment for biphasic reaction',
        'transport even after improvement — biphasic risk'
      ],
      oxygenGuidance: 'Oxygen for hypoxia and respiratory compromise. Titrate to SpO2 92-96%.',
      instructionText: [
        'Epinephrine is the primary treatment — administer as soon as anaphylaxis is recognized.',
        'Diphenhydramine is secondary and does not replace epinephrine.',
        'Dexamethasone is not part of prehospital anaphylaxis management.',
        'Biphasic reactions can occur up to 48 hours after resolution — transport and monitoring are essential.',
        'Salbutamol for bronchospasm not responding to epinephrine — adjunctive only.'
      ].join(' ')
    };
  }

  // ── OPIOID TOXICITY ──────────────────────────────────────────────────────
  if (callFamily.includes('toxicology') || callFamily.includes('overdose') || promptLower.includes('overdose') || promptLower.includes('naloxone') || promptLower.includes('opioid')) {
    return {
      style: 'opioid toxicity medication scenario',
      likelyMedicationOpportunities: [
        'Naloxone intranasal or IM — titrate to adequate respirations not full reversal',
        'Ventilation support is the priority before medication administration',
        'Buprenorphine/naloxone (Suboxone) for opioid withdrawal if COWS score criteria met'
      ],
      contraindicationChecks: [
        'Do not give naloxone in confirmed cardiac arrest — no routine role',
        'Titrate naloxone to restore breathing — avoid precipitating acute withdrawal from full reversal',
        'Watch for re-sedation — long-acting opioids outlast naloxone duration',
        'Mixed overdose: naloxone may unmask stimulant toxidrome — watch for seizures, agitation, hypertensive crisis after reversal',
        'Methadone patients — naloxone can precipitate severe withdrawal',
        'Naloxone age condition: patient must be 24 hours or older'
      ],
      supportiveCareOpportunities: [
        'airway management and ventilation support',
        'oxygen titration',
        'serial reassessment for re-sedation',
        'transport even after apparent reversal',
        'harm reduction communication'
      ],
      oxygenGuidance: 'Ventilation support is the priority. Oxygen titrated to maintain adequate SpO2.',
      instructionText: [
        'Ventilation before medication — airway management is the priority.',
        'Titrate naloxone to restore breathing, not to full reversal — avoid precipitating withdrawal.',
        'Re-sedation risk is real — transport even after apparent improvement.',
        'Naloxone has no role in confirmed cardiac arrest.'
      ].join(' ')
    };
  }

  // ── RENAL / ELECTROLYTE ──────────────────────────────────────────────────
  if (callFamily.includes('renal') || callFamily.includes('electrolyte') || promptLower.includes('dialysis') || promptLower.includes('hyperkalemia') || promptLower.includes('potassium')) {
    return {
      style: 'renal or electrolyte emergency scenario',
      likelyMedicationOpportunities: [
        'Calcium gluconate IV 1g over 3 minutes for severe hyperkalemia with ECG changes — ACP only; PCP role is recognition and transport',
        'Salbutamol in large doses may temporarily shift potassium intracellularly — ACP context',
        'Home dialysis emergency disconnect per directive if applicable',
        'PCP role: recognize ECG changes, manage symptoms, urgent transport with pre-alert'
      ],
      contraindicationChecks: [
        'Calcium gluconate is ACP only — do not include as PCP treatment',
        'Sodium bicarbonate is not effective for hyperkalemia and should not be routinely given — patch point for BHP if considered',
        'Ensure IV line is patent — calcium gluconate causes necrosis if it extravasates',
        'Serial 12-lead ECG before and after treatment to measure ECG changes'
      ],
      supportiveCareOpportunities: [
        '12-lead ECG for hyperkalemia recognition',
        'serial vital sign monitoring',
        'IV access for transport preparation',
        'urgent transport with pre-alert to receiving facility',
        'home dialysis disconnect if indicated'
      ],
      oxygenGuidance: 'Oxygen for hypoxia or hemodynamic instability.',
      instructionText: [
        'Hyperkalemia recognition from ECG changes is the key PCP skill — peaked T waves, widening QRS, loss of P waves.',
        'Calcium gluconate is ACP only — PCP role is recognition, IV access, and urgent transport.',
        'Serial 12-lead ECG changes guide urgency and pre-alert framing.'
      ].join(' ')
    };
  }

  // ── NEUROLOGIC / SYNCOPE / STROKE ────────────────────────────────────────
  if (callFamily.includes('neurologic') || callFamily.includes('syncope') || promptLower.includes('stroke') || promptLower.includes('seizure') || promptLower.includes('syncope')) {
    return {
      style: 'neurologic assessment and medication scenario',
      likelyMedicationOpportunities: [
        'Oral glucose or glucagon if hypoglycemia is confirmed or strongly suspected — always check BGL in altered consciousness',
        'Oxygen if hypoxic — not routine for suspected stroke without hypoxia',
        'Seizure: no PCP medication at core level — protect from injury, position, oxygen, reassess',
        'Seizure treat and discharge: specific BHP-authorized criteria for confirmed epilepsy with single seizure and meets all conditions'
      ],
      contraindicationChecks: [
        'Confirm BGL before attributing altered consciousness to neurologic cause',
        'Do not give nitroglycerin for suspected stroke — not cardiac ischemia',
        'Stroke bypass decision: FAST positive with last known well time within window',
        'Seizure medication (midazolam) is ACP only — do not include at PCP core level',
        'Seizure treat and discharge requires confirmed epilepsy diagnosis, single seizure, full recovery, specific eligibility, and BHP patch'
      ],
      supportiveCareOpportunities: [
        'BGL check',
        'FAST and CPSS neurologic screening',
        '12-lead ECG if cardiac cause suspected',
        'stroke bypass decision and destination',
        'airway positioning and protection',
        'serial reassessment of LOC'
      ],
      oxygenGuidance: 'Oxygen for hypoxia only. Avoid routine oxygen in suspected stroke without documented hypoxia.',
      instructionText: [
        'BGL must be checked before attributing altered consciousness to stroke or seizure.',
        'Stroke requires FAST screening and bypass destination decision.',
        'Seizure medication is ACP only at PCP core level.',
        'Seizure treat and discharge requires confirmed epilepsy, specific criteria, full recovery, and BHP patch.'
      ].join(' ')
    };
  }

  // ── TRAUMA ────────────────────────────────────────────────────────────────
  if (typeLower === 'trauma' || callFamily.includes('trauma')) {
    return {
      style: 'trauma pain and hemorrhage management scenario',
      likelyMedicationOpportunities: [
        'Acetaminophen or ibuprofen oral first-line if patient can tolerate oral medication',
        'Ketorolac IM or IV for moderate to severe pain — do not combine with ibuprofen',
        'Morphine IV or IM for significant pain — aliquots every 3 minutes to max single dose, may repeat after 15 minutes',
        'FentaNYL IV or IM for severe trauma pain — preferred when hemodynamic stability is a concern, aliquots every 5 minutes',
        'Ketamine IV or IM for hypotensive patients or when opioids are contraindicated — administer over 2-3 minutes',
        'TXA 1g IV over 5 minutes (or IM if IV not available) for suspected significant traumatic hemorrhage — PCP auxiliary, base hospital authorization required, do not delay transport'
      ],
      contraindicationChecks: [
        'Do not combine ketorolac and ibuprofen — both NSAIDs, increased adverse effects',
        'Consider active uncontrolled hemorrhage before analgesia — control bleeding first',
        'Hypotension: ketamine preferred over opioids — opioids can worsen hypotension',
        'TXA eligibility: suspected significant hemorrhage, protocol timing window, within PCP auxiliary authorization',
        'TXA should not delay transport and not prioritized over management of reversible causes',
        'Ontario SMR criteria: age over 65 with fall mechanism requires SMR regardless of apparent injury severity'
      ],
      supportiveCareOpportunities: [
        'hemorrhage control — direct pressure, wound packing, tourniquet',
        'SMR decision-making',
        'splinting',
        'shock recognition and transport priority',
        'destination decision'
      ],
      oxygenGuidance: 'Oxygen for hypoxia, respiratory compromise, or hemorrhagic shock. Titrate to SpO2 92-96%.',
      instructionText: [
        'Oral analgesia first if tolerated — acetaminophen and ibuprofen together approximate low-dose opioid effect.',
        'Do not combine ketorolac and ibuprofen.',
        'Ketamine is preferred when opioids are contraindicated — hypotension or hemorrhagic shock risk.',
        'TXA is an established PCP auxiliary intervention for suspected significant traumatic hemorrhage — IM or IV, do not delay transport for it.',
        'Renal colic patients should routinely be considered for NSAID in addition to opioid.'
      ].join(' ')
    };
  }

  // ── NAUSEA / VOMITING ────────────────────────────────────────────────────
  if (callFamily.includes('nausea') || promptLower.includes('nausea') || promptLower.includes('vomit')) {
    return {
      style: 'nausea and vomiting antiemetic scenario',
      likelyMedicationOpportunities: [
        'Dimenhydrinate (Gravol) IV or IM — first-line antiemetic per directive',
        'Ondansetron if dimenhydrinate given with no relief after 30 minutes and patient still meets conditions',
        'Not every patient with nausea requires medication — presentation must support it'
      ],
      contraindicationChecks: [
        'Do not combine dimenhydrinate with diphenhydramine — combined anticholinergic effect and over-sedation risk',
        'Do not combine ondansetron with apomorphine — risk of profound hypotension',
        'Dimenhydrinate: caution in elderly — somnolence and confusion risk',
        'Dimenhydrinate contraindicated with antihistamine overdose, anticholinergic overdose, or TCA overdose',
        'Dimenhydrinate: avoid with head injuries — increased ICP risk',
        'Ondansetron better choice when patient is on SSRIs, or head trauma is present, or elderly'
      ],
      supportiveCareOpportunities: [
        'identify underlying cause of nausea before treating symptom',
        'BGL check in diabetic patients before antiemetic',
        'hydration assessment',
        'transport decision',
        'reassessment after treatment'
      ],
      oxygenGuidance: 'Oxygen only if clinically indicated.',
      instructionText: [
        'Not every nausea patient needs medication — presentation and cause must support it.',
        'Dimenhydrinate first, ondansetron after 30 minutes without relief if still eligible.',
        'Never combine dimenhydrinate with diphenhydramine.',
        'Ondansetron preferred in elderly, head trauma, SSRI patients.',
        'Check glucose in any diabetic patient before giving antiemetic.'
      ].join(' ')
    };
  }

  // ── OB/PEDS ──────────────────────────────────────────────────────────────
  if (typeLower === 'ob/peds' || typeLower === 'ob' || typeLower === 'peds' || callFamily.includes('obstetric') || callFamily.includes('pediatric') || callFamily.includes('neonatal')) {

    if (callFamily.includes('obstetric_labour') || callFamily.includes('obstetric_complication')) {
      return {
        style: 'obstetric medication and procedural scenario',
        likelyMedicationOpportunities: [
          'Oxytocin IM or IV immediately after delivery of all fetuses and/or placenta and up to 4 hours post-placenta — for post-partum hemorrhage prevention and management',
          'External uterine massage after placenta delivery if fundus is soft or boggy',
          'External bimanual compression if uterine massage is unsuccessful',
          'Oxygen for maternal hypoxia or fetal distress concern'
        ],
        contraindicationChecks: [
          'Oxytocin can induce vasoconstriction — use caution in hypertensive patients',
          'Do not perform internal vaginal exam to determine cervical dilation',
          'Perineal inspection is appropriate in specific clinical situations per directive criteria',
          'Prolapsed cord: knee-chest or exaggerated Sims position, manual elevation of presenting part, maintain until transfer of care',
          'Breach delivery: hands off until delivered to umbilicus, maximum 4 minutes from umbilicus to head delivery'
        ],
        supportiveCareOpportunities: [
          'delivery preparation and positioning',
          'fetal and maternal monitoring',
          'APGAR assessment',
          'newborn resuscitation readiness',
          'hemorrhage control',
          'transport with pre-alert'
        ],
        oxygenGuidance: 'Oxygen for maternal hypoxia. During delivery, oxygen readiness for neonate.',
        instructionText: [
          'Oxytocin is now a standard part of the emergency childbirth directive for post-partum hemorrhage.',
          'Prolapsed cord and breech delivery have specific procedural directives with detailed steps.',
          'Newborn resuscitation preparedness is essential for any delivery scenario.'
        ].join(' ')
      };
    }

    if (callFamily.includes('pediatric_respiratory') || callFamily.includes('pediatric_medical') || callFamily.includes('pediatric_seizure')) {
      return {
        style: 'pediatric medication scenario',
        likelyMedicationOpportunities: [
          'Epinephrine nebulized for croup — racemic or 1:1000 — severe presentations only, dexamethasone for mild to moderate',
          'Dexamethasone for mild to moderate croup',
          'Epinephrine IM for pediatric anaphylaxis — 0.01mg/kg to max 0.5mg',
          'Oral glucose or glucagon for pediatric hypoglycemia',
          'Naloxone for suspected opioid toxicity — age 24 hours or older',
          'Salbutamol for pediatric asthma or bronchoconstriction'
        ],
        contraindicationChecks: [
          'Weight-based dosing is critical — estimate weight carefully for all pediatric medications',
          'Epinephrine for croup: severe presentations only — prior moist or cold air attempt if mild to moderate',
          'Seizure medication (midazolam) is ACP only at PCP core level',
          'Croup increasingly occurring in older patients including adults — if indications met, patch to BHP required',
          'If patient has received systemic steroids in past 48 hours, additional dexamethasone unlikely to help'
        ],
        supportiveCareOpportunities: [
          'weight estimation for dosing',
          'positioning for respiratory distress',
          'oxygen titration',
          'temperature management',
          'caregiver communication and reassurance',
          'transport priority assessment'
        ],
        oxygenGuidance: 'Pediatric oxygen targets same as adults: 92-96% general. Neonates: titrate based on SpO2 chart in directive.',
        instructionText: [
          'Weight-based dosing is the central challenge in pediatric medication scenarios.',
          'Croup: epinephrine for severe, dexamethasone for mild to moderate.',
          'Seizure medication is ACP — PCP core role is protection, positioning, oxygen, glucose check.',
          'Caregiver communication is a major teaching point in pediatric scenarios.'
        ].join(' ')
      };
    }

    if (callFamily.includes('neonatal')) {
      return {
        style: 'neonatal resuscitation scenario',
        likelyMedicationOpportunities: [
          'Ventilation with BVM and room air or 100% oxygen based on SpO2 chart in directive',
          'Stimulation and drying as primary interventions',
          'Oxygen based on SpO2 targets in directive — titrate to pre-ductal SpO2 on right hand'
        ],
        contraindicationChecks: [
          'Routine suctioning not required even with meconium present if newborn is breathing effectively',
          'Directive applies to patients under 24 hours of age only',
          'If ventilations are ineffective, attempt MR SOPA sequence before escalating airway management'
        ],
        supportiveCareOpportunities: [
          'drying and stimulation',
          'temperature management',
          'APGAR scoring at 1 and 5 minutes',
          'cardiac monitoring for accurate heart rate',
          'airway management with MR SOPA sequence if ventilation ineffective'
        ],
        oxygenGuidance: 'Neonatal SpO2 targets follow the directive chart — values take more than 10 minutes to normalize after birth.',
        instructionText: [
          'Stimulation and ventilation are the priority interventions.',
          'SpO2 targets follow the directive chart — values take more than 10 minutes to normalize after birth.',
          'Directive applies to patients under 24 hours of age only.'
        ].join(' ')
      };
    }

    return {
      style: 'ob/peds clinical scenario',
      likelyMedicationOpportunities: [
        'Weight-based pediatric medications when clinically indicated',
        'Obstetric medications per emergency childbirth directive when applicable'
      ],
      contraindicationChecks: [
        'Weight-based dosing required for all pediatric medications',
        'Follow age-specific directive conditions carefully'
      ],
      supportiveCareOpportunities: ['assessment', 'positioning', 'oxygen', 'reassessment', 'transport'],
      oxygenGuidance: 'Age-appropriate oxygen targets. Neonates follow directive SpO2 chart.',
      instructionText: ['OB/Peds scenarios require careful attention to weight-based dosing and age-specific directive conditions.'].join(' ')
    };
  }

  // ── GI / ABDOMINAL ───────────────────────────────────────────────────────
  if (callFamily.includes('gi') || callFamily.includes('abdominal') || promptLower.includes('abdominal') || promptLower.includes('renal colic') || promptLower.includes('flank pain')) {
    return {
      style: 'abdominal or GI medication scenario',
      likelyMedicationOpportunities: [
        'Acetaminophen or ibuprofen oral first-line if tolerated',
        'Ketorolac IM or IV for renal colic — NSAID is specifically recommended for renal colic alongside opioid',
        'Morphine IV or IM for significant abdominal pain if oral not tolerated',
        'Dimenhydrinate for nausea associated with abdominal pain if indicated',
        'Do not combine ketorolac and ibuprofen'
      ],
      contraindicationChecks: [
        'Active uncontrolled hemorrhage — analgesia only after hemorrhage control',
        'Do not combine ketorolac and ibuprofen',
        'Suspected active GI bleed — ketorolac and ibuprofen contraindicated',
        'Ensure nausea cause is investigated before giving antiemetic'
      ],
      supportiveCareOpportunities: [
        'pain assessment and scoring',
        'serial reassessment',
        'IV access for fluid and medication',
        'transport destination decision',
        'positioning for comfort'
      ],
      oxygenGuidance: 'Oxygen only if hypoxia is present.',
      instructionText: [
        'Renal colic patients should routinely receive an NSAID in addition to an opioid.',
        'Do not combine ketorolac and ibuprofen.',
        'Active uncontrolled GI hemorrhage is a contraindication to NSAIDs.'
      ].join(' ')
    };
  }

  // ── DEFAULT ───────────────────────────────────────────────────────────────
  return {
    style: 'clinically appropriate medication use only',
    likelyMedicationOpportunities: [],
    contraindicationChecks: [],
    supportiveCareOpportunities: [
      'serial reassessment',
      'transport decision-making',
      'communication',
      'scene management'
    ],
    oxygenGuidance: 'Use oxygen only when clinically indicated. Titrate to SpO2 92-96% for most patients.',
    instructionText: [
      'Medications are allowed for Semester 3 and 4 when clinically justified, but should not be forced into the case.',
      'A strong scenario may still be medication-light if that is more realistic.'
    ].join(' ')
  };
}

function getUniquenessInstruction(uniqueness) {
  switch (uniqueness) {
    case 'Common':
      return [
        'Use a common, high-value training presentation that paramedic students should frequently practice.',
        'Keep it recognizable and realistic, but still specific and internally coherent.',
        'Do not make it bland just because it is common.'
      ].join(' ');
    case 'Varied':
      return [
        'Use a less overused but still realistic presentation, context, or twist.',
        'The case should feel fresh without becoming strange for the sake of novelty.',
        'Use variation through context, presentation style, bystander information, progression, or misleading but fair cues.'
      ].join(' ');
    case 'Rare/Obscure':
      return [
        'Use a rarer but still teachable real-world case or presentation pattern.',
        'Keep it grounded, educational, and fair.',
        'The rarity should come from the clinical pattern, context, or presentation, not from making the scenario confusing or unrealistic.'
      ].join(' ');
    default:
      return `Use the selected uniqueness level (${uniqueness}) in a deliberate way.`;
  }
}

function buildGenerationPrompt({
  semester,
  type,
  environment,
  complexity,
  uniqueness,
  scenarioFriction,
  shiftMode,
  includeBystanders,
  includeTeachingCues,
  customPrompt,
  blsStandards,
  alsStandards,
  today,
  scenarioCore,
  medicationPlan,
  semesterProfile,
  generationProfile
}) {
  const directiveAddendum = buildDirectivePromptAddendum({
    semester,
    type,
    customPrompt
  });

  return `
Generate exactly one paramedic training scenario as valid JSON only.
No markdown. No commentary. No code fences.
ABSOLUTE RULE: Do not include URLs, web links, http addresses, or external references anywhere in the output. Not in protocolNotes, not in clinicalReasoning, not in any field. Ontario standards inform the content but must never appear as printed links.

${directiveAddendum.length > 0 ? `MANDATORY CLINICAL RULES — these override all other instructions and must be followed exactly in expectedTreatment, protocolNotes, and all clinical fields:
${directiveAddendum.map((line) => `- ${line}`).join('\n')}

` : ''}Return these top-level fields:
- scenarioIntro
- title
- callInformation
- sceneArrival
- firstImpression
- patientDemographics
- patientPresentation
- incidentNarrative
- opqrst
- initialAssessment
- historyGathering
- secondaryAssessment
- additionalAssessments
- sample
- medications
- allergies
- pastMedicalHistory
- physicalExam
- vitalSigns
- caseProgression
- transportPhase
- instructorGuidance
- expectedTreatment
- protocolNotes
- learningObjectives
- vocationalLearningOutcomes
- selfReflectionPrompts
- grsAnchors
- teachersPoints
- scenarioRationale
- clinicalReasoning

Section discipline rules — apply to every section without exception:
- Each section must add new information not already stated in a previous section. Do not restate, summarize, or paraphrase content from an earlier section.
- scenarioIntro states the teaching purpose only. It must not describe the patient, the scene, or the clinical findings. Save all clinical detail for the appropriate sections below.
- crewNotes in callInformation must not preview scene complexity, emotional tone, or teaching points. Those belong in scenarioIntro or instructorGuidance. crewNotes should contain only practical operational flags such as access issues, hazards, or resource considerations.
- sceneArrival describes the physical environment, access, and bystanders. It must not describe patient appearance, clinical findings, or distress level. Those belong in firstImpression.
- firstImpression describes what the crew observes about the patient in the first 15 seconds — appearance, position, visible distress, and immediate red flags. It must not repeat scene details already in sceneArrival, and it must not restate findings that will appear in physicalExam or vitalSigns.
- patientPresentation describes the patient's behaviour, speech, and observable demeanour at first contact. It must not repeat the general appearance already stated in firstImpression.
- incidentNarrative provides the timeline of events leading to this call. It must not repeat information that will appear in SAMPLE eventsLeadingUp.
- initialRedFlags in firstImpression must list only flags not already named as visibleClues in the same section. Do not duplicate within the same section.
- If a clinical detail has already appeared in any section, do not repeat it. Move forward.

Required object structure:
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

- initialAssessment must contain ONLY learner-facing assessment findings:
{
  "airway": "",
  "breathing": "",
  "circulation": "",
  "disability": "",
  "exposure": "",
  "generalImpression": ""
}
- Do not put immediatePriorities, immediateInterventions, treatment instructions, care-plan steps, or diagnostic answers inside initialAssessment.

- historyGathering must contain:
{
  "historySource": "",
  "additionalHistory": [],
  "bystanderInformation": [],
  "contradictionsOrBarriers": [],
  "sceneContextClues": []
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

- additionalAssessments must be an array of reassessment, movement, transport, or focused exam findings when applicable.

- vitalSigns must contain:
{
  "firstSet": { "context": "", "hr": "", "rr": "", "bp": "", "spo2": "", "etco2": "", "temp": "", "gcs": "", "bgl": "", "ecgInterpretation": "" },
  "secondSet": { "context": "", "hr": "", "rr": "", "bp": "", "spo2": "", "etco2": "", "temp": "", "gcs": "", "bgl": "", "ecgInterpretation": "" },
  "additionalSets": [
    { "context": "", "hr": "", "rr": "", "bp": "", "spo2": "", "etco2": "", "temp": "", "gcs": "", "bgl": "", "ecgInterpretation": "" }
  ]
}

- caseProgression must contain these exact keys, and each key must be an array of practical timeline-style points:
{
  "withProperTreatment": [],
  "withoutProperTreatment": [],
  "withIncorrectTreatment": [],
  "movementOrTransportChanges": []
}

- transportPhase must contain:
{
  "transportConsiderations": [],
  "ongoingCare": [],
  "reassessmentFocus": [],
  "handoffConsiderations": ""
}

- instructorGuidance must contain instructor-only coaching content:
{
  "instructorPriorities": [],
  "psychologicalSafetyDebrief": ""
}
- instructorPriorities is where instructor-only early care priorities and management targets belong. Expected interventions belong in expectedTreatment, not in instructorGuidance. Keep all directive coaching out of learner-facing initialAssessment.
- psychologicalSafetyDebrief must be one short paragraph that frames feedback around observable decisions, reassessment, communication, and next-call improvement. It should avoid blame, shame, or gotcha language.

- clinicalReasoning must contain:
{
  "summary": "",
  "differentialDiagnosis": [
    {
      "condition": "",
      "supportingFeatures": "",
      "rulingOutFeatures": ""
    }
  ],
  "conclusion": ""
}
- differentialDiagnosis must contain a maximum of 3 conditions. Do not generate more than 3 entries.

- grsAnchors must contain these EXACT 7 domains:
  - situationalAwareness
  - patientAssessment
  - historyGathering
  - decisionMaking
  - proceduralSkill
  - resourceUtilization
  - communication

GRS rules:
- Each of the 7 domains must contain exactly these score keys: "3", "5", "7"
- Do not include score "1" anywhere in grsAnchors
- Each score key must contain an array
- Each score array must contain exactly 3 short, scenario-specific behavioural bullet examples
- Do not use vague traits like "good communicator"
- Score 3 = unsafe-to-borderline, important omissions, weak prioritization, inconsistent reassessment, or poor adaptation
- Score 5 = competent semester-appropriate performance; this is the expected standard
- Score 7 = exceptional, anticipatory, organized, calm, and highly effective
- Keep the GRS structure standardized, but tailor the actual bullets to THIS case

ECG rules:
Use only these exact ECG values when appropriate:
${ECG_WHITELIST.map((item) => `- ${item}`).join('\n')}
- Do not add rate, qualifiers, or extra descriptors
- If ECG is relevant, place it in vitalSigns.firstSet.ecgInterpretation
- Update vitalSigns.secondSet.ecgInterpretation only if the rhythm changes clinically. If the rhythm is unchanged, leave secondSet.ecgInterpretation as an empty string.
- Rhythm progression should reflect the clinical trajectory. Examples of appropriate rhythm changes: sinus tachycardia improving to normal sinus rhythm after treatment; normal sinus rhythm deteriorating to atrial fibrillation in a sepsis or cardiac patient; sinus tachycardia progressing to SVT in a palpitations scenario; any rhythm deteriorating to ventricular tachycardia, ventricular fibrillation, or asystole in a cardiac arrest scenario; bradycardia worsening through heart block progression in a medication toxicity case.
- Do not change the rhythm in secondSet unless the clinical scenario, treatment response, or deterioration genuinely supports it. A stable patient with sinus tachycardia should still show sinus tachycardia in secondSet unless something changed.
- When a rhythm change occurs, it must be explained in ecgFindings.rhythmInterpretation and referenced in caseProgression.
- Do not use a separate top-level ecgInterpretation field
- If the case is isolated trauma, leave ecgInterpretation blank
- Do not label a rhythm as "Sinus Tachycardia" unless the numeric HR value is strictly above 100. If HR is 100 or below, use Normal Sinus Rhythm or Sinus Bradycardia as appropriate.
- Do not label a rhythm as "Sinus Bradycardia" unless the numeric HR value is strictly below 60. If HR is 60 or above, use Normal Sinus Rhythm or Sinus Tachycardia as appropriate.
- Do not label a rhythm as "Normal Sinus Rhythm" unless the numeric HR value is between 60 and 100 inclusive.
- The ECG label in ecgInterpretation must always be consistent with the numeric HR in the same vital sign set. Check this before returning the JSON.
- Use SVT when the presentation involves paroxysmal palpitations, abrupt onset tachycardia at 150-220 bpm, narrow complex rhythm, absent or retrograde P waves, and no clear sinus origin. Do not use Sinus Tachycardia for SVT presentations.
- Use Atrial Fibrillation when the presentation involves an irregularly irregular pulse, absent P waves, and a clinical context supporting AFib such as known AFib history, alcohol use, hyperthyroidism, heart failure, or new onset palpitations with irregular rhythm on assessment.
- Use Atrial Flutter when the presentation involves a regular tachycardia at approximately 150 bpm with a 2:1 block pattern, or 75-100 bpm with higher degree block, and a clinical context supporting flutter.
- Use Ventricular Tachycardia when the presentation involves a wide complex tachycardia above 100 bpm, hemodynamic compromise, known structural heart disease, or post-MI context. Do not use Sinus Tachycardia for VT presentations.
- Use First Degree AV Block, Second Degree AV Block Type I, Second Degree AV Block Type II, or Third Degree AV Block when the presentation involves bradycardia, syncope, near-syncope, medication toxicity such as beta blocker or calcium channel blocker overdose, or known conduction disease.
- Use Ventricular Fibrillation or Asystole only in cardiac arrest scenarios.
- Use Pulseless Electrical Activity only in cardiac arrest with organized rhythm but no pulse.
- Default to Normal Sinus Rhythm, Sinus Tachycardia, or Sinus Bradycardia for all other presentations where no specific dysrhythmia is clinically indicated.

Also return a top-level ecgFindings object with these fields:
- ecgType: "rhythm" for basic medical calls, "12-lead" for cardiac, respiratory with hypoxia, AMS, syncope, overdose, post-ROSC, or any call where a 12-lead would be clinically indicated. "15-lead" only when right ventricular STEMI is confirmed with ST elevation in right-sided leads (V3R, V4R), or posterior STEMI is confirmed. Do not generate 15-lead for a plain inferior STEMI, inferolateral STEMI, De Winter pattern, Wellens syndrome, or any other 12-lead pattern — use ecgType "12-lead" for those. De Winter pattern, Wellens syndrome, pericarditis, hyperkalemia, LBBB, RBBB, SVT, atrial flutter, and all STEMI variants except RV and posterior STEMI must use ecgType "12-lead".
- rhythmInterpretation: one to two sentences describing the rhythm in plain clinical language including rate, regularity, and any notable features. Always populate this field. Do not just name the rhythm — briefly explain why that rhythm is present in the context of this specific patient and condition. For example: sinus bradycardia in a missed dialysis patient should connect to metabolic or electrolyte cause; sinus tachycardia in a febrile sepsis patient should connect to physiologic demand; a rhythm in a chest pain patient should note what it does or does not suggest about ischemia.
- twelveLeadFindings: describe the 12-lead findings in plain clinical language when ecgType is "12-lead" or "15-lead". Include axis, ST changes, intervals, and any notable findings. Leave empty string if ecgType is "rhythm" only.
- When the scenario involves hyperkalemia, missed dialysis, or peaked T waves from electrolyte disturbance, you MUST set ecgType to "12-lead" and populate twelveLeadFindings describing peaked narrow T waves in precordial leads, any PR prolongation, QRS widening, P wave flattening, and clinical context. Do not leave ecgFindings or twelveLeadFindings blank for these presentations.
- fifteenLeadFindings: describe right-sided or posterior lead findings when ecgType is "15-lead". Focus on RV involvement, posterior changes, or right-sided ST changes. Leave empty string if ecgType is "rhythm" or "12-lead".
- ecgClinicalNote: one sentence connecting the ECG findings to the clinical presentation and treatment decisions.
- patternKey: one of these exact string values matching the pattern this 12-lead represents: normal, inferiorSTEMI, anteriorSTEMI, lateralSTEMI, inferolateralSTEMI, highLateralSTEMI, lbbb, rbbb, afib12, vtach12, inferiorRV, posterior, wellens, deWinter, pericarditis, hyperkalemia, svt12, atrialFlutter12, firstDegreeAVBlock, secondDegreeTypeI, secondDegreeTypeII, thirdDegreeAVBlock. This must match the actual ECG pattern described in twelveLeadFindings. Leave as empty string only if ecgType is rhythm.
- Do not leave rhythmInterpretation blank on any call that has an ECG value in vitalSigns.
- Do not generate 12-lead or 15-lead findings for isolated trauma without medical concern.
- When ECG or rhythm findings are clinically relevant to the case, teachersPoints or instructorGuidance must reference them explicitly. If the rhythm supports the diagnosis, say so. If the rhythm is a red flag that could be missed, name it. If the rhythm is secondary and not the teaching focus, one sentence is enough.
- If ETCO2 values are generated and show a clinically meaningful trend across vital sign sets, teachersPoints or clinicalReasoning must name that trend and explain what it means in this patient's context. Do not leave ETCO2 as a bare number when it is changing in a meaningful direction.

Scenario parameters:
- Semester: ${semester}
- Type: ${type}
- Environment: ${environment}
- Complexity: ${complexity}
- Scenario friction: ${scenarioFriction}
- Scenario friction instruction: ${getScenarioFrictionInstruction(scenarioFriction)}
- Shift mode: ${shiftMode}
- Shift mode instruction: ${getShiftModeInstruction(shiftMode)}
- Uniqueness: ${uniqueness}
- Generation depth: ${generationProfile.label}
- Generation depth instruction: ${generationProfile.promptInstruction}
- Bystanders: ${includeBystanders ? 'Include them when useful.' : 'Do not include them.'}
- Teaching cues: ${includeTeachingCues ? 'Embed brief inline cues using the exact format *(💡 cue text)* where helpful.' : 'Do not include inline teaching cues.'}

Semester difficulty profile:
- Learner level: ${semesterProfile.learnerLevel}
- Medication access: ${semesterProfile.medicationAccess}
- Presentation clarity: ${semesterProfile.presentationClarity}
- Ambiguity: ${semesterProfile.ambiguity}
- Competing problems: ${semesterProfile.competingProblems}
- Communication burden: ${semesterProfile.communicationBurden}
- Scene complexity: ${semesterProfile.sceneComplexity}
- Reassessment burden: ${semesterProfile.reassessmentBurden}
- Leadership demand: ${semesterProfile.leadershipDemand}
- Expected reasoning: ${semesterProfile.expectedReasoning}

Scenario core:
- Call family: ${scenarioCore.callFamily}
- Likely diagnosis framing: ${scenarioCore.likelyDiagnosis}
- Plausible differentials: ${scenarioCore.plausibleDifferentials.join(', ')}
- General setting: ${scenarioCore.patientContext.generalSetting}
- Clinical acuity: ${scenarioCore.clinicalPresentation.acuity}
- Presentation clarity: ${scenarioCore.clinicalPresentation.clarity}
- Symptom pattern: ${scenarioCore.clinicalPresentation.symptomPattern}
- Proper treatment progression: ${scenarioCore.progressionStyle.withProperTreatment}
- Improper/no treatment progression: ${scenarioCore.progressionStyle.withoutProperTreatment}

Medication plan:
- Style: ${medicationPlan.style}
- Likely medication opportunities: ${medicationPlan.likelyMedicationOpportunities.length ? medicationPlan.likelyMedicationOpportunities.join(', ') : 'none'}
- Contraindication checks: ${medicationPlan.contraindicationChecks.length ? medicationPlan.contraindicationChecks.join(', ') : 'none'}
- Supportive care opportunities: ${medicationPlan.supportiveCareOpportunities.join(', ')}
- Oxygen guidance: ${medicationPlan.oxygenGuidance}

Scenario shaping rules:
- ${semesterProfile.instructionText}
- ${getTypeInstruction(type)}
- ${getEnvironmentInstruction(environment)}
- ${getComplexityInstruction(complexity)}
- ${getScenarioFrictionInstruction(scenarioFriction)}
- ${getShiftModeInstruction(shiftMode)}
- ${getUniquenessInstruction(uniqueness)}
- ${medicationPlan.instructionText}
- Write like an experienced Ontario paramedic instructor building a realistic teaching case for lab.
- Prioritize realism over textbook neatness.
- Avoid generic protocol-summary phrasing.
- Build the scenario from the outside in: realistic dispatch, believable patient presentation, meaningful assessment findings, then clinically justified treatment opportunities.
- Make the scenario internally coherent across chief complaint, history, physical findings, vital signs, ECG use, progression, differential, and treatment.
- The selected type, environment, complexity, semester, and uniqueness must all produce visible differences in the final scenario.
- Avoid generic template-feeling scenarios; make this one feel deliberately authored.
- The title must be specific to this exact call. Do not use generic titles like "The Chest Pain Call" or "Diabetic Emergency". Use specific scene detail, patient context, or clinical tension. Examples of strong titles: "Skipped Lunch at the Transit Stop", "Too Slow After Lunch", "Rural Station Fast Pulse Tight Chest". Never reuse a title pattern from a previous scenario in the same session.
- Titles should vary significantly across scenario types. A trauma title should sound different from a medical title. An OB title should sound different from a cardiac title.
- Use patient or bystander dialogue where it adds realism, but keep it purposeful.
- Keep the tone direct, educational, clinically grounded, and useful for paramedic teaching. Do not use em dashes anywhere in the generated scenario; use commas, periods, parentheses, or simple hyphens instead.
- Teacher's Points should sound like a senior paramedic coaching a student.
- Teaching points, self-reflection prompts, and GRS anchors must be psychologically safe: focus on observable behaviours, decisions, reassessment, communication, and next-call improvement. Do not frame learners with blame, shame, fault, punishment, or personal judgment. Clinical terms such as respiratory failure, heart failure, or renal failure remain accurate and allowed.
- OPQRST must be fully populated when clinically applicable, with meaningful content in each element.
- SAMPLE must be fully populated with clinically useful detail, not placeholders.
- Chief complaint must never be blank and should be concise, patient-centered, and aligned with the generated call. Do not default to chest pain unless the scenario is truly cardiac or the patient actually has chest pain/pressure.
- Physical assessment must be populated across relevant fields.
- initialAssessment, secondaryAssessment, and additionalAssessments must show different phases of the call rather than repeat the same assessment in different words.
- Keep initialAssessment learner-facing: describe findings only, not what the learner should do next. Move instructor-only priorities and management targets into instructorGuidance. Move intervention expectations and contraindication reminders into expectedTreatment or protocolNotes.
- General appearance should describe what the crew sees on arrival.
- Airway should comment on patency or obstruction.
- Breathing should comment on rate, effort, breath sounds, and visible respiratory distress.
- Circulation should comment on pulse, perfusion, skin findings, and shock signs where relevant.
- Neuro should comment on mental status, orientation, and LOC where relevant.
- instructorGuidance must contain instructor-only priorities and a psychologically safe debrief frame. Do not include a separate instructor action list because expected actions already belong in expectedTreatment.
- Case progression must clearly separate what happens with proper treatment, without/delayed treatment, and with incorrect treatment.
- Case progression must include movementOrTransportChanges when movement, packaging, stair-chair use, extrication, loading, or transport plausibly changes symptoms, assessment findings, vital signs, patient tolerance, or management priorities.
- Vital sign changes must reflect treatment response, missed care, incorrect care, exertion, movement, fatigue, clinical deterioration, or transport-phase reassessment when appropriate.
${directiveAddendum.length > 0 ? `DIRECTIVE RULES REMINDER — apply to expectedTreatment and protocolNotes:
${directiveAddendum.map((line) => `- ${line}`).join('\n')}
` : ''}- expectedTreatment must be a structured multi-item list of practical paramedic actions, not a paragraph.
- protocolNotes must be a structured multi-item list, not a paragraph.
- Do not include URLs, web links, or external references in any field.
- teachersPoints must be one compact instructor-voice paragraph, maximum 4 sentences. Name the trap or the easy miss in this specific case. Name the pivot point or the finding that should change the call. End with one concrete next-call adjustment. Do not restate the expected management. Do not restate the learning objectives. Sound like a senior paramedic debriefing after the call, not a textbook summary.
- learningObjectives and vocationalLearningOutcomes must each be list items, not combined prose. selfReflectionPrompts must be scenario-specific questions that ask what the student would do differently or what changed their thinking. Each prompt must be answerable in one or two sentences. Avoid open-ended emotional questions. Focus on reasoning, prioritization, reassessment decisions, and communication choices specific to this case. Do not restate the learning objectives as questions.
- Avoid empty strings for clinically relevant fields unless truly not applicable.
- Return all required fields every time with meaningful scenario-specific content.
- For Semester 3 and 4, when clinically appropriate, prefer scenarios that involve multiple Ontario-appropriate PCP medication decisions rather than a single-medication pathway.
- Medication-rich scenarios should still remain coherent and realistic.
- Do not force multiple drugs into cases where only one medication or no medication is appropriate.
- If multiple medications are used, ensure each one is clearly supported by the presentation, semester level, and current Ontario directive logic.
- Reference BLS PCS and ALS PCS when relevant in protocolNotes and expectedTreatment.
- Patients should not always present with obvious textbook diagnoses; include vague, evolving, or misleading presentations when appropriate.
- Include realistic paramedic decision points such as transport decisions, destination decisions, reassessment findings, and changes over time.
- Many scenarios should include more than one clinical problem or complicating factor (e.g., comorbidities, medications, social factors, scene challenges).
- Vital signs should be believable and clinically consistent with the presentation and should sometimes be borderline rather than extreme.
- Not every abnormal vital sign needs immediate correction; some should require monitoring and reassessment.
- Include realistic Ontario paramedic considerations such as STEMI bypass, stroke bypass, trauma bypass, sepsis considerations, and appropriate destination decisions when relevant.
- Include contraindication decision points when appropriate (e.g., nitro and blood pressure, medication allergies, medication interactions, unclear history).
- Some scenarios should involve withholding a medication appropriately rather than always administering medications.
- Include reassessment findings that change management decisions when appropriate.
- The scenario should feel like a real call that paramedics would discuss after shift, not a textbook example.

- When multiple medications are appropriate, ensure they occur at different decision points (e.g., ASA early, nitro after BP check, antiemetic later, repeat medication after reassessment).
- Medication decisions should be tied to assessment findings and reassessment findings, not given automatically.
PCP scope — strict enforcement:
Only medications and procedures listed in the ALS PCS reference above are within PCP or PCP-IV scope. Anything not listed there is ACP-only and must not appear.

Common scope violations to prevent:
- Epinephrine is PCP scope for anaphylaxis and severe allergic reaction only. Do not use it for cardiac arrest, shockable rhythms, PEA, or asystole.
- IO (intraosseous) access is ACP auxiliary only. Use IV only.
- Transcutaneous pacing, synchronized cardioversion, RSI, surgical airway, and endotracheal intubation are ACP-only.
- Atropine, dopamine, amiodarone, lidocaine, magnesium, adenosine, morphine, fentanyl, midazolam, and diazepam are ACP-only. Do not reference them even as withheld options.

When a patient deteriorates beyond PCP scope, the correct response is rapid transport, ALS intercept request, or base hospital contact — not an ACP intervention.

PCP Auxiliary Directives (base hospital authorization required; Semester 3 and 4 when clinically relevant):
CPAP, Cardiogenic Shock, Traumatic Hemorrhage (includes TXA IM or IV), IV and Fluid Therapy, Seizure, Tachydysrhythmia (ALS PCS v5.4, PCP level). Always label these as base-hospital-authorized when referenced.

BLS PCS reference:
${blsStandards}

ALS PCS reference:
${alsStandards}

Today's date: ${today}
${customPrompt ? `\nInstructor request: ${customPrompt}` : ''}
`.trim();
}

const dataPaths = {
  profile: path.join(__dirname, '../data/scenario-instructor-profile.txt'),
  fewShots: path.join(__dirname, '../data/few-shot-scenarios.json'),
  blsStandards: path.join(__dirname, '../data/bls-standards.txt'),
  alsStandards: path.join(__dirname, '../data/als-standards.txt')
};

let cachedDataPromise;

function loadStaticData() {
  if (!cachedDataPromise) {
    cachedDataPromise = Promise.all([
      fs.readFile(dataPaths.profile, 'utf-8'),
      fs.readFile(dataPaths.fewShots, 'utf-8'),
      fs.readFile(dataPaths.blsStandards, 'utf-8'),
      fs.readFile(dataPaths.alsStandards, 'utf-8')
    ]).then(([profile, fewShots, blsStandards, alsStandards]) => ({
      profile,
      fewShots,
      blsStandards,
      alsStandards
    }));
  }

  return cachedDataPromise;
}

router.post('/', async (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');

  const {
    semester = '3',
    type = 'Medical',
    environment = 'Urban',
    complexity = 'Simple',
    scenarioFriction = 'Clean',
    shiftMode = 'Day Shift',
    uniqueness = 'Common',
    generationDepth = 'Quick Draft',
    includeBystanders = true,
    includeTeachingCues = true,
    customPrompt = ''
  } = req.body || {};

  const normalizedFriction =
    scenarioFriction === 'Low' ? 'Clean' :
    scenarioFriction === 'High' ? 'Pressured' :
    scenarioFriction === 'Moderate' ? 'Clean' :
    scenarioFriction;

  const normalizedDepth =
    generationDepth === 'Standard' ? 'Quick Draft' :
    generationDepth;

  const normalizedComplexity =
    complexity === 'Moderate' ? 'Simple' :
    complexity;

  try {
    const {
      profile,
      fewShots,
      blsStandards,
      alsStandards
    } = await loadStaticData();

    const generationProfile = getGenerationDepthProfile(normalizedDepth);
    const semesterProfile = buildSemesterDifficultyProfile(semester);
    const scenarioCore = buildScenarioCore({
      semester,
      type,
      environment,
      complexity: normalizedComplexity,
      uniqueness,
      customPrompt
    });
    const medicationPlan = buildMedicationPlan({
      semester,
      type,
      customPrompt,
      scenarioCore
    });

    const prompt = buildGenerationPrompt({
      semester,
      type,
      environment,
      complexity: normalizedComplexity,
      uniqueness,
      scenarioFriction: normalizedFriction,
      shiftMode,
      includeBystanders,
      includeTeachingCues,
      customPrompt,
      blsStandards,
      alsStandards,
      today: new Date().toLocaleDateString('en-CA'),
      scenarioCore,
      medicationPlan,
      semesterProfile,
      generationProfile
    });

    const completion = await openai.chat.completions.create({
      model: generationProfile.model,
      temperature: generationProfile.temperature,
      max_completion_tokens: generationProfile.maxTokens,
      messages: [
        { role: 'system', content: profile },
        { role: 'user', content: `${fewShots}\n\n${prompt}` }
      ]
    });

    const rawContent = completion?.choices?.[0]?.message?.content;

    if (!rawContent) {
      console.error('Invalid OpenAI response:', completion);
      return res.status(500).json({ error: 'OpenAI returned malformed data.' });
    }

    let parsed;
    try {
      parsed = JSON.parse(jsonrepair(sanitizeOutput(rawContent)));
    } catch (parseError) {
      console.error('Failed to parse model JSON:', parseError, rawContent);
      return res.status(500).json({ error: 'Scenario JSON parsing failed. Please retry.' });
    }

    const normalized = normalizeScenario(parsed, {
      customPrompt,
      type,
      semester,
      shiftMode
    });

    return res.json(normalized);
  } catch (error) {
    console.error('Scenario generation error:', error);
    return res.status(500).json({
      error: 'Internal server error.',
      details: error?.message || 'Unknown server error.'
    });
  }
});

export default router;