import 'dotenv/config';
import express from 'express';
import OpenAI from 'openai';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { jsonrepair } from 'jsonrepair';
import { buildDirectivePromptAddendum } from '../data/ontarioDirectiveRules.js';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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
    situationalAwareness: { 1: [], 3: [], 5: [], 7: [] },
    patientAssessment: { 1: [], 3: [], 5: [], 7: [] },
    historyGathering: { 1: [], 3: [], 5: [], 7: [] },
    decisionMaking: { 1: [], 3: [], 5: [], 7: [] },
    proceduralSkill: { 1: [], 3: [], 5: [], 7: [] },
    resourceUtilization: { 1: [], 3: [], 5: [], 7: [] },
    communication: { 1: [], 3: [], 5: [], 7: [] }
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
    secondSet: defaultVitalSet()
  },
  caseProgression: {
    withProperTreatment: '',
    withoutProperTreatment: ''
  },
  expectedTreatment: [],
  protocolNotes: [],
  learningObjectives: [],
  vocationalLearningOutcomes: [],
  selfReflectionPrompts: [],
  grsAnchors: defaultGrsAnchors(),
  teachersPoints: [],
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

function normalizeVitalSigns(value, ecgInterpretation) {
  const source = value && typeof value === 'object' ? value : {};
  const firstRaw = source.firstSet || source.first || {};
  const secondRaw = source.secondSet || source.second || {};

  const firstSet = { ...defaultVitalSet(), ...firstRaw };
  const secondSet = { ...defaultVitalSet(), ...secondRaw };

  if (ecgInterpretation && ECG_WHITELIST.includes(ecgInterpretation) && !firstSet.ecgInterpretation) {
    firstSet.ecgInterpretation = ecgInterpretation;
  }

  if (firstSet.ecgInterpretation && !ECG_WHITELIST.includes(firstSet.ecgInterpretation)) {
    firstSet.ecgInterpretation = '';
  }

  if (secondSet.ecgInterpretation && !ECG_WHITELIST.includes(secondSet.ecgInterpretation)) {
    secondSet.ecgInterpretation = '';
  }

  return { firstSet, secondSet };
}

function normalizeGrsAnchors(value) {
  const base = defaultGrsAnchors();
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};

  for (const domain of Object.keys(base)) {
    const incomingDomain = source[domain];
    if (!incomingDomain || typeof incomingDomain !== 'object' || Array.isArray(incomingDomain)) {
      continue;
    }

    for (const score of ['1', '3', '5', '7']) {
      base[domain][score] = coerceArray(incomingDomain[score]);
    }
  }

  return base;
}

