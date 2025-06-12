// File: server/routes/generateScenario.js

import express from 'express';
import OpenAI from 'openai';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { jsonrepair } from 'jsonrepair';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Handle CORS preflight
router.options('/', (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.sendStatus(204);
});

function getSelectedModifiers(modifiersObj, selectedCategories, countPerCategory = 1) {
  return Object.entries(modifiersObj)
    .filter(([category]) => selectedCategories[category])
    .flatMap(([category, list]) => {
      const shuffled = list.sort(() => 0.5 - Math.random());
      return shuffled.slice(0, countPerCategory).map(mod => `- (${category}) ${mod}`);
    });
}

const requiredScenarioFields = [
  "title", "callInformation", "patientDemographics", "patientPresentation",
  "incidentNarrative", "opqrst", "sample", "medications",
  "allergies", "pastMedicalHistory", "physicalExam", "vitalSigns",
  "caseProgression", "expectedTreatment", "clinicalReasoning", "grsAnchors",
  "vocationalLearningOutcomes", "modifiersUsed", "selfReflectionPrompts", "teachersPoints"
];
const ecgInterpretationWhitelist = [
  "Normal Sinus Rhythm",
  "Sinus Bradycardia",
  "Sinus Tachycardia",
  "Atrial Fibrillation",
  "Atrial Flutter",
  "SVT",
  "Ventricular Tachycardia",
  "Ventricular Fibrillation",
  "Asystole",
  "Pulseless Electrical Activity",
  "First Degree AV Block",
  "Second Degree AV Block Type I",
  "Second Degree AV Block Type II",
  "Third Degree AV Block"
];

