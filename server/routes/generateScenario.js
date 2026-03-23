import 'dotenv/config';
import express from 'express';
import OpenAI from 'openai';
import fs from 'fs/promises';
import path from 'path';
import { buildDirectivePromptAddendum } from "../data/ontarioDirectiveRules.js";
import { fileURLToPath } from 'url';
import { jsonrepair } from 'jsonrepair';

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
    age: '',
    sex: '',
    weight: '',
    chiefComplaint: ''
  };
}

function defaultPhysicalExam() {
  return {
    general: '',
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
  callInformation: '',
  patientDemographics: defaultPatientDemographics(),
  patientPresentation: '',
  incidentNarrative: '',
  opqrst: [],
  sample: [],
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

    if (sentenceSplit.length > 1) {
      return sentenceSplit;
    }

    const semicolonSplit = trimmed
      .split(/\s*;\s*/)
      .map((part) => part.trim())
      .filter(Boolean);

    if (semicolonSplit.length > 1) {
      return semicolonSplit;
    }

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

function normalizeMappedBulletSection(value, labelMap) {
  if (Array.isArray(value)) return value;
  if (value == null || value === '') return [];

  if (typeof value === 'string') {
    return splitLinesToArray(value);
  }

  if (typeof value === 'object') {
    return Object.entries(labelMap)
      .map(([key, label]) => {
        const rendered = stringifyValue(value[key]);
        return rendered ? `${label}: ${rendered}` : null;
      })
      .filter(Boolean);
  }

  return [String(value)];
}

function normalizeOpqrst(value) {
  return normalizeMappedBulletSection(value, {
    onset: 'Onset',
    provocation: 'Provocation/Palliation',
    quality: 'Quality',
    radiation: 'Radiation',
    severity: 'Severity',
    time: 'Time'
  });
}

function normalizeSample(value) {
  return normalizeMappedBulletSection(value, {
    signsSymptoms: 'Signs/Symptoms',
    allergies: 'Allergies',
    medications: 'Medications',
    pastMedicalHistory: 'Past Medical History',
    lastOralIntake: 'Last Oral Intake',
    eventsLeadingUp: 'Events Leading Up'
  });
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

  if (ecgInterpretation && ECG_WHITELIST.includes(ecgInterpretation)) {
    if (!firstSet.ecgInterpretation) {
      firstSet.ecgInterpretation = ecgInterpretation;
    }
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
    normalized.callInformation,
    normalized.patientPresentation,
    normalized.incidentNarrative,
    ...(normalized.opqrst || []),
    ...(normalized.sample || []),
    ...(normalized.medications || []),
    ...(normalized.allergies || []),
    ...(normalized.pastMedicalHistory || []),
    normalized.caseProgression?.withProperTreatment,
    normalized.caseProgression?.withoutProperTreatment,
    normalized.teachersPoints,
    normalized.scenarioRationale,
    normalized.clinicalReasoning?.summary,
    normalized.clinicalReasoning?.conclusion
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const text = allScenarioText;

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
    text.includes('difficulty breathing') ||
    text.includes('increased work of breathing') ||
    text.includes('hyperventilation');

  const anxietyLike =
    text.includes('anxiety') ||
    text.includes('panic') ||
    text.includes('panicky') ||
    text.includes('overwhelmed') ||
    text.includes('hyperventilation') ||
    text.includes('stress') ||
    text.includes('stressful exam') ||
    text.includes('exam stress');

  const cardiac =
    text.includes('chest pain') ||
    text.includes('stemi') ||
    text.includes('nstemi') ||
    text.includes('palpitations') ||
    text.includes('syncope') ||
    text.includes('arrhythmia') ||
    text.includes('myocardial') ||
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
    text.includes('assault') ||
    text.includes('laceration') ||
    text.includes('fracture') ||
    text.includes('deformity') ||
    text.includes('ejected') ||
    text.includes('mechanism of injury');

  const hypoglycemia =
    text.includes('hypogly') ||
    text.includes('low sugar') ||
    text.includes('low blood sugar') ||
    text.includes('diabetic') ||
    text.includes('glucagon') ||
    text.includes('insulin') ||
    text.includes('bgl') ||
    text.includes('blood glucose');

  const strokeNeuro =
    text.includes('stroke') ||
    text.includes('cva') ||
    text.includes('tia') ||
    text.includes('facial droop') ||
    text.includes('slurred speech') ||
    text.includes('aphasia') ||
    text.includes('unilateral weakness') ||
    text.includes('seizure') ||
    text.includes('postictal') ||
    text.includes('confusion') ||
    text.includes('altered level of consciousness') ||
    text.includes('altered mental status');

  const sepsisShock =
    text.includes('sepsis') ||
    text.includes('septic') ||
    text.includes('infection') ||
    text.includes('fever') ||
    text.includes('febrile') ||
    text.includes('hypotension') ||
    text.includes('shock') ||
    text.includes('poor perfusion') ||
    text.includes('tachycardic') ||
    text.includes('rigors') ||
    text.includes('source of infection');

  const anaphylaxis =
    text.includes('anaphylaxis') ||
    text.includes('allergic reaction') ||
    text.includes('hives') ||
    text.includes('urticaria') ||
    text.includes('angioedema') ||
    text.includes('stridor') ||
    text.includes('throat swelling') ||
    text.includes('epinephrine') ||
    text.includes('allergen');

  const overdoseToxicology =
    text.includes('overdose') ||
    text.includes('poison') ||
    text.includes('opioid') ||
    text.includes('naloxone') ||
    text.includes('toxic') ||
    text.includes('substance use') ||
    text.includes('intoxication') ||
    text.includes('ingestion') ||
    text.includes('pinpoint pupils');

  const environmental =
    text.includes('heat exhaustion') ||
    text.includes('heat stroke') ||
    text.includes('hyperthermia') ||
    text.includes('hypothermia') ||
    text.includes('cold exposure') ||
    text.includes('heat exposure') ||
    text.includes('frostbite') ||
    text.includes('dehydration');

  const exam = normalized.physicalExam || defaultPhysicalExam();

  const fillIfBlank = (key, value) => {
    if (!exam[key] && value) {
      exam[key] = value;
    }
  };

  // Demographics fallback
  if (!normalized.patientDemographics) {
    normalized.patientDemographics = defaultPatientDemographics();
  }

  const demographics = normalized.patientDemographics;

  if (!demographics.age) {
    if (text.includes('toddler') || text.includes('2-year-old') || text.includes('2 year old')) {
      demographics.age = '2';
    } else if (
      text.includes('child') ||
      text.includes('pediatric') ||
      text.includes('7-year-old') ||
      text.includes('7 year old')
    ) {
      demographics.age = '7';
    } else if (
      text.includes('elderly') ||
      text.includes('82 y/o') ||
      text.includes('82-year-old') ||
      text.includes('82 year old')
    ) {
      demographics.age = '82';
    } else if (
      text.includes('college student') ||
      text.includes('student') ||
      text.includes('dormitory') ||
      text.includes('campus')
    ) {
      demographics.age = '19';
    } else {
      demographics.age = '35';
    }
  }

  if (!demographics.sex) {
    if (
      text.includes('female') ||
      text.includes('woman') ||
      text.includes('mother') ||
      text.includes('pregnant') ||
      text.includes('labour') ||
      text.includes('labor')
    ) {
      demographics.sex = 'Female';
    } else if (
      text.includes('male') ||
      text.includes('man') ||
      text.includes('father') ||
      text.includes('boy')
    ) {
      demographics.sex = 'Male';
    } else {
      demographics.sex = 'Unknown';
    }
  }

  if (!demographics.weight) {
    if (text.includes('toddler') || text.includes('2-year-old') || text.includes('2 year old')) {
      demographics.weight = '30 lbs';
    } else if (text.includes('child') || text.includes('7-year-old') || text.includes('7 year old')) {
      demographics.weight = '50 lbs';
    } else if (text.includes('elderly') || text.includes('frail')) {
      demographics.weight = '110 lbs';
    } else if (
      text.includes('college student') ||
      text.includes('student') ||
      text.includes('campus')
    ) {
      demographics.weight = '160 lbs';
    } else {
      demographics.weight = '70 kg';
    }
  }

  const setChiefComplaintIfBlank = (value) => {
    if (!normalized.patientDemographics?.chiefComplaint && value) {
      normalized.patientDemographics.chiefComplaint = value;
    }
  };

  if (!normalized.patientDemographics?.chiefComplaint) {
    const qualityLine = (normalized.opqrst || []).find((line) => /^quality:/i.test(line));
    const sxLine = (normalized.sample || []).find((line) => /^signs\/symptoms:/i.test(line));

    if (qualityLine) {
      setChiefComplaintIfBlank(qualityLine.replace(/^quality:\s*/i, '').trim());
    } else if (sxLine) {
      setChiefComplaintIfBlank(sxLine.replace(/^signs\/symptoms:\s*/i, '').trim());
    } else if (respiratory) {
      setChiefComplaintIfBlank('Difficulty breathing');
    } else if (anxietyLike) {
      setChiefComplaintIfBlank('Chest tightness and feeling overwhelmed');
    } else if (cardiac) {
      setChiefComplaintIfBlank('Chest pain');
    } else if (trauma) {
      setChiefComplaintIfBlank('Traumatic injury');
    } else if (hypoglycemia) {
      setChiefComplaintIfBlank('Altered level of consciousness');
    } else if (strokeNeuro) {
      setChiefComplaintIfBlank('Neurological deficit');
    } else if (anaphylaxis) {
      setChiefComplaintIfBlank('Allergic reaction');
    } else if (sepsisShock) {
      setChiefComplaintIfBlank('Weakness and possible infection');
    } else if (overdoseToxicology) {
      setChiefComplaintIfBlank('Decreased level of consciousness');
    } else if (environmental) {
      setChiefComplaintIfBlank('Environmental exposure');
    }
  }

  if (!exam.general) {
    exam.general =
      normalized.patientPresentation ||
      normalized.scenarioIntro ||
      'Patient appears acutely unwell and requires focused assessment.';
  }

  if (respiratory) {
    fillIfBlank('airway', 'Patent, able to maintain airway, speaking in short phrases without visible obstruction.');
    fillIfBlank('breathing', 'Tachypneic with increased work of breathing, accessory muscle use, and abnormal breath sounds.');
    fillIfBlank('circulation', 'Tachycardic, skin warm or mildly diaphoretic, peripheral perfusion present.');
    fillIfBlank('neuro', 'Alert and oriented, anxious but cooperative, follows commands appropriately.');
    fillIfBlank('headNeck', 'Trachea midline, no facial swelling, no jugular venous distention, no upper airway trauma.');
    fillIfBlank('chest', 'Reduced air entry and/or wheeze present bilaterally with increased respiratory effort.');
    fillIfBlank('abdomen', 'Soft, non-tender, no relevant acute abdominal findings.');
    fillIfBlank('pelvis', 'Stable, no relevant acute findings.');
    fillIfBlank('skin', 'May be pale or mildly diaphoretic depending on respiratory distress severity.');
  }

  if (anxietyLike) {
    fillIfBlank('airway', 'Patent.');
    fillIfBlank('breathing', 'Rapid breathing pattern consistent with hyperventilation, without obvious wheeze or crackles.');
    fillIfBlank('circulation', 'Pulse may be rapid from anxiety; perfusion remains intact.');
    fillIfBlank('neuro', 'Alert and oriented, anxious, emotionally overwhelmed, responds appropriately to reassurance.');
    fillIfBlank('headNeck', 'No obvious trauma or focal upper airway issue.');
    fillIfBlank('chest', 'Chest tightness reported without obvious traumatic findings; symptoms should be interpreted alongside anxiety and hyperventilation features.');
    fillIfBlank('abdomen', 'Soft, non-tender, no obvious acute findings.');
    fillIfBlank('pelvis', 'Stable, no obvious tenderness, deformity, or instability.');
    fillIfBlank('extremities', 'No obvious deformity or acute neurovascular deficit.');
    fillIfBlank('skin', 'May be cool, pale, or clammy during acute anxiety or hyperventilation.');
  }

  if (cardiac && !anxietyLike) {
    fillIfBlank('airway', 'Patent, no immediate airway compromise noted.');
    fillIfBlank('breathing', 'Breathing pattern may be mildly increased due to pain or anxiety; reassess for associated respiratory distress.');
    fillIfBlank('circulation', 'Pulse present, assess rate/rhythm/perfusion closely; skin may be pale, cool, or diaphoretic.');
    fillIfBlank('neuro', 'Alert and oriented unless perfusion is worsening or syncope has occurred.');
    fillIfBlank('headNeck', 'No obvious trauma, no major upper airway issue, consider JVD if clinically appropriate.');
    fillIfBlank('chest', 'Chest discomfort present without obvious traumatic findings; consider pressure, tightness, or radiation if supported by history.');
    fillIfBlank('abdomen', 'Soft, non-tender, no primary abdominal findings unless atypical presentation suspected.');
    fillIfBlank('skin', 'May be cool, pale, and diaphoretic.');
  }

  if (trauma) {
    fillIfBlank('airway', 'Assess for patency and need for protection; no obstruction unless supported by mechanism or facial injury.');
    fillIfBlank('breathing', 'Assess chest rise, work of breathing, and breath sounds for trauma-related compromise.');
    fillIfBlank('circulation', 'Assess for bleeding, perfusion, skin signs, and evidence of shock.');
    fillIfBlank('neuro', 'Assess LOC, GCS, pupils, and motor/sensory deficits based on mechanism.');
    fillIfBlank('headNeck', 'Inspect and palpate for tenderness, deformity, bleeding, swelling, or spinal concerns.');
    fillIfBlank('chest', 'Inspect for tenderness, bruising, deformity, paradoxical movement, or pain with breathing.');
    fillIfBlank('abdomen', 'Assess for tenderness, guarding, distension, or bruising.');
    fillIfBlank('pelvis', 'Pelvis stable or tender depending on mechanism; assess carefully and avoid repeated manipulation.');
    fillIfBlank('extremities', 'Inspect for deformity, pain, swelling, bleeding, and distal neurovascular status.');
    fillIfBlank('skin', 'May be pale, cool, diaphoretic, or show bruising/lacerations depending on injuries.');
  }

  if (hypoglycemia) {
    fillIfBlank('airway', 'Airway patent; monitor closely if LOC is decreased.');
    fillIfBlank('breathing', 'Breathing adequate unless level of consciousness is significantly reduced.');
    fillIfBlank('circulation', 'Pulse present; skin may be cool, pale, or diaphoretic.');
    fillIfBlank('neuro', 'Altered mental status ranging from confusion to decreased LOC, depending on blood glucose level.');
    fillIfBlank('abdomen', 'No primary acute abdominal findings unless supported by history.');
    fillIfBlank('skin', 'Cool, pale, diaphoretic skin is common.');
  }

  if (strokeNeuro) {
    fillIfBlank('airway', 'Airway patent, though ongoing monitoring is required if LOC decreases.');
    fillIfBlank('breathing', 'Breathing generally adequate but reassess for irregular pattern or aspiration risk.');
    fillIfBlank('circulation', 'Pulse present, perfusion variable; blood pressure may be elevated.');
    fillIfBlank('neuro', 'Focal neurological deficits may be present, including weakness, facial droop, speech changes, or altered mentation.');
    fillIfBlank('headNeck', 'No obvious trauma unless collapse occurred; assess pupils and gaze preference where relevant.');
    fillIfBlank('skin', 'Skin signs variable; may appear normal or mildly diaphoretic depending on stress response.');
  }

  if (sepsisShock) {
    fillIfBlank('airway', 'Airway patent at present, reassess if fatigue or decreased LOC develops.');
    fillIfBlank('breathing', 'Breathing may be increased as compensation for metabolic stress or poor perfusion.');
    fillIfBlank('circulation', 'Perfusion may be poor with tachycardia, hypotension, delayed capillary refill, and signs of shock.');
    fillIfBlank('neuro', 'May be alert, confused, or lethargic depending on severity and perfusion.');
    fillIfBlank('abdomen', 'Assess based on suspected source; may be soft, tender, or benign depending on infection focus.');
    fillIfBlank('skin', 'Skin may be hot and flushed early or cool, pale, and clammy later as shock worsens.');
  }

  if (anaphylaxis) {
    fillIfBlank('airway', 'Airway may be threatened by swelling, hoarseness, or stridor; assess continuously.');
    fillIfBlank('breathing', 'Respiratory distress may include wheeze, stridor, increased effort, and poor air movement.');
    fillIfBlank('circulation', 'Perfusion may deteriorate with vasodilation, tachycardia, and hypotension.');
    fillIfBlank('neuro', 'Anxious but oriented initially; mental status may worsen if shock progresses.');
    fillIfBlank('headNeck', 'Possible lip, tongue, or facial swelling; voice changes may be present.');
    fillIfBlank('chest', 'Wheeze or tight chest may be present with allergic bronchospasm.');
    fillIfBlank('skin', 'Urticaria, flushing, or itching may be present, though severe anaphylaxis can occur without obvious rash.');
  }

  if (overdoseToxicology) {
    fillIfBlank('airway', 'Airway may be poorly maintained if LOC is reduced; position and adjuncts may be required.');
    fillIfBlank('breathing', 'Respiratory depression or ineffective breathing may be present depending on substance involved.');
    fillIfBlank('circulation', 'Pulse and perfusion vary by toxidrome; reassess for shock, bradycardia, or tachycardia.');
    fillIfBlank('neuro', 'Level of consciousness may be decreased, confused, or obtunded depending on exposure.');
    fillIfBlank('skin', 'Skin may be cool, clammy, flushed, or normal depending on toxidrome.');
  }

  if (environmental) {
    fillIfBlank('airway', 'Airway patent unless LOC is significantly reduced.');
    fillIfBlank('breathing', 'Breathing may be increased or depressed depending on thermal stress and level of fatigue.');
    fillIfBlank('circulation', 'Perfusion may be impaired depending on dehydration, vasodilation, or cold exposure.');
    fillIfBlank('neuro', 'Patient may be weak, confused, lethargic, or irritable depending on temperature-related illness severity.');
    fillIfBlank('skin', 'Skin may be hot and flushed, cool and clammy, or cold depending on the environmental problem.');
  }

  // Final neutral physical exam fallbacks so no major fields remain blank
  fillIfBlank('airway', 'Patent.');
  fillIfBlank('breathing', 'Breathing present, no immediately obvious compromise on initial exam.');
  fillIfBlank('circulation', 'Peripheral perfusion present, no immediately obvious circulatory collapse.');
  fillIfBlank('neuro', 'Alert and oriented or mental status appropriately documented for presentation.');
  fillIfBlank('headNeck', 'No obvious acute head or neck findings.');
  fillIfBlank('chest', 'No obvious acute chest findings on initial assessment.');
  fillIfBlank('abdomen', 'Soft, non-tender, no obvious acute findings.');
  fillIfBlank('pelvis', 'Stable, no obvious tenderness, deformity, or instability.');
  fillIfBlank('extremities', 'No obvious deformity, major edema, or acute neurovascular deficit.');
  fillIfBlank('skin', 'Skin findings appropriate to presentation; no additional acute abnormalities noted.');

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

  const opqrstSource = pickFirstDefined(
    source.opqrst,
    source.OPQRST,
    source.opqrstAssessment,
    source.painAssessment
  );

  const sampleSource = pickFirstDefined(
    source.sample,
    source.SAMPLE,
    source.sampleHistory,
    source.historySample
  );

  normalized.selfReflectionPrompts = coerceArray(
    pickFirstDefined(source.selfReflectionPrompts, source.selfReflectiveQuestions)
  );
  normalized.learningObjectives = coerceArray(source.learningObjectives);
  normalized.vocationalLearningOutcomes = coerceArray(source.vocationalLearningOutcomes);
  normalized.expectedTreatment = coerceArray(source.expectedTreatment);
  normalized.protocolNotes = coerceArray(source.protocolNotes);
  normalized.sample = normalizeSample(sampleSource);
  normalized.opqrst = normalizeOpqrst(opqrstSource);
  normalized.medications = coerceArray(source.medications);
  normalized.allergies = coerceArray(source.allergies);
  normalized.pastMedicalHistory = coerceArray(source.pastMedicalHistory);

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

function getSemesterInstruction(semester) {
  switch (String(semester)) {
    case '2':
      return [
        'This scenario is for a Semester 2 PCP learner.',
        'No ALS symptom-relief medications or advanced PCP medication decision-making should be expected.',
        'Keep the case more straightforward, with clearer patterns and lower ambiguity.',
        'Emphasize scene approach, primary survey, basic assessment, history gathering, communication, oxygen decisions where appropriate, and safe foundational care.',
        'Expected treatment and GRS anchors should reflect an earlier learner who is still building structure, confidence, and organization.',
        'Avoid making the case depend on subtle advanced interpretation or nuanced treatment sequencing.'
      ].join(' ');

    case '3':
      return [
        'This scenario is for a Semester 3 PCP learner.',
        'PCP medication scope and ALS interventions within PCP standards may be included when clinically appropriate.',
        'Use moderate complexity with clearer teachable moments, but expect more independent assessment and decision-making than Semester 2.',
        'Expected treatment and GRS anchors should reflect a learner who can recognize patterns, initiate appropriate treatment, and reassess with reasonable autonomy.',
        'The case should still support coaching and visible growth, rather than feeling like a fully polished field practitioner scenario.'
      ].join(' ');

    case '4':
      return [
        'This scenario is for a Semester 4 PCP learner.',
        'Use fuller PCP scope, stronger autonomy, more realistic field messiness, and more layered decision-making.',
        'Allow greater ambiguity, operational pressure, and responsibility for prioritization, communication, and resource use.',
        'Expected treatment and GRS anchors should reflect a near-graduation learner who is expected to organize the call well and think ahead.',
        'Do not make it artificially simple or overly hand-held.'
      ].join(' ');

    default:
      return `Tailor the case and expectations to Semester ${semester} learner level in a concrete way.`;
  }
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
  includeBystanders,
  includeTeachingCues,
  customPrompt,
  blsStandards,
  alsStandards,
  today
}) {
  const directiveAddendum = buildDirectivePromptAddendum({
    semester,
    type,
    customPrompt
  });

  return `
Generate exactly one paramedic training scenario as valid JSON only. No markdown. No commentary. No code fences.

Top-level fields required:
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

vitalSigns must contain:
{
  "firstSet": { "hr": "", "rr": "", "bp": "", "spo2": "", "etco2": "", "temp": "", "gcs": "", "bgl": "", "ecgInterpretation": "" },
  "secondSet": { "hr": "", "rr": "", "bp": "", "spo2": "", "etco2": "", "temp": "", "gcs": "", "bgl": "", "ecgInterpretation": "" }
}

caseProgression must contain:
{
  "withProperTreatment": "",
  "withoutProperTreatment": ""
}

clinicalReasoning must contain:
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

grsAnchors must contain these EXACT 7 domains:
- situationalAwareness
- patientAssessment
- historyGathering
- decisionMaking
- proceduralSkill
- resourceUtilization
- communication

For EACH of the 7 domains:
- You must include exactly these score keys: "1", "3", "5", and "7"
- Each score key must contain an ARRAY
- Each score array must contain AT LEAST 3 short bullet-style behavioural examples
- Every bullet must be scenario-specific
- Every bullet must describe observable learner behaviour, not vague personality traits
- Keep the structure standardized across scenarios, but tailor the wording to the scenario
- Do not return paragraphs
- Do not return one-line summaries
- Do not leave any score empty

Scoring intent:
- 1 = unsafe, disorganized, incomplete, harmful, or misses key priorities
- 3 = partially correct, hesitant, delayed, inconsistent, shallow, or incomplete
- 5 = competent semester-appropriate performance; this is the expected standard
- 7 = exceptional, anticipatory, calm, integrated, and clearly above expected level

Anchor writing rules:
- Score 1 bullets should show what the learner missed, delayed, or did unsafely
- Score 3 bullets should show partial understanding, incomplete execution, or weak prioritization
- Score 5 bullets should show solid, competent, expected student performance
- Score 7 bullets should show excellent anticipation, organization, communication, and reassessment
- Use a consistent skeleton across all scenarios: scene control, assessment quality, history quality, treatment timing, reassessment, communication, and transport/resource planning where relevant
- Keep the anchor structure standardized, but make the actual bullets specific to the patient, scene, presentation, and likely errors in THIS scenario

Required output example:
"communication": {
  "1": [
    "example bullet",
    "example bullet",
    "example bullet"
  ],
  "3": [
    "example bullet",
    "example bullet",
    "example bullet"
  ],
  "5": [
    "example bullet",
    "example bullet",
    "example bullet"
  ],
  "7": [
    "example bullet",
    "example bullet",
    "example bullet"
  ]
}

Use only these exact ECG values when appropriate:
${ECG_WHITELIST.map((item) => `- ${item}`).join('\n')}
Do not add rate, qualifiers, or extra descriptors.
When ECG is relevant, place the value inside:
vitalSigns.firstSet.ecgInterpretation
and update vitalSigns.secondSet.ecgInterpretation if the rhythm changes.
Do NOT use a separate top-level ecgInterpretation field.
If the case is isolated trauma, leave ecgInterpretation blank.

Scenario parameters:
- Semester: ${semester}
- Type: ${type}
- Environment: ${environment}
- Complexity: ${complexity}
- Uniqueness: ${uniqueness}
- Bystanders: ${includeBystanders ? 'Include them when useful.' : 'Do not include them.'}
- Teaching cues: ${includeTeachingCues ? 'Embed brief inline cues using the exact format *(💡 cue text)* where helpful.' : 'Do not include inline teaching cues.'}

Scenario shaping rules:
- ${getSemesterInstruction(semester)}
- ${getTypeInstruction(type)}
- ${getEnvironmentInstruction(environment)}
- ${getComplexityInstruction(complexity)}
- ${getUniquenessInstruction(uniqueness)}
Ontario directive accuracy rules:
${directiveAddendum.map((line) => `- ${line}`).join('\n')}
- Reference BLS PCS and ALS PCS when relevant in protocolNotes and expectedTreatment.
- Make the scenario internally coherent across chief complaint, history, physical findings, vital signs, ECG use, progression, differential, and treatment.
- The selected type, environment, complexity, semester, and uniqueness must all produce visible differences in the final scenario.
- Avoid generic "template-feeling" scenarios. Make this one feel deliberately authored.
- Use patient or bystander dialogue where it adds realism, but keep it purposeful.
- Keep the tone direct, educational, clinically grounded, and useful for paramedic teaching.
- Teacher's Points should sound like a senior paramedic coaching a student.
- OPQRST must be fully populated when clinically applicable, with meaningful content in each element.
- SAMPLE must be fully populated with clinically useful detail, not placeholders.
- Chief complaint must never be left blank and should be a concise patient-centered phrase such as "difficulty breathing" or "crushing chest pain."
- Physical assessment must be populated across the relevant fields for the case.
- General appearance should describe what the crew sees on arrival.
- Airway should comment on patency or obstruction.
- Breathing should comment on rate, effort, breath sounds, and visible respiratory distress.
- Circulation should comment on pulse, perfusion, skin findings, and signs of shock where relevant.
- Neuro should comment on mental status, orientation, and LOC where relevant.
- Case progression should clearly show a believable path with proper treatment and a believable deterioration or lack of improvement without proper treatment.
- Expected treatment must be returned as a structured multi-item list of practical paramedic actions, not a paragraph.
- Protocol notes must be returned as a structured multi-item list, not a paragraph.
- Teacher's Points must be returned as multiple distinct coaching points, not one dense paragraph.
- Learning objectives, vocational learning outcomes, and self-reflection prompts must each be returned as list items, not combined prose.
- GRS anchors must use the exact 7 backend domain names.
- Every GRS domain must contain score keys 1, 3, 5, and 7.
- Every score must contain at least 3 short behavioural bullet examples.
- GRS anchors must reflect semester level, scenario type, likely errors, expected priorities, and realistic learner behaviours for THIS case.
- Score 1 should show unsafe, incomplete, harmful, or clearly weak student performance.
- Score 3 should show developing but inconsistent, delayed, hesitant, or shallow performance.
- Score 5 should show competent semester-appropriate performance and represent the expected standard.
- Score 7 should show exceptional, anticipatory, organized, calm, and highly effective performance.
- Do not use generic traits like "good communicator" or "poor assessment."
- Avoid empty strings for clinically relevant fields unless the field is truly not applicable.
- Return all required fields every time with meaningful scenario-specific content, not placeholder brevity.


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

router.post('/', async (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');

   const {
    semester = '3',
    type = 'Medical',
    environment = 'Urban',
    complexity = 'Moderate',
    uniqueness = 'Common',
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

        const prompt = buildGenerationPrompt({
      semester,
      type,
      environment,
      complexity,
      uniqueness,
      includeBystanders,
      includeTeachingCues,
      customPrompt,
      blsStandards,
      alsStandards,
      today: new Date().toLocaleDateString('en-CA')
    });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.9,
      max_tokens: 8192,
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