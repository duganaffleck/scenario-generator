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
import { acrForScenario, LINK_FIELD } from './lib/prefill.js';
import { open } from './lib/scenarioToken.js';

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

const router = express.Router();

router.get('/config', (req, res) => {
  res.json({ mode: mode(), accessCodeRequired: !!accessCode(), scenarios: listScenarios() });
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
    res.set('Access-Control-Expose-Headers', 'X-ACR-Call-Number, Content-Disposition');
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

export default router;
