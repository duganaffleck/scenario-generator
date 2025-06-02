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
  "incidentNarrative", "opqrst", "sampleHistory", "medications",
  "allergies", "pastMedicalHistory", "physicalExam", "vitalSigns",
  "caseProgression", "expectedTreatment", "clinicalReasoning", "grsAnchors",
  "vocationalLearningOutcomes", "modifiersUsed", "selfReflectionPrompts", "teachersPoints"
];

router.post('/', async (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');

  const {
    semester,
    type,
    environment,
    complexity,
    focus,
    includeComplications = true,
    includeBystanders = true,
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
- Do NOT include 12 leads, buy limb lead rhythm interpretation need including.  Blood glucose determinatin is included.
- Tone should be highly instructional and supportive — like a senior paramedic mentoring a beginner.
- Add embedded learning cues in 'patientPresentation', 'caseProgression', and 'expectedTreatment' (e.g., "Notice the flushed face — what might that mean?").
- Keep clinical complexity low: 1–2 main issues maximum. Avoid ethical dilemmas, polypharmacy, or advanced reasoning traps.
- GRS anchors should reflect beginner expectations. A score of 5 = safe and functional, not polished.
- Use direct teaching phrases like "This is where students often hesitate" or "Pause and consider why this matters."
`;
    } else if (semester === "3") {
      semesterInstructions = `
- This scenario is for a **Semester 3** PCP student. Full ALS **medication scope** applies (as per PCP level).
- Pregnancy and delivery calls can now be included.
- Tone should be balanced — professional yet still educational.
- Include a few embedded learning cues, but do not oversimplify or hand-hold.
- Moderate complexity: symptoms can evolve, and delayed treatment should worsen condition.
- Include 1–2 subtle red herrings or decision-making pivots.
- GRS anchors should reflect growing autonomy. A score of 5 = mostly independent and clinically sound.
`;
    } else if (semester === "4") {
      semesterInstructions = `
- This scenario is for a **Semester 4** PCP student. Full ALS scope applies.
- Any call type is appropriate: pediatric, neonate, mental health, etc.
- Tone should be professional and realistic — minimize overt teaching cues unless critical.
- High complexity is expected: layered symptoms, time pressures, possible ethical dilemmas, or competing priorities.
- Expect the student to integrate history, vitals, and presentation without external help.
- GRS anchors should reflect readiness for independent practice. A score of 5 = graduation-level confidence and capability.
`;
    }
let teachingCueInstruction = "";

if (semester === "2") {
  teachingCueInstruction = `- Embed 4–6 short, instructional cues across 'patientPresentation', 'caseProgression', and 'expectedTreatment'. Examples: "Pause and take in the scene," or "This is where students often hesitate."`;
} else if (semester === "3") {
  teachingCueInstruction = `- Include 2–3 short instructional cues across the scenario. These should feel like a mentor's voice guiding reasoning, without over-explaining.`;
} else if (semester === "4") {
  teachingCueInstruction = `- Limit instructional cues to 0–1 across the scenario. Only include them when absolutely critical for understanding.`;
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

    const generationPrompt = `
    
${semesterInstructions}
Generate a detailed paramedic scenario using the following fields. ALL of these fields must be included in the output:

- title
- callInformation
- patientDemographics
- patientPresentation
- incidentNarrative
- opqrst
- sampleHistory
- medications
- allergies
- pastMedicalHistory
- physicalExam
- vitalSigns (firstSet, secondSet)
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


${complicationsInstruction}
${bystanderInstruction}
${teachingCueInstruction}
${typeInstruction}
Today's date is ${today}.
`.trim();

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 1.0,
      max_tokens: 4096,
      messages: [
        { role: 'system', content: profile },
        { role: 'user', content: `${fewShots}\n\n${scenarioDirectives}\n\n${generationPrompt}` }
      ]
    });

    let rawResponse = completion.choices[0].message.content || "";

    console.log("=== RAW RESPONSE ===");
    console.log(rawResponse);

    rawResponse = rawResponse.replace(/\s*```(json)?\s*/g, "").trim();

    try {
      const repaired = jsonrepair(rawResponse);
      const parsed = JSON.parse(repaired);

      for (const field of requiredScenarioFields) {
        if (!(field in parsed)) {
          parsed[field] = "MISSING";
        }
      }

      if (includeComplications) {
        parsed.modifiersUsed = selectedModifiers;
      }

      res.json(parsed);
    } catch (jsonErr) {
      console.error("Failed to repair/parse JSON:", jsonErr);
      res.status(500).send("JSON parsing error. Please retry.");
    }

  } catch (err) {
    console.error("Scenario generation error:", err);
    res.status(500).send("Internal server error.");
  }
});

export default router;
