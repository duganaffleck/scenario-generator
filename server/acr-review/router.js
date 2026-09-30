// ACR Review: teacher-style feedback on practice ACRs, and pre-filled ACRs for generated scenarios.
// Mounted in server/index.js:
//   import acrReviewRouter from './acr-review/router.js';
//   app.use('/api/acr-review', acrReviewRouter);
//
// Routes
//   GET  /config             mode, whether an access code is needed, sample scenarios
//   GET  /scenarios          sample scenarios (older name for the same list)
//   POST /acr-for-scenario   JSON { scenario } from /api/generate-scenario  ->  pre-filled Practice ACR (PDF)
//   POST /                   multipart: acr (PDF), practiceConfirm=yes, [scenarioId], [previousFeedback], [accessCode]
//   POST /triage-report      multipart: acr (PDF), practiceConfirm=yes, audio (a recording) or transcript (typed),
//                            [durationSec], [accessCode]  ->  the report checked against the chart
//
// Nothing is stored. PDFs are read in memory and discarded.

import crypto from 'crypto';
import express from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { extractAcr } from './lib/extractAcr.js';
import { checkPracticeOnly } from './lib/phiGuard.js';
import { runChecker } from './lib/runChecker.js';
import { chartModel } from './lib/chartModel.js';
import { listScenarios, loadScenario, normalizeScenario } from './lib/scenarioAdapter.js';
import { compareToScenario } from './lib/scenarioCompare.js';
import { reviewAcr } from './lib/reviewAcr.js';
import { acrForScenario, LINK_FIELD, templateVersion } from './lib/prefill.js';
import { open } from './lib/scenarioToken.js';

import { documentationRules } from './lib/documentationRules.js';
import { checkTriageReport } from './lib/triageReport.js';
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024, files: 1, fieldSize: 256 * 1024 },
  fileFilter: (req, file, cb) => cb(null, file.mimetype === 'application/pdf' || /\.pdf$/i.test(file.originalname)),
});

// Each AI review costs money. Keep one person (or one script) from running up the bill.
const reviewLimiter = rateLimit({
  windowMs: Number(process.env.ACR_REVIEW_RATE_WINDOW_MS || 10 * 60_000),
  max: Number(process.env.ACR_REVIEW_RATE_MAX || 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'That is a lot of reviews in a short time. Take a few minutes, work on the chart, and try again.' },
});

const mode = () => (process.env.ACR_REVIEW_MODE || 'mock').toLowerCase();
const accessCode = () => String(process.env.ACR_REVIEW_ACCESS_CODE || '').trim();
function accessOk(given) {
  const want = accessCode();
  if (!want) return true;
  const a = crypto.createHash('sha256').update(String(given || '').trim().toLowerCase()).digest();
  const b = crypto.createHash('sha256').update(want.toLowerCase()).digest();
  return crypto.timingSafeEqual(a, b);
}

// Triage report practice: the chart plus a short recording (or typed text). Audio is small: a minute or so.
const reportUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024, files: 2, fieldSize: 64 * 1024 },
  fileFilter: (req, file, cb) => cb(null, file.fieldname === 'acr'
    ? file.mimetype === 'application/pdf' || /\.pdf$/i.test(file.originalname)
    : /^(audio|video)\//.test(file.mimetype) || /\.(webm|m4a|mp4|mp3|wav|ogg|aac)$/i.test(file.originalname)),
});
const reportLimiter = rateLimit({
  windowMs: Number(process.env.ACR_REVIEW_RATE_WINDOW_MS || 10 * 60_000),
  max: Number(process.env.ACR_REPORT_RATE_MAX || 30),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'That is a lot of reports in a short time. Take a few minutes and try again.' },
});

