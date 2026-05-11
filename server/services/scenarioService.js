// scenarioService.js
// Service for scenario generation logic
// This is a placeholder. Move core logic from generateScenario.js here in the next step.

// Import necessary modules and constants from generateScenario.js
import fs from 'fs/promises';
import path from 'path';
import OpenAI from 'openai';

const INSTRUCTOR_PROFILE_PATH = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  '../data/scenario-instructor-profile.txt'
);
const FEW_SHOTS_PATH = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  '../data/few-shot-scenarios.json'
);
const SCENARIO_MODIFIERS_PATH = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  '../data/scenario-modifiers.json'
);
const ALS_STANDARDS_PATH = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  '../data/als-standards.txt'
);
const BLS_STANDARDS_PATH = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
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

// Main scenario generation logic
export async function generateScenario(requestBody) {
  // Example: validate input, load data, and return a mock scenario
  // In production, this would call OpenAI or other logic as needed
  const instructorProfile = await loadInstructorProfile();
  const fewShots = await loadFewShots();
  const scenarioModifiers = await loadScenarioModifiers();
  const alsStandards = await loadAlsStandards();
  const blsStandards = await loadBlsStandards();

  // Parse the customPrompt for scenario type, environment, and key features
  let { callType, environment, subtype } = requestBody;
  const customPrompt = (requestBody.customPrompt || '').toLowerCase();
  // Simple keyword-based extraction (expand as needed)
  if (customPrompt) {
    if (/obstetric|birth|shoulder dystocia|neonate|pregnan/.test(customPrompt)) {
      callType = 'Medical';
      subtype = 'obstetrical_emergency';
    }
    if (/home|residence|apartment|bedroom|bathroom/.test(customPrompt)) {
      environment = 'Home';
    }
    // Add more rules as needed for other types/environments
  }

  // Build the scenario generation system prompt, amplifying the Instructor Prompt if present
  let systemPrompt = '';
  if (requestBody.customPrompt && requestBody.customPrompt.trim().length > 0) {
    systemPrompt += `INSTRUCTOR GUIDANCE (MANDATORY): You must incorporate the following instructor prompt as a primary scenario constraint. Do not ignore, minimize, or substitute it.\n"${requestBody.customPrompt.trim()}"\n`;
  }
  systemPrompt += '\nAlways use supportive, non-judgmental, and psychologically safe language in all scenario teaching points, cues, and reflective questions. Avoid any language that could be perceived as punitive, shaming, or as a personal flaw. Frame all challenges as learning opportunities and encourage open communication and self-reflection.';

  // Return a mock response showing the effect of the override and prompt
  return {
    instructorProfile,
    fewShotsCount: fewShots.length,
    scenarioModifiersKeys: Object.keys(scenarioModifiers),
    alsStandardsLength: alsStandards.length,
    blsStandardsLength: blsStandardsCache?.length || blsStandards.length,
    request: {
      ...requestBody,
      callType,
      environment,
      subtype,
    },
    systemPrompt,
    message: 'Scenario generated successfully (mock, instructor prompt amplified, type/environment/subtype override applied)'
  };
}
