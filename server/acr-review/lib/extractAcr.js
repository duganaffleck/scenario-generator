// Read every form field out of an uploaded Practice ACR (v3) by name.
// Returns { fields: { name: { type, value, hidden } }, isPracticeAcr }.

import { PDFDocument, PDFTextField, PDFDropdown, PDFCheckBox, PDFRadioGroup, PDFName, PDFNumber } from 'pdf-lib';

async function extractAcr(pdfBytes) {
  let pdf;
  try {
    pdf = await PDFDocument.load(pdfBytes, { ignoreEncryption: false });
  } catch (e) {
    throw userError('That file could not be opened as a PDF.');
  }
  const form = pdf.getForm();
  const fields = {};
  for (const f of form.getFields()) {
    const name = f.getName();
    let type = 'other', value = '';
    if (f instanceof PDFTextField) { type = 'text'; value = f.getText() || ''; }
    else if (f instanceof PDFDropdown) { type = 'combobox'; value = (f.getSelected() || [])[0] || ''; }
    else if (f instanceof PDFCheckBox) { type = 'checkbox'; value = f.isChecked() ? 'Yes' : 'Off'; }
    else if (f instanceof PDFRadioGroup) { type = 'radiobutton'; value = f.getSelected() || radioFromWidgets(f) || 'Off'; }
    else continue;
    fields[name] = { type, value: String(value).trim(), hidden: isHidden(f) };
  }
  const isPracticeAcr = ['Call Number', 'Treatment Row 1 - Pulse', 'Review - Reflection 1', 'Treatment Row 52 - Time'].every((n) => n in fields);
  if (!isPracticeAcr) {
    throw userError('This doesn\'t look like the Practice ACR v3. Download the current form from your instructor and fill that in.');
  }
  return { fields };
}

// Some PDF tools store a radio choice only on the selected button (/AS), not on the group (/V). Read either.
function radioFromWidgets(field) {
  for (const w of field.acroField.getWidgets()) {
    const as = w.dict.get(PDFName.of('AS'));
    if (as instanceof PDFName && as.decodeText() !== 'Off') return as.decodeText();
  }
  return '';
}

function isHidden(field) {
  const w = field.acroField.getWidgets()[0];
  if (!w) return false;
  const F = w.dict.get(PDFName.of('F'));
  return F instanceof PDFNumber ? (F.asNumber() & 2) === 2 : false;
}

function userError(msg) {
  const e = new Error(msg);
  e.userFacing = true;
  return e;
}

export { extractAcr, userError };
