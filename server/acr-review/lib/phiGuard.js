// Practice-only guard. This tool is for lab and simulation charts. It must never receive a real patient's ACR.
// Rules are deliberately blunt: anything that looks like real identifying information stops the upload.

import { userError } from './extractAcr.js';

const ALLOWED_SERVICE = (process.env.ACR_ALLOWED_SERVICES || 'Lab Practice EMS,Practice EMS,Lab,Simulation')
  .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);

function checkPracticeOnly(fields) {
  const v = (n) => (fields[n] ? fields[n].value : '');
  const problems = [];

  const hcn = v('Health Insurance Number').replace(/[\s-]/g, '');
  if (hcn && !/^0+$/.test(hcn) && !/^practice$/i.test(hcn)) {
    problems.push('The Health Insurance Number field has a number in it. Practice charts use 0000-000-000 or leave it blank.');
  }
  const service = v('Service Name').toLowerCase();
  if (service && !ALLOWED_SERVICE.some((s) => service.includes(s))) {
    problems.push(`The Service Name "${v('Service Name')}" isn't a practice service. Use "Lab Practice EMS" for lab charts.`);
  }
  const dob = v('Date of birth');
  const phone = Object.values(fields).some((f) => f.type === 'text' && /\(?\b\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/.test(f.value));
  if (phone) problems.push('Something in the chart looks like a phone number. Remove it; practice charts don\'t need one.');
  const street = v('Street Number') && v('Street Name') && v('City/Town') && v('Postal Code');
  if (street && !/^K0L ?0A0$/i.test(v('Postal Code')) && dob) {
    problems.push('The chart has a full address and date of birth. For practice charts use the scenario\'s made-up address, or leave the address blank.');
  }
  if (problems.length) {
    throw userError('This looks like it might contain real patient information, so it wasn\'t reviewed.\n\n' +
      problems.map((p) => '- ' + p).join('\n') +
      '\n\nOnly upload charts from lab scenarios. Never upload an ACR from a real call or a placement.');
  }
}

export { checkPracticeOnly };
