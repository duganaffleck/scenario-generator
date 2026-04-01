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

const INSTRUCTOR_PROFILE_PATH = path.resolve(
  __dirname,
  '../data/scenario-instructor-profile.txt'
);

const FEW_SHOTS_PATH = path.resolve(
  __dirname,
  '../data/few-shot-scenarios.json'
);

let instructorProfileCache = null;
let fewShotsCache = null;

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

function buildFewShotBlock(fewShots, finalCallType) {
  if (!Array.isArray(fewShots) || !fewShots.length) return '';

  const normalizedType = String(finalCallType || '').trim().toLowerCase();

  const matching = fewShots.filter(
    (item) =>
      String(item?.callInformation?.type || '')
        .trim()
        .toLowerCase() === normalizedType
  );

  const selected = (matching.length ? matching : fewShots).slice(0, 3);

  return JSON.stringify(selected, null, 2);
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
    airway: '',
    breathing: '',
    circulation: '',
    neuro: '',
    headNeck: '',
    chest: '',
    abdomen: '',
    pelvis: '',
    extremities: '',
    skin: '',
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

  midCallEvent: {
    timing: '',
    trigger: '',
    event: '',
    newInformation: '',
    patientChange: '',
    sceneChange: '',
    requiredResponse: ''
  },

  caseProgression: {
    earlyCourse: '',
    withProperTreatment: '',
    withoutProperTreatment: '',
    withIncorrectTreatment: '',
    transportPhase: ''
  },

  transportPhase: {
    packaging: '',
    transportDecision: '',
    transportConsiderations: [],
    ongoingCare: [],
    reassessmentFocus: [],
    handoffConsiderations: []
  },

  expectedTreatment: [],
  protocolNotes: [],
  learningObjectives: [],
  selfReflectionPrompts: [],
  grsAnchors: defaultGrsAnchors(),
  teachersPoints: [],
  scenarioRationale: '',

  clinicalReasoning: {
    summary: '',
    pathophysiology: '',
    differentialDiagnosis: [],
    ruleInFeatures: [],
    ruleOutFeatures: [],
    redFlags: [],
    treatmentPriorities: [],
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
    ? value.differentialDiagnosis.map((item) => {
        if (typeof item === 'string') {
          return {
            condition: item,
            supportingFeatures: '',
            rulingOutFeatures: ''
          };
        }

        return {
          condition: item?.condition || '',
          supportingFeatures: item?.supportingFeatures || '',
          rulingOutFeatures: item?.rulingOutFeatures || ''
        };
      })
    : [];

  return {
    summary: value.summary || value.pathophysiologySummary || '',
    pathophysiology: value.pathophysiology || '',
    differentialDiagnosis,
    ruleInFeatures: coerceArray(value.ruleInFeatures),
    ruleOutFeatures: coerceArray(value.ruleOutFeatures),
    redFlags: coerceArray(value.redFlags),
    treatmentPriorities: coerceArray(value.treatmentPriorities),
    conclusion: value.conclusion || value.workingDiagnosis || ''
  };
}

function normalizeVitalSigns(value, ecgInterpretation) {
  const source = value && typeof value === 'object' ? value : {};
  const firstRaw = source.firstSet || source.first || {};
  const secondRaw = source.secondSet || source.second || {};
  const additionalRaw = Array.isArray(source.additionalSets) ? source.additionalSets : [];

  const firstSet = { ...defaultVitalSet(), ...firstRaw };
  const secondSet = { ...defaultVitalSet(), ...secondRaw };
  const additionalSets = additionalRaw.map((set) => {
    const normalizedSet = { ...defaultVitalSet(), ...(set || {}) };

    if (
      normalizedSet.ecgInterpretation &&
      !ECG_WHITELIST.includes(normalizedSet.ecgInterpretation)
    ) {
      normalizedSet.ecgInterpretation = '';
    }

    return normalizedSet;
  });

  if (
    ecgInterpretation &&
    ECG_WHITELIST.includes(ecgInterpretation) &&
    !firstSet.ecgInterpretation
  ) {
    firstSet.ecgInterpretation = ecgInterpretation;
  }

  if (firstSet.ecgInterpretation && !ECG_WHITELIST.includes(firstSet.ecgInterpretation)) {
    firstSet.ecgInterpretation = '';
  }

  if (secondSet.ecgInterpretation && !ECG_WHITELIST.includes(secondSet.ecgInterpretation)) {
    secondSet.ecgInterpretation = '';
  }

  return { firstSet, secondSet, additionalSets };
}

function normalizeGrsAnchors(value) {
  const base = defaultGrsAnchors();
  if (!value || typeof value !== 'object') return base;

  for (const domain of Object.keys(base)) {
    if (!value[domain]) continue;

    for (const score of [1, 3, 5, 7]) {
      if (Array.isArray(value[domain][score])) {
        base[domain][score] = value[domain][score].map((item) => String(item).trim()).filter(Boolean);
      }
    }
  }

  return base;
}

function normalizeCaseProgression(value) {
  if (!value || typeof value !== 'object') {
    return { ...REQUIRED_FIELDS.caseProgression };
  }

  return {
    earlyCourse:
      value.earlyCourse ||
      value.initialCourse ||
      '',
    withProperTreatment:
      value.withProperTreatment ||
      value.treated ||
      value.improves ||
      '',
    withoutProperTreatment:
      value.withoutProperTreatment ||
      value.untreated ||
      value.deteriorates ||
      '',
    withIncorrectTreatment:
      value.withIncorrectTreatment ||
      value.incorrectTreatment ||
      value.worsensWithIncorrectCare ||
      '',
    transportPhase:
      value.transportPhase ||
      value.enRoute ||
      ''
  };
}

function normalizeScenarioData(rawData) {
  const merged = mergeDeepStrict(REQUIRED_FIELDS, rawData || {});

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
  merged.teachersPoints = coerceArray(merged.teachersPoints);

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

  merged.transportPhase.transportConsiderations = coerceArray(merged.transportPhase.transportConsiderations);
  merged.transportPhase.ongoingCare = coerceArray(merged.transportPhase.ongoingCare);
  merged.transportPhase.reassessmentFocus = coerceArray(merged.transportPhase.reassessmentFocus);
  merged.transportPhase.handoffConsiderations = coerceArray(merged.transportPhase.handoffConsiderations);

  merged.clinicalReasoning.ruleInFeatures = coerceArray(merged.clinicalReasoning.ruleInFeatures);
  merged.clinicalReasoning.ruleOutFeatures = coerceArray(merged.clinicalReasoning.ruleOutFeatures);
  merged.clinicalReasoning.redFlags = coerceArray(merged.clinicalReasoning.redFlags);
  merged.clinicalReasoning.treatmentPriorities = coerceArray(merged.clinicalReasoning.treatmentPriorities);

  return merged;
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

function buildComplications(subtype, includeComplications = true, includeBystanders = true) {
  if (!includeComplications) return [];

  const progression = buildCaseProgressionProfile(subtype);

  const baseComplications = [...(COMPLICATION_LIBRARY.moderate || [])];
  const progressionComplications = [...(progression.midComplications || [])];

  const combined = [...baseComplications, ...progressionComplications];

  if (!includeBystanders) {
    return combined.filter(
      (item) => !/bystander|family|witness|collateral/i.test(String(item))
    );
  }

  return combined;
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

function buildMidCallEventProfile(subtype, complexity, environmentProfile, includeBystanders = true) {
  const complexityProfile = buildComplexityProfile(complexity);
  const subtypeEvents = MID_CALL_EVENT_LIBRARY[subtype] || [
    'A meaningful reassessment change occurs during the call.',
    'Collateral information changes how the crew interprets the problem.',
    'Movement or packaging worsens symptoms enough to require adaptation.'
  ];

  const shouldIncludeEvent =
    complexityProfile.midCallEventLikelihood === 'high' ||
    complexityProfile.midCallEventLikelihood === 'medium';

  const sceneInteractionOptions = [];

  if (includeBystanders) {
    sceneInteractionOptions.push(
      'bystander or family input changes the history',
      'public attention or family pressure affects communication'
    );
  }

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
  semesterProfile,
  includeBystanders
}) {
  const progression = buildCaseProgressionProfile(subtypeData.subtype);
  const complexityProfile = buildComplexityProfile(complexity);
  const vitalTrendProfile = buildVitalTrendProfile(subtypeData.subtype, complexity, semesterProfile?.learnerLevel?.match(/\d+/)?.[0] || '3');
  const assessmentCadenceProfile = buildAssessmentCadenceProfile(subtypeData.subtype, complexity);
  const midCallEventProfile = buildMidCallEventProfile(
    subtypeData.subtype,
    complexity,
    environmentProfile,
    includeBystanders
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
      semesterShapingText,
      '',
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

router.post('/', async (req, res) => {
  try {
    const {
      semester = '3',
      callType,
      type,
      environment = 'Urban',
      complexity = 'Moderate',
      learningFocus = 'Balanced',
      includeComplications = true,
      includeBystanders = true,
      includeTeachingCues = true,
      customPrompt = ''
    } = req.body || {};

    const finalCallType = callType || type || 'Medical';

    console.log('REQUEST BODY DEBUG:', req.body);
    console.log('PARSED CONTROL DEBUG:', {
      semester,
      callType,
      type,
      finalCallType,
      environment,
      complexity,
      learningFocus,
      includeComplications,
      includeBystanders,
      includeTeachingCues,
      customPrompt
    });

    const semesterProfile = buildSemesterDifficultyProfile(semester);
    const subtypeData = selectSubtype(finalCallType);
    console.log('SUBTYPE DEBUG:', subtypeData);

    const environmentProfile = buildEnvironmentProfile(environment);
    const complicationData = buildComplications(
      subtypeData.subtype,
      includeComplications,
      includeBystanders
    );
   const medicationPlan = buildMedicationPlan(subtypeData.subtype, semester);
const scenarioCore = buildScenarioCore({
  subtypeData,
  environmentProfile,
  complexity,
  medicationPlan,
  semesterProfile,
  includeBystanders
});

    const instructorProfile = await loadInstructorProfile();
    const fewShots = await loadFewShots();
    const fewShotBlock = buildFewShotBlock(fewShots, finalCallType);
    const directiveAddendum = buildDirectivePromptAddendum({
      callType: finalCallType,
      semester,
      subtype: subtypeData.subtype,
      environment,
      complexity,
      learningFocus
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

${fewShotBlock}

ONTARIO DIRECTIVE ADDENDUM
${Array.isArray(directiveAddendum) ? directiveAddendum.join('\n') : String(directiveAddendum || '')}

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
- midCallEvent
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

Required object structure:
- callInformation must contain:
{
  "type": "",
  "location": "",
  "time": "",
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
  "airway": "",
  "breathing": "",
  "circulation": "",
  "neuro": "",
  "headNeck": "",
  "chest": "",
  "abdomen": "",
  "pelvis": "",
  "extremities": "",
  "skin": "",
  "keyFindings": [],
  "missedIfNotAssessed": [],
  "evolvingFindings": []
}

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
- Some scenarios should contain one or more additionalSets when clinically appropriate.
- Use additionalSets for evolving calls, treatment response, deterioration, movement-related change, longer transport, or meaningful reassessment changes.
- Do not force additionalSets into every case.
- Vitals must trend realistically according to the scenario and the care provided or missed.
- Complex scenarios should usually contain 3 or more total vital sets unless the case truly does not require them.

- midCallEvent must contain:
{
  "timing": "",
  "trigger": "",
  "event": "",
  "newInformation": "",
  "patientChange": "",
  "sceneChange": "",
  "requiredResponse": ""
}

- caseProgression must contain:
{
  "earlyCourse": "",
  "withProperTreatment": "",
  "withoutProperTreatment": "",
  "withIncorrectTreatment": "",
  "transportPhase": ""
}

Case progression rules:
- earlyCourse must describe how the call begins to unfold after arrival and initial assessment.
- withProperTreatment must describe how the patient changes with appropriate care.
- withoutProperTreatment must describe how the patient changes if care is delayed, incomplete, or absent.
- withIncorrectTreatment must describe how the patient changes if clinically important mistakes are made.
- transportPhase must describe what the call looks like during packaging, transport, or ongoing reassessment.
- Case progression must feel dynamic and physiologic, not scripted like a simple OSCE answer key.
- The patient should evolve like a real call.

- transportPhase must contain:
{
  "packaging": "",
  "transportDecision": "",
  "transportConsiderations": [],
  "ongoingCare": [],
  "reassessmentFocus": [],
  "handoffConsiderations": []
}

- clinicalReasoning must contain:
{
  "summary": "",
  "pathophysiology": "",
  "differentialDiagnosis": [
    {
      "condition": "",
      "supportingFeatures": "",
      "rulingOutFeatures": ""
    }
  ],
  "ruleInFeatures": [],
  "ruleOutFeatures": [],
  "redFlags": [],
  "treatmentPriorities": [],
  "conclusion": ""
}

Clinical reasoning rules:
- summary must clearly explain the likely clinical picture.
- pathophysiology must explain what is happening in a practical, learner-friendly way.
- differentialDiagnosis must contain realistic competing diagnoses.
- ruleInFeatures must name the clues that support the leading diagnosis.
- ruleOutFeatures must name the clues that make other diagnoses less likely.
- redFlags must highlight clinically dangerous features or findings that should raise concern.
- treatmentPriorities must connect the reasoning to the most important actions.
- conclusion must clearly state the best working field impression.

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
  9. transport-phase thinking
- Additional assessments and additional vital sets should appear when they improve realism.

GRS rules:
- grsAnchors must contain these EXACT 7 domains:
  - situationalAwareness
  - patientAssessment
  - historyGathering
  - decisionMaking
  - proceduralSkill
  - resourceUtilization
  - communication
- Each of the 7 domains must contain exactly these score keys: "1", "3", "5", "7"
- Each score key must contain an array
- Each score array must contain at least 3 short, scenario-specific behavioural bullet examples
- Score 1 = unsafe, incomplete, harmful, or clearly weak
- Score 3 = developing but inconsistent, delayed, hesitant, or shallow
- Score 5 = competent semester-appropriate performance
- Score 7 = exceptional, anticipatory, organized, calm, and highly effective

ECG rules:
Use only these exact ECG values when appropriate:
${ECG_WHITELIST.map((item) => `- ${item}`).join('\n')}
- Do not add rate, qualifiers, or extra descriptors
- If ECG is relevant, place it in vitalSigns.firstSet.ecgInterpretation
- Update vitalSigns.secondSet.ecgInterpretation only if the rhythm changes
- If additionalSets are used, only include ECG changes when clinically justified
- If the case is isolated trauma, leave ecgInterpretation blank

Scenario parameters:
- Semester: ${semester}
- Call Type: ${finalCallType}
- Environment: ${environment}
- Complexity: ${complexity}
- Learning Focus: ${learningFocus}
- Include complications: ${includeComplications}
- Include bystanders: ${includeBystanders}
- Include teaching cues: ${includeTeachingCues}

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
- protocolNotes must be a practical list, not a paragraph.
- learningObjectives must be populated.
- selfReflectionPrompts must be populated.
- teachersPoints must be populated.
- caseProgression must clearly describe early course, proper treatment, lack of proper treatment, incorrect treatment, and transport phase.
- initialAssessment and secondaryAssessment must not simply duplicate each other.
- If the patient's condition changes, reassessment findings must visibly change.
- additionalSets should be populated whenever treatment, movement, deterioration, or a mid-call event meaningfully changes the call.
- midCallEvent must be meaningfully populated in most Moderate and Complex scenarios.
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

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.35
    });
    const rawOutput = completion.choices[0].message.content;
    const cleaned = sanitizeOutput(rawOutput);

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      const repaired = jsonrepair(cleaned);
      parsed = JSON.parse(repaired);
    }

    const normalized = normalizeScenarioData(parsed);

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
  !normalized.caseProgression?.earlyCourse &&
  !normalized.transportPhase?.transportDecision &&
  !normalized.clinicalReasoning?.summary &&
  !(normalized.expectedTreatment || []).length &&
  !(normalized.learningObjectives || []).length &&
  !(normalized.teachersPoints || []).length;

if (looksEmpty) {
  console.error('Model returned structurally valid but empty scenario JSON:', parsed);
  return res.status(500).json({
    error: 'Scenario generation returned empty content. Prompt schema needs retry.'
  });
}

res.json(normalized);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Scenario generation failed.' });
  }
});

export default router;