import express from 'express';
import OpenAI from 'openai';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { jsonrepair } from 'jsonrepair';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
  "caseProgression", "expectedTreatment", "teachableBlurb", "grsAnchors",
  "vocationalLearningOutcomes", "modifiersUsed", "selfReflectionPrompts"
];

router.post('/', async (req, res) => {
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
3. Be represented in 'teachableBlurb' or GRS anchors.
4. Be unavoidable to solve the case properly.

${selectedModifiers.map(mod => `• ${mod}`).join('\n')}`
      : "- Do not include complications. Keep the scenario straightforward.";

    const bystanderInstruction = includeBystanders
      ? "- Include bystander or family witness input in the case."
      : "- Do not include any bystander or witness elements.";

    const systemPrompt = `
You are a scenario generator AI. Your role is to produce immersive, clinically relevant paramedic scenarios aligned with Ontario’s 2023 BLS PCS and 2025 ALS PCS for PCP/PCP-IV paramedics. These scenarios are for Primary Care Paramedic (PCP) students and must follow a structured educational format.

Return only a fully valid JSON object that includes ALL of the following fields, with detailed and realistic content:

"title", "callInformation", "patientDemographics", "patientPresentation",
"incidentNarrative", "opqrst", "sampleHistory", "medications",
"allergies", "pastMedicalHistory", "physicalExam", "vitalSigns",
"caseProgression", "expectedTreatment", "teachableBlurb", "grsAnchors",
"vocationalLearningOutcomes", "modifiersUsed", "selfReflectionPrompts"

All properties must be double-quoted. No markdown or commentary. The response must be complete and parsable.

- Reference ALS PCS 2025 (PCP/PCP-IV) and BLS PCS 2023 for all care decisions.
- Apply the following BLS PCS directives when relevant:
${blsStandards}

- Apply the following ALS PCS (PCP/IV) directives when relevant:
${alsStandards}

- Base the case complexity and skill depth on the semester: ${semester}
- Adjust scenario based on these parameters:
    - Complexity: ${complexity}
    - Environment: ${environment}
    - Scenario Type: ${type}
    - Learning Focus: ${focus}
${focusInstruction}
${complicationsInstruction}
${bystanderInstruction}
- Format both SAMPLE and OPQRST responses as clearly labeled bullet points
- Include bystander and patient speech, and at least two red herrings
- Expand all sections with realistic detail
- Ensure strong internal consistency between presentation, history, vitals, and treatment
- Include dynamic vitals that reflect improvement or deterioration
- Always include a 'teachableBlurb' summarizing 2–3 key learning points for instructors to emphasize
- Ensure the GRS anchors are always the correct 7 categories with anchors
- Today's date is: ${today}
    `.trim();

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4-1106-preview',
      temperature: 1.0,
      max_tokens: 4096,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: fewShots }
      ]
    });

    let rawResponse = completion.choices[0].message.content || "";

    console.log("=== RAW RESPONSE ===");
    console.log(rawResponse);

    rawResponse = rawResponse.replace(/```(json)?/g, "").trim();

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