function fillScenarioGaps(normalized) {
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
    normalized.caseProgression?.withProperTreatment,
    normalized.caseProgression?.withoutProperTreatment,
    ...(normalized.teachersPoints || []),
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

  if (!demographics.chiefComplaint) {
    if (respiratory) demographics.chiefComplaint = 'Difficulty breathing';
    else if (cardiac) demographics.chiefComplaint = 'Chest pain';
    else if (trauma) demographics.chiefComplaint = 'Traumatic injury';
    else if (hypoglycemia) demographics.chiefComplaint = 'Altered level of consciousness';
    else demographics.chiefComplaint = 'Medical complaint';
  }

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
  normalized.teachersPoints = coerceArray(normalized.teachersPoints);
  normalized.learningObjectives = coerceArray(normalized.learningObjectives);
  normalized.vocationalLearningOutcomes = coerceArray(normalized.vocationalLearningOutcomes);
  normalized.selfReflectionPrompts = coerceArray(normalized.selfReflectionPrompts);
  normalized.expectedTreatment = coerceArray(normalized.expectedTreatment);
  normalized.protocolNotes = coerceArray(normalized.protocolNotes);
  normalized.medications = coerceArray(normalized.medications);
  normalized.allergies = coerceArray(normalized.allergies);
  normalized.pastMedicalHistory = coerceArray(normalized.pastMedicalHistory);

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
  normalized.expectedTreatment = coerceArray(source.expectedTreatment);
  normalized.protocolNotes = coerceArray(source.protocolNotes);
  normalized.medications = coerceArray(source.medications);
  normalized.allergies = coerceArray(source.allergies);
  normalized.pastMedicalHistory = coerceArray(source.pastMedicalHistory);
  normalized.teachersPoints = coerceArray(source.teachersPoints);

  const nestedFirstEcg = source?.vitalSigns?.firstSet?.ecgInterpretation;
  const nestedSecondEcg = source?.vitalSigns?.secondSet?.ecgInterpretation;
  const topLevelEcg = source?.ecgInterpretation;

  const ecgInterpretation = [nestedFirstEcg, nestedSecondEcg, topLevelEcg].find((value) =>
    ECG_WHITELIST.includes(value)
  );

  normalized.vitalSigns = normalizeVitalSigns(source.vitalSigns, ecgInterpretation);
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

  return fillScenarioGaps(normalized);
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
        'Presentation should be recognizable, with limited ambiguity and limited competing distractions.',
        'Avoid excessive branching, unusual combinations, or stacked complications.',
        'The educational value should come from doing the basics well.'
      ].join(' ');
    case 'Moderate':
      return [
        'Use one clear primary problem plus one or two meaningful complicating factors.',
        'Require reassessment, prioritization, and some interpretation rather than simple pattern matching.',
        'Allow a few distracting or overlapping clues, but keep the case understandable and teachable.',
        'This should feel like a realistic training call that requires thought without becoming overloaded.'
      ].join(' ');
    case 'Complex':
      return [
        'Layer the case with competing cues, clinical ambiguity, operational demands, or evolving deterioration.',
        'Require stronger prioritization, reassessment, and differentiation between plausible problems.',
        'Use more realistic uncertainty, but do not make the scenario unfair or incoherent.',
        'The complexity should challenge organization, judgment, and transport/resource planning.'
      ].join(' ');
    default:
      return `Use ${complexity} complexity in a clinically meaningful way.`;
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
        instructionText: [
          'This scenario is for a Semester 2 PCP learner.',
          'No medications should be expected or required by design.',
          'Keep the case more straightforward, with clearer patterns and lower ambiguity.',
          'Emphasize scene approach, primary survey, basic assessment, history gathering, communication, oxygen decisions where appropriate, and safe foundational care.',
          'Expected treatment and GRS anchors should reflect an earlier learner who is still building structure, confidence, and organization.',
          'Avoid making the case depend on subtle advanced interpretation, destination complexity, or nuanced treatment sequencing.'
        ].join(' ')
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
        instructionText: [
          'This scenario is for a Semester 3 PCP learner.',
          'All clinically appropriate PCP medication options may be included when justified by the case.',
          'Use moderate complexity with clearer teachable moments, but expect more independent assessment and decision-making than Semester 2.',
          'The learner should be able to recognize common patterns, initiate appropriate treatment, notice straightforward contraindications, and reassess appropriately.',
          'Allow some realistic messiness, but keep the case manageable and fair rather than overloaded.',
          'Expected treatment and GRS anchors should reflect a learner developing autonomy, not a fully polished field practitioner.'
        ].join(' ')
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
        instructionText: [
          'This scenario is for a Semester 4 PCP learner.',
          'All clinically appropriate PCP medication options may be included when justified by the case.',
          'Use fuller PCP scope, stronger autonomy, more realistic field messiness, and more layered decision-making.',
          'Allow greater ambiguity, operational pressure, competing problems, and responsibility for prioritization, communication, destination decisions, and resource use.',
          'The learner should be expected to notice contraindications, withhold treatments appropriately when needed, and adapt to changing reassessment findings.',
          'Expected treatment and GRS anchors should reflect a near-graduation learner who is expected to organize the call well, think ahead, and lead effectively.',
          'Do not make it artificially simple or overly hand-held.'
        ].join(' ')
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

  if (typeLower === 'cardiac' || promptLower.includes('chest pain') || promptLower.includes('palpitation')) {
    callFamily = 'cardiac_presentation';
    likelyDiagnosis = pick([
      'acute coronary syndrome pattern',
      'cardiac ischemia concern',
      'symptomatic cardiac rhythm disturbance'
    ]);
    plausibleDifferentials = [
      'ACS',
      'arrhythmia',
      'angina',
      'non-cardiac chest pain',
      'anxiety or stress-related presentation'
    ];
    symptomPattern = pick([
      'cardiac symptoms with pressure, discomfort, autonomic features, or exertional context',
      'cardiac complaint with believable field cues and decision points around treatment and transport',
      'chest pain or palpitations with enough detail to support real differentiation'
    ]);
  } 
  else if (typeLower === 'respiratory' || promptLower.includes('shortness of breath') || promptLower.includes('asthma')) {
    callFamily = 'respiratory_presentation';
    likelyDiagnosis = pick([
      'lower respiratory distress pattern',
      'bronchospastic respiratory presentation',
      'non-traumatic breathing complaint'
    ]);
    plausibleDifferentials = [
      'asthma',
      'COPD exacerbation',
      'pneumonia',
      'allergic respiratory process',
      'other respiratory distress cause'
    ];
    symptomPattern = pick([
      'respiratory distress with visible work of breathing and believable reassessment points',
      'breathing complaint with enough detail to support treatment decisions and differentiation',
      'airway or breathing problem anchored in realistic prehospital findings'
    ]);
  } 
  else if (typeLower === 'trauma' || promptLower.includes('fall') || promptLower.includes('collision')) {
    callFamily = 'trauma_presentation';
    likelyDiagnosis = pick([
      'injury pattern matching mechanism',
      'significant isolated trauma concern',
      'traumatic injury with potential occult complication'
    ]);
    plausibleDifferentials = [
      'injury pattern matching mechanism',
      'occult trauma complication',
      'medical cause preceding trauma when appropriate'
    ];
    symptomPattern = pick([
      'trauma mechanism with matching findings and realistic scene priorities',
      'injury complaint with believable pain, movement limits, and transport decisions',
      'trauma presentation where packaging, reassessment, and mechanism matter'
    ]);
  } 
  else if (typeLower === 'environmental' || promptLower.includes('heat') || promptLower.includes('cold') || promptLower.includes('exposure')) {
    callFamily = 'environmental_presentation';
    likelyDiagnosis = pick([
      'environment-linked illness pattern',
      'heat or cold related physiological stress',
      'exposure-driven medical presentation'
    ]);
    plausibleDifferentials = [
      'heat illness',
      'cold exposure',
      'dehydration',
      'toxin or exposure-related illness',
      'other environmentally triggered process'
    ];
    symptomPattern = pick([
      'environment-linked physiology with scene and transport implications',
      'exposure-related complaint where setting meaningfully affects management',
      'medical presentation that clearly depends on the environment'
    ]);
  } 
  else if (typeLower === 'medical') {
    callFamily = pick([
      'general_medical',
      'diabetic_or_metabolic_presentation',
      'infectious_or_sepsis_pattern',
      'nausea_vomiting_or_dehydration_pattern',
      'neurologic_or_syncope_pattern',
      'geriatric_multi_problem',
      'psych_or_behavioral',
      'toxicology_or_overdose'
    ]);

    likelyDiagnosis = pick([
      'undifferentiated medical complaint',
      'general medical working diagnosis',
      'medical presentation requiring focused differentiation',
      'multi-factor medical presentation with comorbidities'
    ]);

    plausibleDifferentials = [
      'medical problem suggested by presentation',
      'reasonable alternative supported by history',
      'one misleading but fair possibility',
      'comorbidity-related complication'
    ];

    symptomPattern = pick([
      'general medical presentation with realistic field ambiguity',
      'medical complaint with enough clues to guide focused assessment',
      'non-traumatic illness presentation anchored in believable prehospital findings',
      'medical presentation with multiple contributing factors'
    ]);
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

  // Semester 2 – no meds by design
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
        'positioning/packaging',
        'transport decision-making',
        'communication'
      ],
      oxygenGuidance: 'Use oxygen only if clinically indicated under current standards.',
      instructionText: [
        'This is a non-medication scenario by design for Semester 2.',
        'Do not require medication administration to solve the case.',
        'Expected treatment should focus on assessment, supportive care, communication, oxygen decisions when indicated, reassessment, and transport.'
      ].join(' ')
    };
  }

  // Medication involvement probability
  let medicationChance = 0.7;
  if (String(semester) === '4') medicationChance = 0.8;

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
      oxygenGuidance: 'Use oxygen only when clinically indicated.',
      instructionText: [
        'This scenario should focus more on assessment, decision making, reassessment, and transport planning rather than medications.',
        'It is acceptable and realistic that no medications are required in this case.'
      ].join(' ')
    };
  }

  // Cardiac scenarios
  if (typeLower === 'cardiac' || callFamily.includes('cardiac') || promptLower.includes('chest pain')) {
    return {
      style: 'cardiac medication decision scenario',
      likelyMedicationOpportunities: [
        'ASA if clinically indicated',
        'Nitroglycerin if clinically indicated and no contraindications',
        'Repeat nitroglycerin dosing if still symptomatic and BP allows'
      ],
      contraindicationChecks: [
        'ASA allergy or inability to take it safely',
        'Nitroglycerin blood pressure check',
        'Nitroglycerin PDE5 inhibitor history',
        'Consider reasons to withhold nitroglycerin',
        'Reassess pain and BP before repeat nitroglycerin'
      ],
      supportiveCareOpportunities: [
        '12-lead ECG acquisition',
        'serial reassessment',
        'transport destination or STEMI bypass consideration',
        'pain assessment and reassessment',
        'early transport vs on-scene treatment decision'
      ],
      oxygenGuidance: 'Do not include oxygen unless hypoxia or another clear clinical indication supports it.',
      instructionText: [
        'Use meaningful decision points such as ASA, nitroglycerin, withholding nitroglycerin when contraindicated, reassessment after treatment, repeat nitroglycerin when appropriate, and destination or bypass decisions when supported.',
        'Do not insert oxygen reflexively when SpO2 is normal.'
      ].join(' ')
    };
  }

  // Respiratory scenarios
  if (typeLower === 'respiratory' || callFamily.includes('respiratory') || promptLower.includes('asthma') || promptLower.includes('shortness of breath')) {
    return {
      style: 'respiratory medication decision scenario',
      likelyMedicationOpportunities: [
        'Salbutamol if clinically indicated',
        'Repeat salbutamol after reassessment if still symptomatic',
        'Dexamethasone if clinically indicated'
      ],
      contraindicationChecks: [
        'Confirm the presentation supports bronchodilator use',
        'Reassess response after treatment',
        'Consider fatigue or worsening respiratory status',
        'Consider reasons to escalate care or rapid transport'
      ],
      supportiveCareOpportunities: [
        'positioning',
        'oxygen titration',
        'serial reassessment',
        'work of breathing assessment',
        'consider CPAP if appropriate'
      ],
      oxygenGuidance: 'Use oxygen only when clinically indicated, not automatically.',
      instructionText: [
        'Respiratory treatment decisions should feel earned by the presentation.',
        'Let reassessment matter after initial treatment.',
        'Consider repeat bronchodilator decisions and escalation decisions.'
      ].join(' ')
    };
  }

  // Diabetic scenarios
  if (promptLower.includes('hypogly') || promptLower.includes('glucagon') || promptLower.includes('low blood sugar') || callFamily.includes('diabetic')) {
    return {
      style: 'diabetic medication decision scenario',
      likelyMedicationOpportunities: [
        'Oral glucose when clinically appropriate',
        'Glucagon when clinically appropriate'
      ],
      contraindicationChecks: [
        'Ability to safely take oral glucose',
        'Level of consciousness and swallowing safety',
        'Need for reassessment after treatment',
        'Consider transport even after improvement'
      ],
      supportiveCareOpportunities: [
        'BGL confirmation',
        'serial reassessment',
        'transport decision-making',
        'history gathering around diabetic management'
      ],
      oxygenGuidance: 'Use oxygen only when clinically indicated.',
      instructionText: [
        'Create a real choice between oral glucose, glucagon, or supportive care rather than automatically giving a medication.',
        'Reassessment and transport decisions should matter.'
      ].join(' ')
    };
  }

  // Trauma / Pain scenarios
  if (typeLower === 'trauma' || callFamily.includes('trauma')) {
    return {
      style: 'trauma pain management scenario',
      likelyMedicationOpportunities: [
        'Ketorolac if clinically indicated'
      ],
      contraindicationChecks: [
        'Consider bleeding risk',
        'Consider hypotension',
        'Consider allergy or contraindications',
        'Consider reasons to withhold analgesia'
      ],
      supportiveCareOpportunities: [
        'SMR decision making',
        'splinting',
        'bleeding control',
        'shock recognition',
        'rapid transport decision'
      ],
      oxygenGuidance: 'Use oxygen only when clinically indicated.',
      instructionText: [
        'Pain management should be a decision, not automatic.',
        'Scene management, packaging, and transport decisions should be important parts of the call.'
      ].join(' ')
    };
  }

  // Nausea / vomiting scenarios
  if (promptLower.includes('nausea') || promptLower.includes('vomit') || callFamily.includes('nausea')) {
    return {
      style: 'antiemetic decision scenario',
      likelyMedicationOpportunities: [
        'Ondansetron if clinically indicated'
      ],
      contraindicationChecks: [
        'Consider underlying cause of nausea',
        'Reassess after treatment',
        'Consider hydration and transport decisions'
      ],
      supportiveCareOpportunities: [
        'hydration considerations',
        'positioning',
        'transport decision',
        'history gathering'
      ],
      oxygenGuidance: 'Use oxygen only when clinically indicated.',
      instructionText: [
        'Antiemetic use should be tied to patient comfort and transport considerations, not automatically given.'
      ].join(' ')
    };
  }

  // Default medication logic
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
    oxygenGuidance: 'Use oxygen only when clinically indicated.',
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
  generationDepth,
  generationDepthInstruction,
  includeBystanders,
  includeTeachingCues,
  customPrompt,
  blsStandards,
  alsStandards,
  today,
  scenarioCore,
  medicationPlan,
  semesterProfile
}) {
  const directiveAddendum = buildDirectivePromptAddendum({
    semester,
    type,
    customPrompt
  });

  return `
Generate exactly one paramedic training scenario as valid JSON only.
No markdown. No commentary. No code fences.

Return these top-level fields:
- scenarioIntro
- title
- callInformation
- patientDemographics
- patientPresentation
- incidentNarrative
- opqrst
- sample
- medications
- allergies
- pastMedicalHistory
- physicalExam
- vitalSigns
- caseProgression
- expectedTreatment
- protocolNotes
- learningObjectives
- vocationalLearningOutcomes
- selfReflectionPrompts
- grsAnchors
- teachersPoints
- scenarioRationale
- clinicalReasoning

Required object structure:
- vitalSigns must contain:
{
  "firstSet": { "hr": "", "rr": "", "bp": "", "spo2": "", "etco2": "", "temp": "", "gcs": "", "bgl": "", "ecgInterpretation": "" },
  "secondSet": { "hr": "", "rr": "", "bp": "", "spo2": "", "etco2": "", "temp": "", "gcs": "", "bgl": "", "ecgInterpretation": "" }
}

- caseProgression must contain:
{
  "withProperTreatment": "",
  "withoutProperTreatment": ""
}

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

- grsAnchors must contain these EXACT 7 domains:
  - situationalAwareness
  - patientAssessment
  - historyGathering
  - decisionMaking
  - proceduralSkill
  - resourceUtilization
  - communication

GRS rules:
- Each of the 7 domains must contain exactly these score keys: "1", "3", "5", "7"
- Each score key must contain an array
- Each score array must contain at least 3 short, scenario-specific behavioural bullet examples
- Do not use vague traits like "good communicator"
- Score 1 = unsafe, incomplete, harmful, or clearly weak
- Score 3 = developing but inconsistent, delayed, hesitant, or shallow
- Score 5 = competent semester-appropriate performance; this is the expected standard
- Score 7 = exceptional, anticipatory, organized, calm, and highly effective
- Keep the GRS structure standardized, but tailor the actual bullets to THIS case

ECG rules:
Use only these exact ECG values when appropriate:
${ECG_WHITELIST.map((item) => `- ${item}`).join('\n')}
- Do not add rate, qualifiers, or extra descriptors
- If ECG is relevant, place it in vitalSigns.firstSet.ecgInterpretation
- Update vitalSigns.secondSet.ecgInterpretation only if the rhythm changes
- Do not use a separate top-level ecgInterpretation field
- If the case is isolated trauma, leave ecgInterpretation blank

Scenario parameters:
- Semester: ${semester}
- Type: ${type}
- Environment: ${environment}
- Complexity: ${complexity}
- Uniqueness: ${uniqueness}
- Generation depth: ${generationDepth || 'Standard'}
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
- Improper treatment progression: ${scenarioCore.progressionStyle.withoutProperTreatment}

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
- ${getUniquenessInstruction(uniqueness)}
- ${generationDepthInstruction || 'Generation depth selected: Standard. Balance generation time with realistic detail and teaching value.'}
- ${medicationPlan.instructionText}
- Write like an experienced Ontario paramedic instructor building a realistic teaching case for lab.
- Prioritize realism over textbook neatness.
- Avoid generic protocol-summary phrasing.
- Build the scenario from the outside in: realistic dispatch, believable patient presentation, meaningful assessment findings, then clinically justified treatment opportunities.
- Make the scenario internally coherent across chief complaint, history, physical findings, vital signs, ECG use, progression, differential, and treatment.
- The selected type, environment, complexity, semester, and uniqueness must all produce visible differences in the final scenario.
- Avoid generic template-feeling scenarios; make this one feel deliberately authored.
- Use patient or bystander dialogue where it adds realism, but keep it purposeful.
- Keep the tone direct, educational, clinically grounded, and useful for paramedic teaching.
- Teacher's Points should sound like a senior paramedic coaching a student.
- OPQRST must be fully populated when clinically applicable, with meaningful content in each element.
- SAMPLE must be fully populated with clinically useful detail, not placeholders.
- Chief complaint must never be blank and should be concise and patient-centered.
- Physical assessment must be populated across relevant fields.
- General appearance should describe what the crew sees on arrival.
- Airway should comment on patency or obstruction.
- Breathing should comment on rate, effort, breath sounds, and visible respiratory distress.
- Circulation should comment on pulse, perfusion, skin findings, and shock signs where relevant.
- Neuro should comment on mental status, orientation, and LOC where relevant.
- Case progression must clearly show a believable path with proper treatment and a believable deterioration or lack of improvement without proper treatment.
- expectedTreatment must be a structured multi-item list of practical paramedic actions, not a paragraph.
- protocolNotes must be a structured multi-item list, not a paragraph.
- teachersPoints must be multiple distinct coaching points, not one dense paragraph.
- learningObjectives, vocationalLearningOutcomes, and selfReflectionPrompts must each be list items, not combined prose.
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
Ontario directive accuracy rules:
${directiveAddendum.map((line) => `- ${line}`).join('\n')}

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

const GENERATION_DEPTH_PROFILES = {
  'Quick Draft': {
    label: 'Quick Draft',
    maxTokens: Number(process.env.OPENAI_MAX_TOKENS_QUICK || 8192),
    instruction: 'Generation depth selected: Quick Draft. Keep the scenario complete and usable, but leaner and more direct. Do not omit required sections.'
  },
  Standard: {
    label: 'Standard',
    maxTokens: Number(process.env.OPENAI_MAX_TOKENS_STANDARD || 16384),
    instruction: 'Generation depth selected: Standard. Balance generation time with realistic detail, scenario coherence, and teaching value.'
  },
  Detailed: {
    label: 'Detailed',
    maxTokens: Number(process.env.OPENAI_MAX_TOKENS_DETAILED || 16384),
    instruction: 'Generation depth selected: Detailed. Prioritize richer instructional detail, stronger internal coherence, scenario-specific GRS anchors, dynamic progression, and field realism.'
  }
};

const getGenerationDepthProfile = (generationDepth = 'Standard') => {
  return GENERATION_DEPTH_PROFILES[generationDepth] || GENERATION_DEPTH_PROFILES.Standard;
};

router.post('/', async (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');

  const {
    semester = '3',
    type = 'Medical',
    environment = 'Urban',
    complexity = 'Moderate',
    uniqueness = 'Common',
    generationDepth = 'Standard',
    includeBystanders = true,
    includeTeachingCues = true,
    customPrompt = ''
  } = req.body || {};

  try {
    const {
      profile,
      fewShots,
      blsStandards,
      alsStandards
    } = await loadStaticData();

    const generationProfile = getGenerationDepthProfile(generationDepth);

    const semesterProfile = buildSemesterDifficultyProfile(semester);
    const scenarioCore = buildScenarioCore({
      semester,
      type,
      environment,
      complexity,
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
      complexity,
      uniqueness,
      generationDepth: generationProfile.label,
      generationDepthInstruction: generationProfile.instruction,
      includeBystanders,
      includeTeachingCues,
      customPrompt,
      blsStandards,
      alsStandards,
      today: new Date().toLocaleDateString('en-CA'),
      scenarioCore,
      medicationPlan,
      semesterProfile
    });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.9,
      max_tokens: generationProfile.maxTokens,
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
      customPrompt
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