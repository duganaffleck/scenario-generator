// Pre-fills the Practice ACR with dispatch and admin details from a Scenario Generator scenario, and seals the scenario
// into a hidden field so the review can find it later. Students start the chart where a real crew would: with the call
// assigned and nothing about the patient filled in. Assessment, vitals, treatment and narrative are theirs to chart.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PDFDocument, PDFTextField, PDFDropdown, PDFCheckBox, PDFRadioGroup, PDFName, PDFBool, StandardFonts } from 'pdf-lib';
import { seal } from './scenarioToken.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE = path.join(__dirname, '..', 'assets', 'ACR_practice_v3.pdf');
export const LINK_FIELD = 'Scenario Link';

/**
 * Fill fields by their exact PDF names. Unknown names throw, so schema drift shows up at once instead of as blank boxes.
 * A value a dropdown doesn't offer is skipped (returned in `skipped`) rather than failing the whole download.
 */
async function prefillAcr(templateBytes, values, opts = {}) {
  const pdf = await PDFDocument.load(templateBytes);
  const form = pdf.getForm();
  const unknown = [];
  const skipped = [];
  for (const [name, value] of Object.entries(values)) {
    if (value === undefined || value === null || value === '') continue;
    let field;
    try { field = form.getField(name); } catch (e) { unknown.push(name); continue; }
    keepFontSize(field);
    if (field instanceof PDFTextField) field.setText(String(value));
    else if (field instanceof PDFDropdown) {
      const opt = String(value);
      if (!field.getOptions().includes(opt) && !field.isEditable()) { skipped.push(`${name}=${opt}`); continue; }
      field.select(opt);
    } else if (field instanceof PDFCheckBox) { if (value) field.check(); else field.uncheck(); }
    else if (field instanceof PDFRadioGroup) field.select(String(value));
    else continue;
    if (opts.lock) field.enableReadOnly();
  }
  if (unknown.length) throw new Error(`Unknown ACR field name(s): ${unknown.join(', ')}.`);

  if (opts.scenarioToken) {
    const link = form.createTextField(LINK_FIELD);
    link.setText(opts.scenarioToken);
    link.enableReadOnly();
    link.addToPage(pdf.getPage(0), { x: 0, y: 0, width: 1, height: 1, hidden: true, borderWidth: 0 });
  }

  const helv = await pdf.embedFont(StandardFonts.Helvetica);
  form.updateFieldAppearances(helv);
  // pdf-lib's appearances refer to the font as /Helvetica. Register it in the form's default resources so viewers that
  // rebuild appearances can find it, and ask them to redraw in the form's own style.
  const dr = form.acroForm.dict.lookup(PDFName.of('DR'));
  if (dr) {
    const fonts = dr.lookup(PDFName.of('Font'));
    if (fonts && !fonts.has(PDFName.of('Helvetica'))) fonts.set(PDFName.of('Helvetica'), helv.ref);
  }
  form.acroForm.dict.set(PDFName.of('NeedAppearances'), PDFBool.True);
  const bytes = await pdf.save({ updateFieldAppearances: false });
  return { bytes, skipped };
}

// Keep the form's own font size instead of pdf-lib's auto-fit, so pre-filled text matches what students type.
function keepFontSize(field) {
  if (!(field instanceof PDFTextField || field instanceof PDFDropdown)) return;
  // The template stores DA strings with octal escapes (e.g. \057Helv). Decode them so pdf-lib can read the size.
  const decode = (s) => String(s || '').replace(/\\([0-7]{3})/g, (_, o) => String.fromCharCode(parseInt(o, 8)));
  const da = decode(field.acroField.getDefaultAppearance());
  if (!/Tf/.test(da)) return;
  field.acroField.setDefaultAppearance(da);
  for (const w of field.acroField.getWidgets()) {
    const wda = decode(w.getDefaultAppearance && w.getDefaultAppearance());
    if (/Tf/.test(wda)) w.setDefaultAppearance(wda);
  }
  const m = /([\d.]+)\s+Tf/.exec(da);
  if (m && +m[1] > 0) field.setFontSize(+m[1]);
}

// ------------------------------------------------------------------ generator scenario -> ACR fields
const PICKUP = [[/long[- ]term care|nursing home|\bltc\b/i, 'N'], [/retirement/i, 'U'], [/apartment|condo/i, 'B'],
  [/\b(house|home|residence|townhouse|farmhouse|cottage)\b/i, 'R'], [/\b(street|road|highway|roadside|intersection|parking lot|sidewalk)\b/i, 'S']];

function pad(n) { return String(n).padStart(2, '0'); }
function localDate(tz) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(new Date()).map((x) => [x.type, x.value]));
  return `${p.year}/${p.month}/${p.day}`;
}

function scenarioToAcr(raw, opts = {}) {
  const call = (raw && raw.callInformation) || {};
  const date = opts.date || localDate(opts.timeZone || process.env.ACR_TIMEZONE || 'America/Toronto');
  const callNumber = opts.callNumber || `${date.slice(0, 4)}-${date.slice(5, 7)}${date.slice(8, 10)}-${1000 + Math.floor(Math.random() * 9000)}`;
  const location = String(call.location || '').trim();
  const pickup = (PICKUP.find(([re]) => re.test(location)) || [])[1] || '';
  const t = /^(\d{1,2}):(\d{2})/.exec(String(call.time || '').trim());
  const dpci = /^(?:code|priority|dpci)?\s*([1-4])$/i.exec(String(call.dispatchCode || '').trim());
  return {
    'Service Name': opts.serviceName || process.env.ACR_SERVICE_NAME || 'Lab Practice EMS',
    'Service #': opts.serviceNumber || '100',
    'Call Number': callNumber,
    'Call Date': date,
    'Pick-up Location or Sending Facility': location.slice(0, 80),
    'Pickup Code': pickup,
    'Dispatch #': dpci ? dpci[1] : '',
    'Call Received HH  MM  SS': t && +t[1] < 24 ? `${pad(+t[1])}:${t[2]}:00` : '',
  };
}

// The scenario as the reviewer needs it, trimmed so the sealed token stays small.
async function acrForScenario(raw, normalized, opts = {}) {
  const values = scenarioToAcr(raw, opts);
  const token = seal({ v: 1, issued: new Date().toISOString(), callNumber: values['Call Number'], scenario: normalized });
  const { bytes, skipped } = await prefillAcr(fs.readFileSync(TEMPLATE), values, { lock: true, scenarioToken: token });
  return { bytes, callNumber: values['Call Number'], skipped };
}

export { prefillAcr, scenarioToAcr, acrForScenario, TEMPLATE };