// Speech to text through OpenAI. The audio is sent, turned into text and dropped; nothing is kept here.
async function transcribe(buffer, mimetype) {
  const { default: OpenAI, toFile } = await import('openai');
  const client = new OpenAI();
  const type = mimetype || 'audio/webm';
  const ext = /mp4|m4a|aac/.test(type) ? 'm4a' : /ogg/.test(type) ? 'ogg' : /wav/.test(type) ? 'wav' : /mpeg|mp3/.test(type) ? 'mp3' : 'webm';
  const prompt = 'A paramedic student giving a triage report at hospital. Write numbers as digits: GCS 11, sats 89, BP 102/60, EtCO2 56, glucose 5.9, naloxone 0.4 mg IM.';
  const models = [...new Set([process.env.ACR_TRANSCRIBE_MODEL || 'gpt-4o-mini-transcribe', 'whisper-1'])];
  let lastError = null;
  for (const model of models) {
    try {
      const file = await toFile(buffer, `report.${ext}`, { type });
      const out = await client.audio.transcriptions.create({ file, model, language: 'en', prompt });
      return String((out && out.text) || '').trim();
    } catch (e) {
      lastError = e;
      if (![400, 404].includes(Number(e && e.status))) break; // only a missing or refused model is worth a second try
    }
  }
  throw lastError || new Error('transcription failed');
}

const router = express.Router();

// Which build is running: Render sets RENDER_GIT_COMMIT on every deploy.
const serverCommit = () => String(process.env.RENDER_GIT_COMMIT || '').slice(0, 7) || 'local';

router.get('/config', async (req, res) => {
  res.json({ mode: mode(), accessCodeRequired: !!accessCode(), scenarios: listScenarios(), formVersion: await templateVersion(), serverCommit: serverCommit() });
});

router.get('/scenarios', (req, res) => {
  res.json({ scenarios: listScenarios(), mode: mode() });
});

router.post('/acr-for-scenario', express.json({ limit: '2mb' }), async (req, res) => {
  try {
    const raw = req.body && req.body.scenario;
    if (!raw || typeof raw !== 'object' || !raw.title) return res.status(400).json({ error: 'Send the generated scenario as { scenario }.' });
    const { bytes, callNumber, skipped } = await acrForScenario(raw, normalizeScenario(raw));
    if (skipped.length) console.warn('[acr-review] pre-fill skipped values the form does not offer:', skipped.join(', '));
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `attachment; filename="ACR_${callNumber}.pdf"`);
    res.set('X-ACR-Call-Number', callNumber);
    res.set('X-ACR-Form-Version', await templateVersion());
    res.set('Access-Control-Expose-Headers', 'X-ACR-Call-Number, X-ACR-Form-Version, Content-Disposition');
    res.send(Buffer.from(bytes));
  } catch (e) {
    console.error('[acr-review] pre-fill failed', e);
    res.status(500).json({ error: 'Could not build the ACR for this scenario.' });
  }
});

