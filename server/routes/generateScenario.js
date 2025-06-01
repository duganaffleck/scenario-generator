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
  "caseProgression", "expectedTreatment", "grsAnchors",
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

    const focusInstruction = focus === "Balanced"
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

    const generationPrompt = `
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
- simulationSetup
- caseProgression (withProperTreatment and withoutProperTreatment)
- expectedTreatment
- teachersPoints (one-paragraph instructor message to student)
- grsAnchors (7 domains: sceneManagement, patientAssessment, historyGathering, decisionMaking, proceduralSkill, resourceUtilization, communication — each domain must have levels 1, 3, 5, and 7, each with 2–3 detailed anchor examples)
- vocationalLearningOutcomes (at least 3)
- selfReflectionPrompts (at least 4)
- modifiersUsed (if complications were added)

Scenario modifiers must be fully integrated and reflected in incidentNarrative, callInformation, caseProgression, and grsAnchors.

Match the following scenario parameters:
- Semester: ${semester}
- Type: ${type}
- Environment: ${environment}
- Complexity: ${complexity}
- Learning Focus: ${focus}

${focusInstruction}
${complicationsInstruction}
${bystanderInstruction}
Today's date is ${today}.
`.trim();

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4-1106-preview',
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