router.post('/', async (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');

const {
  semester,
  type,
  environment,
  complexity,
  focus,
  uniqueness = "Common",
  includeComplications = true,
  includeBystanders = true,
  includeTeachingCues = true,
  modifierCategories = {}
} = req.body;


  try {
    const profilePath = path.join(__dirname, '../data/scenario-instructor-profile.txt');
    const shotsPath = path.join(__dirname, '../data/few-shot-scenarios.json');
    const modifiersPath = path.join(__dirname, '../data/scenario-modifiers.json');
    const blsStandardsPath = path.join(__dirname, '../data/bls-standards.txt');
    const alsStandardsPath = path.join(__dirname, '../data/als-standards.txt');

    const profile = await fs.readFile(profilePath, 'utf-8');
    const fewShots = await fs.readFile(shotsPath, 'utf-8');
    const modifiers = JSON.parse(await fs.readFile(modifiersPath, 'utf-8'));
    const blsStandards = await fs.readFile(blsStandardsPath, 'utf-8');
    const alsStandards = await fs.readFile(alsStandardsPath, 'utf-8');

    const today = new Date().toLocaleDateString('en-CA');

    let focusInstruction = focus === "Balanced"
      ? "- Ensure a well-rounded scenario touching on assessment, reasoning, communication, and procedural elements evenly."
      : `- Emphasize the learning focus area: ${focus}`;

    const selectedModifiers = includeComplications
      ? getSelectedModifiers(modifiers, modifierCategories)
      : [];

    const complicationsInstruction = includeComplications
      ? `- Integrate the following scenario modifiers across the scenario. They must:
1. Appear explicitly in 'incidentNarrative' or 'callInformation'.
2. Influence 'caseProgression', scene dynamics, or treatment.
3. Be represented in 'teachersPoints' or GRS anchors.
4. Be unavoidable to solve the case properly.

${selectedModifiers.map(mod => `• ${mod}`).join('\n')}`
      : "- Do not include complications. Keep the scenario straightforward.";

    const bystanderInstruction = includeBystanders
      ? "- Include bystander or family witness input in the case."
      : "- Do not include any bystander or witness elements.";

    const scenarioDirectives = `
- Reference ALS PCS 2025 (PCP/PCP-IV) and BLS PCS 2023 for all care decisions.
- Apply the following BLS PCS directives when relevant:
${blsStandards}

- Apply the following ALS PCS (PCP/IV) directives when relevant:
${alsStandards}
- When describing interventions or decision-making, explicitly name relevant PCS directives (e.g., "per BLS PCS oxygen administration standard", "ALS PCS symptom relief directive", etc.).
- If oxygen is not applied, justify it using BLS PCS (e.g., "SpO₂ > 94% and no signs of hypoxia").
- If a medication is given, include its exact indication from ALS PCS and state "as per ALS PCS".

- Format both SAMPLE and OPQRST responses as clearly labeled bullet points
- Include bystander and patient speech, and at least two red herrings
- Expand all sections with realistic detail
- Ensure strong internal consistency between presentation, history, vitals, and treatment
- Include dynamic vitals that reflect improvement or deterioration
- Write a short introductory hook (1–2 sentences) before the scenario begins. This should hint at atmosphere or urgency without giving away diagnosis. Store this as 'scenarioIntro'.
- All narrative sections (scenarioIntro, patientPresentation, callInformation, caseProgression) should reflect the tone of instructor Dugan:
  - Playful but deliberate
  - Heavy with purpose
  - Smart, direct, and educational
  - Include teaching-style phrases that feel like a senior paramedic guiding a student
- This should sound like a senior paramedic teaching a junior. Tone: direct, insightful, occasionally witty.
- This section should be instructional — not motivational fluff.
- Ensure the GRS anchors are always the correct 7 categories with anchors
Include a "teachersPoints" field: a one-paragraph tip, warning, or lesson from the instructor to the student. This should be voiced like a senior paramedic speaking to a junior. Keep it educational, witty, or stern — never vague.
`.trim();

let semesterInstructions = "";

if (semester === "2") {
  semesterInstructions = `
- This scenario is for a **Semester 2** PCP student. Do NOT include any ALS **medications**. Other ALS directives (e.g., oxygen, SMR) may apply if appropriate.
- Do NOT include pregnancy, neonate, or pediatric calls.
- Do NOT include 12-leads, but limb lead rhythm interpretation is included. Blood glucose determination is included.
- Tone should be highly instructional and supportive — like a senior paramedic mentoring a beginner.
- Add embedded learning cues in 'patientPresentation', 'caseProgression', and 'expectedTreatment' (e.g., "Notice the flushed face — what might that mean?").
- Keep clinical complexity low: 1–2 main issues maximum. Avoid ethical dilemmas, polypharmacy, or advanced reasoning traps.
- GRS anchors should reflect beginner expectations. A score of 5 = safe and functional, not polished.
- Use direct teaching phrases like "This is where students often hesitate" or "Pause and consider why this matters."
  `.trim();
} else if (semester === "3") {
  semesterInstructions = `
- This scenario is for a **Semester 3** PCP student. Full ALS **medication scope** applies (as per PCP level).
- Pregnancy and delivery calls can now be included.
- Tone should be balanced — professional yet still educational.
- Include a few embedded learning cues, but do not oversimplify or hand-hold.
- Moderate complexity: symptoms can evolve, and delayed treatment should worsen condition.
- Include 1–2 subtle red herrings or decision-making pivots.
- GRS anchors should reflect growing autonomy. A score of 5 = mostly independent and clinically sound.
  `.trim();
} else if (semester === "4") {
  semesterInstructions = `
- This scenario is for a **Semester 4** PCP student. Full ALS scope applies.
- Any call type is appropriate: pediatric, neonate, mental health, etc.
- Tone should be professional and realistic — minimize overt teaching cues unless critical.
- High complexity is expected: layered symptoms, time pressures, possible ethical dilemmas, or competing priorities.
- Expect the student to integrate history, vitals, and presentation without external help.
- GRS anchors should reflect readiness for independent practice. A score of 5 = graduation-level confidence and capability.
  `.trim();
}

const cueFormatReminder = `
- All teaching cues must:
  - Begin with a 💡 emoji
  - Be wrapped in brackets
  - Be italicized using asterisks (*like this*)
  - Appear as short reflections from a senior paramedic
  - Example format: *(💡 This is where students often hesitate.)*
  `.trim();

let teachingCueInstruction = "";

if (includeTeachingCues) {
  if (semester === "2") {
    teachingCueInstruction = `
- Embed 💡 teaching cues anywhere in the scenario where they provide instructional value.
- For Semester 2, focus cues on:
  • Basic scene management
  • Foundational assessment
  • SAMPLE/OPQRST gathering
  • Common errors (e.g., missed vitals, forgetting positioning)
- Do not include ALS interventions or drug-specific cues.
- Examples: *(💡 This is a great time to ask about onset.)*, *(💡 Students often forget to reassess airway here.)*

${cueFormatReminder}
    `.trim();
  } else if (semester === "3") {
    teachingCueInstruction = `
- Embed 💡 teaching cues anywhere in the scenario where they provide genuine instructional value.
- For Semester 3, guide students toward:
  • Solidifying assessment-to-decision pathways
  • Using basic ALS directives (ASA, Nitro, Glucagon, etc.)
  • Noticing early red flags and forming differentials
  • Understanding when BLS actions matter most
- Teaching cues can appear in: vital signs, ECGs, progression, SAMPLE, reasoning, or treatment plans.
- Examples: *(💡 Would Nitro be appropriate yet — or do we need more info?)*, *(💡 This SpO₂ is borderline — what’s your next step?)*
- If the case involves chest pain, syncope, shortness of breath, or another cardiac indicator, consider including a 12-lead ECG interpretation.
- Do **not** include full 12-lead output — instead, summarize findings (e.g., "12-lead shows ST elevation in V2-V4").
- Make sure any 12-lead detail reflects a real clinical picture.
- If no cardiac cause is suspected, you may skip the 12-lead entirely.
${cueFormatReminder}
    `.trim();
  } else if (semester === "4") {
    teachingCueInstruction = `
- Embed 💡 teaching cues anywhere in the scenario where they provide high-level learning opportunities.
- For Semester 4, challenge students with:
  • Advanced reasoning and second-order thinking
  • Managing uncertainty and incomplete data
  • Justifying treatment plans or refusals
  • Recognizing subtle physical or ECG cues
- Encourage instructor-style thought prompts:
  *(💡 Look again — is there anything about the rhythm that feels off?)*
  *(💡 This progression isn't linear — what changed the trajectory?)*
- If the case involves chest pain, syncope, shortness of breath, or another cardiac indicator, consider including a 12-lead ECG interpretation.
- Do **not** include full 12-lead output — instead, summarize findings (e.g., "12-lead shows ST elevation in V2-V4").
- Make sure any 12-lead detail reflects a real clinical picture.
- If no cardiac cause is suspected, you may skip the 12-lead entirely.
${cueFormatReminder}
    `.trim();
  }
} else {
  teachingCueInstruction = `
- Do not include any instructional cues or 💡 teaching prompts in the scenario.
  `.trim();
}


let physicalAndVitalCueInstruction = "";

if (includeTeachingCues) {
  if (semester === "2") {
    physicalAndVitalCueInstruction = `- In addition to cues in patientPresentation and caseProgression, embed 1–2 short 💡 cues in 'physicalExam' and 'vitalSigns'. Focus on helping students recognize subtle clues (e.g., skin signs, chest rise, abnormal vitals) and encouraging re-checks or reassessment.`;
  } else if (semester === "3") {
    physicalAndVitalCueInstruction = `- Include up to 1 subtle 💡 cue in either 'physicalExam' or 'vitalSigns' to reinforce student interpretation and second-order thinking (e.g., "(💡 Pulse pressure matters — look closer)").`;
  } else if (semester === "4") {
    physicalAndVitalCueInstruction = `- Only include a teaching cue in 'physicalExam' or 'vitalSigns' if it prevents a common misstep. It must feel like a senior clinician whispering insight — not an instructor pausing class.`;
  }
} else {
  physicalAndVitalCueInstruction = `- Do not embed any 💡 teaching cues in the 'physicalExam' or 'vitalSigns' sections. Keep them purely clinical.`;
}

let typeInstruction = "";

switch (type) {
  case "Medical":
    typeInstruction = `- This is a **Medical** scenario. Emphasize history, evolving symptoms, and non-traumatic presentations. Include internal causes (e.g., GI, endocrine, sepsis) and detail their progression.
- Avoid trauma-like injuries, obvious external bleeding, or environmental triggers unless clearly secondary.`;
    break;
  case "Trauma":
    typeInstruction = `- This is a **Trauma** scenario. Emphasize mechanism of injury, bleeding control, SMR, and rapid assessment. Include obvious or occult injuries with realistic trauma patterns.
- Do not include medical causes (e.g., stroke, diabetic emergencies) as primary complaints.`;
    break;
  case "Cardiac":
    typeInstruction = `- This is a **Cardiac** case. Focus on chest pain, cardiovascular signs, and protocol-driven treatments like ASA and Nitro (depending on semester). Consider 12-lead findings if applicable.
- Avoid respiratory origin (e.g., asthma, pneumonia) unless clearly secondary to cardiac dysfunction.`;
    break;
  case "Respiratory":
    typeInstruction = `- This is a **Respiratory** case. Focus on dyspnea, oxygen decisions, adventitious breath sounds, and titrated oxygen. Reflect BLS PCS O₂ guidance explicitly.
- Do not let cardiac causes dominate unless they clearly result in respiratory compromise.`;
    break;
  case "Environmental":
    typeInstruction = `- This is an **Environmental** emergency. Base the call around external causes (e.g., cold, heat, toxin, altitude). Symptoms should reflect the environmental stress.
- Avoid primary medical illness without environmental context or causation.`;
    break;
  case "Other":
    typeInstruction = `- This is a case of **Other/Complex** nature. Consider mental health, overdose, or unique presentations that don’t neatly fit other types. Maintain internal consistency.
- Avoid simple trauma or typical medical complaints. This case should feel atypical and instructive.`;
    break;
}

let environmentInstruction = "";

switch (environment) {
  case "Urban":
    environmentInstruction = `- This is an **Urban** setting. Emphasize crowd density, tight access points, traffic delays, and bystander interaction. Think elevators, stairwells, apartment lobbies, and impatient onlookers. Embed Layer 1 cues about staying focused in noisy, chaotic environments.`;
    break;
  case "Rural":
    environmentInstruction = `- This is a **Rural** setting. Highlight long transport times, sparse backup, variable cell coverage, and improvised solutions. Mention terrain, long laneways, or farm structures. Layer 1 teaching should nod to autonomy and decision-making under isolation.`;
    break;
  case "Wilderness":
    environmentInstruction = `- This is a **Wilderness** scenario. Focus on remoteness, scene access difficulty (e.g., trails, campsites), and the need for improvised stabilization. Include environmental threats (heat, cold, animals) and patient extrication. Teach resilience and outdoor-specific hazards.`;
    break;
  case "Industrial":
    environmentInstruction = `- This is an **Industrial** environment. Address hazards like machinery, confined spaces, chemical exposure, and high noise. Consider patient PPE, EMS access issues, and potential delays for decontamination or scene control. Add Layer 1 insights on risk balancing and assertive communication.`;
    break;
  case "Home":
    environmentInstruction = `- This is a **Home** environment. Bring in cramped spaces, emotional family members, or pet interference. Focus on subtle scene clues, domestic hazards, and privacy concerns. Embed Layer 1 cues about empathic rapport and navigating family dynamics.`;
    break;
  case "Public Space":
    environmentInstruction = `- This is a **Public Space** scenario. Think food courts, parks, gyms, or busy streets. Crowd control, noise, limited privacy, and rapid escalation are common. Use Layer 1 remarks on crowd diffusion, quick assessment, and protecting patient dignity in public.`;
    break;
  default:
    environmentInstruction = "";
}

let complexityInstruction = "";

switch (complexity) {
  case "Simple":
    complexityInstruction = `- This is a **Simple** scenario. Keep the clinical picture focused and the cues clear. One primary problem, minimal distraction. Use this to reinforce fundamentals: assessment, communication, and one clean decision. Layer 1 should highlight staying sharp even when things *look* easy.`;
    break;
  case "Moderate":
    complexityInstruction = `- This is a **Moderate** case. Introduce some ambiguity or competing priorities. Maybe the history is partial, or symptoms evolve mid-call. There should be enough to challenge clinical reasoning without overwhelming. Use Layer 1 to encourage pattern recognition and structured re-evaluation.`;
    break;
  case "Complex":
    complexityInstruction = `- This is a **Complex** scenario. Include multiple problems (e.g., polypharmacy, co-morbidities, scene dynamics) or confounding elements (e.g., misleading history, emotional bystanders, limited access). Build in at least two clinical decision points and require deeper synthesis. Layer 1 cues should emphasize keeping composure, avoiding tunnel vision, and managing chaos.`;
    break;
  default:
    complexityInstruction = "";
}
let focusPriorityDomain = "";

switch (focus) {
  case "Assessment":
    focusInstruction = `- This scenario prioritizes **Assessment**. Emphasize initial impressions, primary and secondary surveys, and appropriate vital sign interpretation. Include subtle physical findings that reward careful observation. Layer 1 teaching cues should reinforce using all senses, working methodically, and forming early working impressions based on cues, not assumptions.`;
    break;
  case "Decision Making":
    focusInstruction = `- This scenario focuses on **Decision Making**. The case should present branching paths, unclear priorities, or dynamic progression that forces clinical judgment. Include teachable moments where premature decisions or inaction could lead to worsening outcomes. Layer 1 cues should nudge re-evaluation, structured logic, and synthesis of incomplete data.`;
    break;
  case "Pathophysiology":
    focusInstruction = `- This case targets **Pathophysiology**. Build a medically rich scenario that challenges students to connect signs and symptoms with underlying biological processes. Present evolving vitals or systemic signs that require deeper reasoning. Layer 1 moments should highlight connecting textbook knowledge to lived clinical presentation.`;
    break;
  case "Communication":
    focusInstruction = `- This case emphasizes **Communication**. Include emotionally charged or socially nuanced moments — distressed patients, family members, or bystanders. Highlight rapport-building, clear verbalization, and de-escalation. Layer 1 cues should emphasize calm, empathetic tone, and structured information gathering even under pressure.`;
    break;
  case "Procedures":
    focusInstruction = `- This scenario focuses on **Procedures**. Incorporate a case that requires PCP-level interventions (e.g., oxygen, glucose, SMR, positioning, assisted meds). Make the skill performance integral to patient improvement or deterioration. Layer 1 teaching should reinforce performing with confidence, checking drugs and gear, and understanding indications/contraindications.`;
    break;
  case "Balanced":
    focusInstruction = `- This is a **Balanced** case. All domains — assessment, decision-making, pathophysiology, communication, and procedures — should be reasonably represented. The scenario should reflect a holistic field call, with embedded teachable moments across the full patient care spectrum. Layer 1 cues should be interspersed and reflective of an overall strong call.`;
    break;
  default:
    focusInstruction = "";
}

let include12LeadInstruction = `
If the scenario is cardiac-related and clinically relevant, include an "ecgInterpretation" field.
Use only one of the following exact values:

- "Normal Sinus Rhythm"
- "Sinus Bradycardia"
- "Sinus Tachycardia"
- "Atrial Fibrillation"
- "Atrial Flutter"
- "SVT"
- "Ventricular Tachycardia"
- "Ventricular Fibrillation"
- "Asystole"
- "Pulseless Electrical Activity"
- "First Degree AV Block"
- "Second Degree AV Block Type I"
- "Second Degree AV Block Type II"
- "Third Degree AV Block"

Do not add descriptive modifiers like "with PVCs" or "at 90 bpm".
These values are used to pull matching ECG images on the frontend.
`;


let uniquenessInstruction = "";

switch (uniqueness) {
  case "Varied":
    uniquenessInstruction = `
- Include moderately unique or underrepresented calls (e.g., CO exposure, lithium toxicity, ovarian torsion, adrenal crisis, serotonin syndrome).
- These cases should still be realistic, solvable with PCP-level thinking, and teachable.
- Emphasize clinical curiosity and differential diagnosis.
`.trim();
    break;
  case "Rare/Obscure":
    uniquenessInstruction = `
- Prioritize rare, bizarre, or complex cases that test second-order thinking.
- Examples: pheochromocytoma, heat stroke in cosplay armor, pesticide poisoning, water intoxication, pacemaker malfunction, rabies exposure.
- These must still remain *teachable* and rooted in real paramedic decision-making — not pure medical trivia.
- Challenge assumptions and emphasize synthesis over pattern matching.
`.trim();
    break;
  case "Common":
  default:
    uniquenessInstruction = `
- Stick to common paramedic calls (e.g., chest pain, asthma, overdose, trauma).
- Avoid exotic diagnoses unless explicitly required by complexity or modifiers.
`.trim();
}

const sampleInstruction = `
- SAMPLE should be its own top-level field called "sample", not nested inside any other field.
- Format it as six labeled bullet points: 
  - Signs & Symptoms
  - Allergies
  - Medications
  - Past Medical History
  - Last Oral Intake
  - Events Leading Up
`.trim();

    const generationPrompt = `
    
${semesterInstructions}
Generate a detailed paramedic scenario using the following fields. ALL of these fields must be included in the output:

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
- vitalSigns (firstSet, secondSet)
  - Both sets must include:
    - hr, rr, bp, spo2, etco2, temp, gcs, bgl
   
Only include a field named "ecgInterpretation" **if clinically relevant**, and only if the rhythm is found in the list below. 

VERY IMPORTANT:
- The value must be **exactly one** of the strings below. Do **not** add extra details like “at 90 bpm”, “with PVCs”, etc.
- The value must be **identical** to one of these — no changes, expansions, or descriptions.

Valid values:
- "Normal Sinus Rhythm"
- "Sinus Bradycardia"
- "Sinus Tachycardia"
- "Atrial Fibrillation"
- "Atrial Flutter"
- "SVT"
- "Ventricular Tachycardia"
- "Ventricular Fibrillation"
- "Asystole"
- "Pulseless Electrical Activity"
- "First Degree AV Block"
- "Second Degree AV Block Type I"
- "Second Degree AV Block Type II"
- "Third Degree AV Block"

Examples of INVALID values:
- "Normal sinus rhythm at 90 bpm" ← WRONG
- "Sinus tachycardia with occasional PVCs" ← WRONG

CORRECT:
- "Sinus Tachycardia"
- "Atrial Fibrillation"

When including an ecgInterpretation, do a final check: the value must match one of the exact 15 approved rhythm strings. If not, omit the field entirely

If no ECG rhythm is clinically relevant, omit the "ecgInterpretation" field entirely. Do not fabricate rhythms not listed above.

"Only use exact ECG rhythm names from this list for the 'ecgInterpretation' field, with no additional description: " +
Object.keys(ecgImageMap).join(", ") + ". " +
"Do not add qualifiers like 'with PVCs' or 'with ST elevation'. Just provide the base rhythm name exactly as listed."

- Include a field called "clinicalReasoning" with three parts:
  - "summary": A concise summary of the underlying pathophysiology.
  - "differentialDiagnosis": A list of 2–4 objects, each with:
    - "condition": The name of the condition.
    - "supportingFeatures": Why this condition might be present.
    - "rulingOutFeatures": Why this condition may be less likely.
  - "conclusion": A short paragraph explaining why the working diagnosis is the most likely based on findings.

- Tone: instructive, medically accurate, and friendly—as if guiding a senior paramedic student toward better pattern recognition.
- Do not repeat information verbatim from other sections; instead, **connect the dots**.
- IMPORTANT: Ensure the final JSON includes *all* of the following top-level fields: 
  title, callInformation, patientDemographics, patientPresentation, opqrst, sample, physicalExam, vitalSigns, caseProgression, expectedTreatment, protocolNotes, learningObjectives, vocationalLearningOutcomes, selfReflectiveQuestions, grsAnchors, teachersPoints, scenarioRationale, clinicalReasoning.

- caseProgression (withProperTreatment and withoutProperTreatment)
- expectedTreatment
- teachersPoints (one-paragraph instructor message to student)
  - A concise pathophysiology summary explaining the patient's likely condition
  - A differential diagnosis list with 2–3 options, each with reasoning that supports or rules them out based on scenario data
- grsAnchors (7 domains: situationalAwareness, patientAssessment, historyGathering, decisionMaking, proceduralSkill, resourceUtilization, communication — each domain must have levels 1, 3, 5, and 7, each with 3 detailed anchor examples)
  - Each score must include three detailed, scenario-specific examples of student behavior.
  - Use a warm, wise, and mentor-like tone to guide performance.
  - Anchor content must reflect the specific scenario’s challenges (e.g., environment, complexity, case progression).
  - DO NOT skip levels or use vague placeholders like "not competent" or "very good". Be specific, educational, and clear.
- Prioritize the domain that aligns with the selected focus. When writing grsAnchors, that domain should have the richest and most detailed anchor examples. Aim for:
  - More vivid or nuanced student behaviors
  - Slightly longer anchor lists (4+ examples instead of 3, if token space allows)
  - Embedded Layer 1 cues where appropriate

Use this guide to determine the focus domain:
  - "Assessment" → emphasize **Assessment & Vitals**
  - "Decision Making" → emphasize **Clinical Decision-Making**
  - "Pathophysiology" → emphasize **Clinical Decision-Making and Assessment & Vitals**
  - "Communication" → emphasize **Communication & Rapport**
  - "Procedures" → emphasize **Procedures & Skills**
  - "Balanced" → no prioritization; all domains equally weighted

- The highest-priority GRS domain for this case is: **${focusPriorityDomain}**. Expand its anchors with additional depth and specificity.

- vocationalLearningOutcomes (at least 3)
- selfReflectionPrompts (at least 4)
- modifiersUsed (if complications were added)

Scenario modifiers must be fully integrated and reflected in incidentNarrative, callInformation, caseProgression, and grsAnchors.

Match the following scenario parameters:
- The scenario TYPE must be obvious and cleanly match the category selected. Do NOT blur boundaries. Example: Asthma = Respiratory. Sepsis = Medical. Chest pain = Cardiac. Trauma = External Injury.
- Semester: ${semester}
- Type: ${type}
- Environment: ${environmentInstruction}
- Complexity: ${complexityInstruction}
- Learning Focus: ${focusInstruction}
- Uniqueness: ${uniqueness}



${complicationsInstruction}
${sampleInstruction}
${bystanderInstruction}
${teachingCueInstruction}
${typeInstruction}
${uniquenessInstruction}
${include12LeadInstruction}
Today's date is ${today}.
`.trim();

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Utility to sanitize output before JSON parsing
function sanitizeOutput(raw) {
  return raw
    .replace(/\s*```(json)?\s*/g, '')        // Remove Markdown code fences
    .replace(/[\u2018\u2019]/g, "'")        // Curly single quotes
    .replace(/[\u201C\u201D]/g, '"')        // Curly double quotes
    .replace(/[\u{1F600}-\u{1F6FF}]/gu, '') // Emojis
    .trim();
}

let completion;
try {
  completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    temperature: 1.0,
    max_tokens: 4096,
    messages: [
      { role: 'system', content: profile },
      { role: 'user', content: `${fewShots}\n\n${scenarioDirectives}\n\n${generationPrompt}` }
    ]
  });
} catch (error) {
  console.error("❌ OpenAI API error:", error);
  return res.status(500).json({ error: "Scenario generation failed" });
}

if (
  !completion ||
  !completion.choices ||
  !completion.choices[0] ||
  !completion.choices[0].message?.content
) {
  console.error("❌ Invalid OpenAI response structure:", completion);
  return res.status(500).json({ error: "OpenAI returned malformed data" });
}

let scenarioContent = completion.choices[0].message.content;
console.log("=== RAW RESPONSE ===\n", scenarioContent);
scenarioContent = sanitizeOutput(scenarioContent);

let parsed;
try {
  const repaired = jsonrepair(scenarioContent);
  parsed = JSON.parse(repaired);



  // Fill in any missing required fields
  for (const field of requiredScenarioFields) {
    if (!(field in parsed)) parsed[field] = "MISSING";
  }

  if (includeComplications) {
    parsed.modifiersUsed = selectedModifiers;
  }

// Assign ECG rhythm
let ecgToAssign = "Normal Sinus Rhythm";
const age = parsed?.patientDemographics?.age || 0;
const title = parsed?.title?.toLowerCase() || "";
const presentation = parsed?.patientPresentation?.toLowerCase() || "";
const keywords = `${title} ${presentation}`;

if (keywords.includes("chest pain") || keywords.includes("cardiac")) {
  ecgToAssign = "Atrial Fibrillation";
} else if (keywords.includes("palpitations")) {
  ecgToAssign = "SVT";
} else if (keywords.includes("dizzy") || keywords.includes("syncope")) {
  ecgToAssign = age > 60 ? "Second Degree AV Block Type I" : "Sinus Bradycardia";
} else if (keywords.includes("shortness of breath") || keywords.includes("dyspnea")) {
  ecgToAssign = "Sinus Tachycardia";
} else if (keywords.includes("seizure") || keywords.includes("post-ictal")) {
  ecgToAssign = "Sinus Tachycardia";
} else if (keywords.includes("asystole") || keywords.includes("no pulse")) {
  ecgToAssign = "Asystole";
} else if (keywords.includes("collapse") && age > 65) {
  ecgToAssign = "Third Degree AV Block";
} else if (keywords.includes("trauma")) {
  ecgToAssign = "Sinus Tachycardia";
} else if (keywords.includes("altered") || keywords.includes("unresponsive")) {
  ecgToAssign = "Pulseless Electrical Activity";
}

// Final check and assignment
if (ecgInterpretationWhitelist.includes(ecgToAssign)) {
  parsed.ecgInterpretation = ecgToAssign;
}

// Final response
res.json(parsed);


} catch (jsonErr) {
  console.error("Failed to repair/parse JSON:", jsonErr);
  return res.status(500).send("JSON parsing error. Please retry.");
}
  } catch (err) {
    console.error("Scenario generation error:", err);
    res.status(500).send("Internal server error.");
  }
});

export default router;