router.post('/', reviewLimiter, upload.single('acr'), async (req, res) => {
  try {
    if (!accessOk(req.body.accessCode)) return res.status(403).json({ error: 'That class access code isn\'t right. Ask your instructor for it.', accessCodeRequired: true });
    if (req.body.practiceConfirm !== 'yes') {
      return res.status(400).json({ error: 'Confirm that this is a practice chart from a lab scenario before uploading.' });
    }
    if (!req.file) return res.status(400).json({ error: 'Attach your ACR as a PDF.' });
    const { fields } = await extractAcr(req.file.buffer);

    // A pre-filled ACR carries its scenario. Read it, then take the field out so nothing else sees it.
    const link = fields[LINK_FIELD] ? fields[LINK_FIELD].value : '';
    delete fields[LINK_FIELD];
    const sealed = link ? open(link) : null;
    const linkNote = link && !sealed
      ? 'This ACR was made for a scenario, but the link to it couldn\'t be read, so it was reviewed without the scenario.' : '';

    checkPracticeOnly(fields);
    const chart = chartModel(fields);
    const checker = runChecker(fields);
    // Rules the in-form checker can't run (they need the whole chart at once). They join its issues.
    const extra = documentationRules(chart, checker.issues);
    checker.issues.push(...extra);
    checker.issueDetails.push(...extra.map((msg) => ({ msg, fields: [], values: [] })));

    let scenario = sealed ? sealed.scenario : null;
    let scenarioSource = sealed ? 'linked' : 'none';
    if (!scenario && req.body.scenarioId) {
      scenario = loadScenario(req.body.scenarioId);
      if (!scenario) return res.status(400).json({ error: 'That scenario wasn\'t found.' });
      scenarioSource = 'sample';
    }
    const mismatches = compareToScenario(chart, scenario);
    let previousFeedback = null;
    if (req.body.previousFeedback) {
      try { previousFeedback = JSON.parse(req.body.previousFeedback); } catch (e) { previousFeedback = null; }
    }
    const feedback = await reviewAcr({ chart, checker, scenario, mismatches, previousFeedback, fields });
    res.json({
      feedback,
      checker: { issues: checker.issues, questions: checker.questions, intervals: checker.intervals, trend: checker.trend },
      scenario: scenario ? { id: scenario.id || '', title: scenario.title, source: scenarioSource } : null,
      notice: linkNote,
      chart: { callNumber: chart.call.callNumber, chiefComplaint: chart.chiefComplaint },
    });
  } catch (e) {
    if (e.userFacing) return res.status(400).json({ error: e.message });
    console.error('[acr-review]', e);
    res.status(500).json({ error: 'The review failed. ' + (process.env.NODE_ENV === 'production' ? 'Try again in a minute.' : e.message) });
  }
});

router.post('/triage-report', reportLimiter, reportUpload.fields([{ name: 'acr', maxCount: 1 }, { name: 'audio', maxCount: 1 }]), async (req, res) => {
  try {
    if (!accessOk(req.body.accessCode)) return res.status(403).json({ error: 'That class access code isn\'t right. Ask your instructor for it.', accessCodeRequired: true });
    if (req.body.practiceConfirm !== 'yes') return res.status(400).json({ error: 'Confirm that this is a practice chart from a lab scenario first.' });
    const acr = req.files && req.files.acr && req.files.acr[0];
    if (!acr) return res.status(400).json({ error: 'Choose your ACR above first. The report is checked against it.' });
    const audio = req.files && req.files.audio && req.files.audio[0];
    const { fields } = await extractAcr(acr.buffer);
    delete fields[LINK_FIELD];
    checkPracticeOnly(fields);
    const chart = chartModel(fields);

    let transcript = String(req.body.transcript || '').slice(0, 4000);
    let durationSec = null;
    if (audio) {
      if (mode() !== 'openai' || !process.env.OPENAI_API_KEY) {
        return res.status(400).json({ error: 'Recording needs the AI connection, and it\'s switched off on this server. Type your report instead.' });
      }
      try {
        transcript = await transcribe(audio.buffer, audio.mimetype);
      } catch (e) {
        console.error('[acr-review] transcription failed', e && e.message);
        return res.status(503).json({ error: 'Couldn\'t turn the recording into text just now. Try again, or type your report.' });
      }
      const d = Number(req.body.durationSec);
      durationSec = Number.isFinite(d) && d > 0 && d < 600 ? d : null;
    }
    if (!transcript.trim()) return res.status(400).json({ error: audio ? 'The recording came back empty. Check your microphone and try again.' : 'Type your report first.' });
    const result = checkTriageReport(chart, transcript, { durationSec });
    res.json({ transcript, source: audio ? 'audio' : 'typed', ...result });
  } catch (e) {
    if (e.userFacing) return res.status(400).json({ error: e.message });
    console.error('[acr-review] triage report', e);
    res.status(500).json({ error: 'The check failed. ' + (process.env.NODE_ENV === 'production' ? 'Try again in a minute.' : e.message) });
  }
});

export default router;
