// End-to-end tests in mock mode. Run: node test/run.js
// Run from the backend folder: node acr-review/test/run.js
// ajv is only needed here. If it isn't installed, the schema check is skipped.
process.env.ACR_REVIEW_MODE = 'mock';
process.env.ACR_REVIEW_RATE_MAX = '1000';
process.env.ACR_SCENARIO_KEY = 'test-key-not-for-production';
delete process.env.ACR_REVIEW_ACCESS_CODE;
import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';
import { PDFDocument } from 'pdf-lib';
import { schema } from '../lib/feedbackSchema.js';
import { postProcess, systemPrompt, buildInput } from '../lib/reviewAcr.js';
import { extractAcr } from '../lib/extractAcr.js';
import { chartModel } from '../lib/chartModel.js';
import { normalizeScenario } from '../lib/scenarioAdapter.js';
import { seal, open } from '../lib/scenarioToken.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { default: app } = await import('../server.js');
let Ajv = null;
try { ({ default: Ajv } = await import('ajv')); } catch (e) { console.log('skip ajv not installed, schema validation skipped'); }

let failed = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) failed++; };
const T = (f) => path.join(__dirname, f);

function postJson(port, pathName, obj) {
  const body = Buffer.from(JSON.stringify(obj));
  return new Promise((resolve, reject) => {
    const req = http.request({ port, method: 'POST', path: pathName, headers: { 'Content-Type': 'application/json', 'Content-Length': body.length } }, (res) => {
      const chunks = []; res.on('data', (c) => chunks.push(c)); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    req.on('error', reject); req.end(body);
  });
}
async function setFields(bytes, changes) {
  const pdf = await PDFDocument.load(bytes);
  const form = pdf.getForm();
  for (const [name, v] of Object.entries(changes)) form.getTextField(name).setText(v);
  return Buffer.from(await pdf.save({ updateFieldAppearances: false }));
}

function post(port, fields, file) {
  const boundary = '----acr' + Date.now();
  const parts = [];
  for (const [k, v] of Object.entries(fields)) parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`));
  if (file) parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="acr"; filename="acr.pdf"\r\nContent-Type: application/pdf\r\n\r\n`), file, Buffer.from('\r\n'));
  parts.push(Buffer.from(`--${boundary}--\r\n`));
  const body = Buffer.concat(parts);
  return new Promise((resolve, reject) => {
    const req = http.request({ port, method: 'POST', path: '/api/acr-review', headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}`, 'Content-Length': body.length } }, (res) => {
      let data = ''; res.on('data', (c) => (data += c)); res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(data) }));
    });
    req.on('error', reject); req.end(body);
  });
}

async function edit(file, changes) {
  const pdf = await PDFDocument.load(fs.readFileSync(T(file)));
  const form = pdf.getForm();
  for (const [name, v] of Object.entries(changes)) {
    const f = form.getField(name);
    if (typeof v === 'boolean') (v ? f.check() : f.uncheck()); else f.setText(v);
  }
  return Buffer.from(await pdf.save({ updateFieldAppearances: false }));
}

(async () => {
  const server = app.listen(0);
  const port = server.address().port;
  const validate = Ajv ? new Ajv({ strict: false }).compile(schema) : () => true;
  const stripMeta = (fb) => { const { meta, ...rest } = fb; return { ...rest, strengths: rest.strengths.map(({ evidence_verified, ...s }) => s), fixes: rest.fixes.map(({ evidence_verified, ...s }) => s) }; };

  const m1 = await post(port, { practiceConfirm: 'yes', scenarioId: 'chest-pain-ischemic-01' }, fs.readFileSync(T('ACR_model_chest_pain.pdf')));
  ok(m1.status === 200 && m1.body.feedback.fixes.length === 0, 'model chest pain: 200, no fixes');
  ok(m1.body.feedback.scenario_questions.length === 0, 'model chest pain: matches its scenario');
  ok(validate(stripMeta(m1.body.feedback)), 'model chest pain feedback matches the schema');

  const m2 = await post(port, { practiceConfirm: 'yes', scenarioId: 'hypoglycemia-refusal-01' }, fs.readFileSync(T('ACR_model_hypoglycemia_refusal.pdf')));
  ok(m2.status === 200 && m2.body.feedback.fixes.length === 0 && m2.body.feedback.scenario_questions.length === 0, 'model hypoglycemia refusal: clean against scenario');
  ok(m2.body.feedback.strengths.some((s) => s.evidence.startsWith('"')), 'model hypoglycemia: strength quotes the patient\'s own words');

  const fl = await post(port, { practiceConfirm: 'yes', scenarioId: 'copd-exacerbation-01' }, fs.readFileSync(T('ACR_find_the_errors.pdf')));
  ok(fl.status === 200 && fl.body.feedback.fixes.length === 3, 'flawed chart: three fixes');
  ok(fl.body.feedback.fixes[0].evidence === 'Penicillin (rash)', 'flawed chart: allergy contradiction is fix 1, quoting the chart');
  ok(fl.body.feedback.scenario_questions.length === 3, 'flawed chart: three scenario questions');
  ok(fl.body.feedback.fixes.every((f) => f.evidence_verified), 'flawed chart: all evidence found on the chart');
  ok(validate(stripMeta(fl.body.feedback)), 'flawed feedback matches the schema');

  const revised = await edit('ACR_find_the_errors.pdf', { 'Allergy - NKA': false, 'Allergy - Other (list below)': true, 'Treatment Row 3 - Dose/Unit': '5 mg' });
  const rv = await post(port, { practiceConfirm: 'yes', scenarioId: 'copd-exacerbation-01', previousFeedback: JSON.stringify(fl.body.feedback) }, revised);
  const imp = rv.body.feedback.improvement_since_last.join(' | ');
  ok(/Fixed: NKA is ticked/.test(imp) && /Fixed: Row 3 \(Salbutamol\): the dose "5" has no unit/.test(imp), 'resubmission: fixed items reported as fixed');
  ok(/Still open: Your Remarks say what you did but not why/.test(imp), 'resubmission: unchanged narrative still reported as open');

  const noConfirm = await post(port, { scenarioId: '' }, fs.readFileSync(T('ACR_find_the_errors.pdf')));
  ok(noConfirm.status === 400 && /practice chart/.test(noConfirm.body.error), 'no practice confirmation: rejected');

  const realHcn = await edit('ACR_find_the_errors.pdf', { 'Health Insurance Number': '4567-123-456' });
  const phi = await post(port, { practiceConfirm: 'yes' }, realHcn);
  ok(phi.status === 400 && /real patient information/.test(phi.body.error), 'real-looking health number: rejected before review');

  const svc = await edit('ACR_find_the_errors.pdf', { 'Service Name': 'Durham Region Paramedic Services' });
  const phi2 = await post(port, { practiceConfirm: 'yes' }, svc);
  ok(phi2.status === 400 && /practice service/.test(phi2.body.error), 'real service name: rejected before review');

  const other = await PDFDocument.create(); other.addPage();
  const notAcr = await post(port, { practiceConfirm: 'yes' }, Buffer.from(await other.save()));
  ok(notAcr.status === 400 && /Practice ACR v3/.test(notAcr.body.error), 'a PDF that is not the practice ACR: rejected');

  const noScenario = await post(port, { practiceConfirm: 'yes' }, fs.readFileSync(T('ACR_find_the_errors.pdf')));
  ok(noScenario.status === 200 && noScenario.body.feedback.scenario_questions.length === 0, 'no scenario chosen: still reviewed, no scenario questions');

  // An AI response that invents a quote must be caught.
  const chart = chartModel((await extractAcr(fs.readFileSync(T('ACR_find_the_errors.pdf')))).fields);
  const fake = JSON.parse(JSON.stringify(fl.body.feedback));
  fake.fixes[1].evidence = 'Salbutamol 5 mg NB given via mask';
  fake.fixes[2].evidence = 'Pt SOB. Neb given. Pt better.';
  const pp = postProcess(fake, chart, 'openai');
  ok(pp.fixes[1].evidence_verified === false && pp.instructor_flags.some((x) => /not found on the chart/.test(x)), 'invented quote from the model: flagged');
  ok(pp.fixes[2].evidence_verified === true, 'real quote from the model: verified');
  const flFields = (await extractAcr(fs.readFileSync(T('ACR_find_the_errors.pdf')))).fields;
  const blankClaims = postProcess({ ...fake, fixes: [{ ...fake.fixes[0], evidence: 'Blank: CTAS Arrive Destination' }, { ...fake.fixes[1], evidence: 'Blank: Allergy Details' }] }, chart, 'openai', flFields);
  ok(blankClaims.fixes[0].evidence_verified === true && blankClaims.fixes[1].evidence_verified === false, '"Blank:" evidence verified only when that field really is blank');

  const input = buildInput({ chart, checker: { issues: [], questions: [], intervals: '', trend: '' }, scenario: null, mismatches: [], previousFeedback: null });
  const size = JSON.stringify(input).length + systemPrompt().length;
  ok(!/\{\{VOICE\}\}/.test(systemPrompt()) && /Em dashes/.test(systemPrompt()), 'system prompt includes the instructor voice');
  ok(size < 40000, `prompt size is reasonable (${size} chars, about ${Math.round(size / 4)} tokens)`);

  // ---------------------------------------------------------------- Scenario Generator integration
  const gen = JSON.parse(fs.readFileSync(T('fixtures/generated-scenario.json'), 'utf8'));
  const ns = normalizeScenario(gen);
  ok(ns.vitalSets.length === 2 && ns.vitalSets[0].hr === '128' && ns.vitalSets[1].label === 'After epinephrine', 'generator scenario: vital sets read from firstSet/secondSet');
  ok(ns.expectedCodes.map((e) => e.label).join(',') === 'Epinephrine,Diphenhydramine,Oxygen', 'generator scenario: treatments mapped to codes; "consider" and "do not" items skipped');
  ok(ns.allergies.length === 1 && ns.medications.length === 2, 'generator scenario: allergies and medications read');

  const tok = seal({ scenario: ns });
  ok(open(tok).scenario.title === 'Fair Day Reaction', 'sealed scenario opens with the right key');
  ok(open(tok.slice(0, -4) + (tok.endsWith('AAAA') ? 'BBBB' : 'AAAA')) === null && open('acr1.garbage') === null, 'edited or damaged token: rejected, not trusted');

  const acrRes = await postJson(port, '/api/acr-review/acr-for-scenario', { scenario: gen });
  ok(acrRes.status === 200 && /application\/pdf/.test(acrRes.headers['content-type']) && /^\d{4}-\d{4}-\d{4}$/.test(acrRes.headers['x-acr-call-number']), 'pre-filled ACR for a generated scenario: PDF with a call number');
  const pre = (await extractAcr(acrRes.body)).fields;
  ok(pre['Service Name'].value === 'Lab Practice EMS' && pre['Pick-up Location or Sending Facility'].value === 'Parking lot beside the fairgrounds'
     && pre['Pickup Code'].value === 'S' && pre['Dispatch #'].value === '4' && pre['Call Received HH  MM  SS'].value === '14:05:00', 'pre-fill: dispatch details mapped from callInformation');
  ok(!pre['Last Name'].value && !pre['Chief Complaint'].value, 'pre-fill: nothing about the patient is filled in');
  ok(pre['Scenario Link'] && pre['Scenario Link'].hidden && /^acr1\./.test(pre['Scenario Link'].value), 'pre-fill: sealed scenario rides in a hidden field');
  const badReq = await postJson(port, '/api/acr-review/acr-for-scenario', { nope: 1 });
  ok(badReq.status === 400, 'pre-fill without a scenario: 400');

  const linked = await post(port, { practiceConfirm: 'yes' }, acrRes.body);
  ok(linked.status === 200 && linked.body.scenario && linked.body.scenario.source === 'linked' && linked.body.scenario.title === 'Fair Day Reaction', 'upload of a pre-filled ACR: scenario found automatically');
  const lq = linked.body.feedback.scenario_questions.map((q) => q.question).join(' | ');
  ok(/Epinephrine/.test(lq) && /allergy/.test(lq), 'linked scenario drives the scenario questions (missing epinephrine, missing allergy)');

  const tampered = await setFields(acrRes.body, { 'Scenario Link': 'acr1.' + 'x'.repeat(40) });
  const tr = await post(port, { practiceConfirm: 'yes' }, tampered);
  ok(tr.status === 200 && tr.body.scenario === null && /couldn't be read/.test(tr.body.notice), 'tampered scenario link: reviewed without the scenario, and says so');

  process.env.ACR_REVIEW_ACCESS_CODE = 'Lab3';
  const cfg = await new Promise((resolve) => http.get({ port, path: '/api/acr-review/config' }, (r) => { let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => resolve(JSON.parse(d))); }));
  const noCode = await post(port, { practiceConfirm: 'yes' }, fs.readFileSync(T('ACR_find_the_errors.pdf')));
  const withCode = await post(port, { practiceConfirm: 'yes', accessCode: ' lab3 ' }, fs.readFileSync(T('ACR_find_the_errors.pdf')));
  ok(cfg.accessCodeRequired === true && noCode.status === 403 && withCode.status === 200, 'class access code: required when set, case-insensitive');
  delete process.env.ACR_REVIEW_ACCESS_CODE;

  process.env.ACR_REVIEW_MODE = 'openai';
  const savedKey = process.env.OPENAI_API_KEY; delete process.env.OPENAI_API_KEY;
  const fb = await post(port, { practiceConfirm: 'yes' }, fs.readFileSync(T('ACR_find_the_errors.pdf')));
  ok(fb.status === 200 && fb.body.feedback.meta.mode === 'fallback' && fb.body.feedback.fixes.length > 0, 'AI reviewer unavailable: student still gets rule-based feedback');
  process.env.ACR_REVIEW_MODE = 'mock'; if (savedKey) process.env.OPENAI_API_KEY = savedKey;

  server.close();
  console.log(failed ? `\n${failed} FAILED` : '\nall passed');
  process.exit(failed ? 1 : 0);
})();
