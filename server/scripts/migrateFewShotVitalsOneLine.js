import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FILES = [
  path.resolve(__dirname, '../data/few-shot-scenarios.json'),
  path.resolve(__dirname, '../few-shot-scenarios.json')
];

const LEGACY_KEYS = ['hrRhythm', 'hrVolume', 'rrRhythm', 'rrVolume'];

function toNumericToken(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/-?\d+(?:\.\d+)?/);
  return match ? match[0] : null;
}

function systolicFromBp(bp) {
  if (typeof bp === 'number' && Number.isFinite(bp)) return bp;
  if (typeof bp !== 'string') return null;

  const slashMatch = bp.match(/(\d{2,3})\s*\//);
  if (slashMatch) return Number(slashMatch[1]);

  const anyNumber = bp.match(/-?\d+(?:\.\d+)?/);
  return anyNumber ? Number(anyNumber[0]) : null;
}

function hasCommaString(value) {
  return typeof value === 'string' && value.includes(',');
}

function inferHrRhythm(ecgInterpretation) {
  const ecg = String(ecgInterpretation || '').trim();
  if (ecg === 'Atrial Fibrillation') return 'irregular';
  return 'regular';
}

function inferHrVolume(bp) {
  const systolic = systolicFromBp(bp);
  if (systolic !== null && systolic < 100) return 'weak';
  return 'strong';
}

function normalizeHr(set) {
  const raw = set.hr;

  if (typeof raw === 'string' && raw.trim().toUpperCase() === 'N/A') {
    return 'N/A';
  }

  if (hasCommaString(raw)) return raw;

  const rate = toNumericToken(raw) ?? String(raw ?? '').trim();
  if (!rate) return raw;

  return `${rate}, ${inferHrRhythm(set.ecgInterpretation)}, ${inferHrVolume(set.bp)}`;
}

function normalizeRr(set) {
  const raw = set.rr;
  if (hasCommaString(raw)) return raw;

  const text = String(raw ?? '').trim();
  if (!text) return raw;

  if (/(assisted|bvm)/i.test(text)) {
    return `${text}, regular, assisted`;
  }

  const numeric = toNumericToken(raw);
  if (numeric !== null) {
    const rate = Number(numeric);
    const volume = rate >= 30 || rate <= 10 ? 'shallow' : 'full';
    return `${numeric}, regular, ${volume}`;
  }

  return `${text}, regular, full`;
}

function transformSet(set) {
  if (!set || typeof set !== 'object' || Array.isArray(set)) return false;

  const before = JSON.stringify(set);
  set.hr = normalizeHr(set);
  set.rr = normalizeRr(set);
  for (const key of LEGACY_KEYS) delete set[key];

  return JSON.stringify(set) !== before;
}

function transformScenarioArray(data) {
  let changedSets = 0;

  for (const scenario of data) {
    const vs = scenario?.vitalSigns;
    if (!vs || typeof vs !== 'object') continue;

    if (transformSet(vs.firstSet)) changedSets += 1;
    if (transformSet(vs.secondSet)) changedSets += 1;

    if (Array.isArray(vs.additionalSets)) {
      for (const set of vs.additionalSets) {
        if (transformSet(set)) changedSets += 1;
      }
    }
  }

  return changedSets;
}

function countLegacyKeys(data) {
  let total = 0;

  function walk(value) {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      for (const item of value) walk(item);
      return;
    }

    for (const key of LEGACY_KEYS) {
      if (Object.prototype.hasOwnProperty.call(value, key)) total += 1;
    }

    for (const child of Object.values(value)) walk(child);
  }

  walk(data);
  return total;
}

async function processFile(filePath, fallbackText = '') {
  let text = '';
  try {
    text = await fs.readFile(filePath, 'utf8');
  } catch {
    if (!fallbackText) {
      return {
        file: path.relative(path.resolve(__dirname, '..'), filePath),
        exists: false,
        scenarios: 0,
        changedSets: 0,
        legacyKeysRemaining: 0
      };
    }
    text = fallbackText;
  }

  const trimmed = text.trim();
  if (!trimmed) {
    return {
      file: path.relative(path.resolve(__dirname, '..'), filePath),
      exists: true,
      scenarios: 0,
      changedSets: 0,
      legacyKeysRemaining: 0
    };
  }

  const data = JSON.parse(trimmed);
  const changedSets = Array.isArray(data) ? transformScenarioArray(data) : 0;

  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');

  return {
    file: path.relative(path.resolve(__dirname, '..'), filePath),
    exists: true,
    scenarios: Array.isArray(data) ? data.length : 0,
    changedSets,
    legacyKeysRemaining: countLegacyKeys(data)
  };
}

async function main() {
  const primaryPath = FILES[0];
  const secondaryPath = FILES[1];

  const primaryText = await fs.readFile(primaryPath, 'utf8');
  const primary = await processFile(primaryPath);

  let secondary = await processFile(secondaryPath, primaryText);
  if (!secondary.exists) {
    secondary = await processFile(secondaryPath, primaryText);
  }

  const report = {
    status: 'ok',
    format: 'HR: rate, rhythm, volume; RR: rate, rhythm, volume',
    files: [primary, secondary],
    allLegacyKeysRemoved: primary.legacyKeysRemaining + secondary.legacyKeysRemaining === 0
  };

  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ status: 'error', message: error.message }, null, 2));
  process.exit(1);
});
