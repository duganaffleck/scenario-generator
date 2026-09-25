// Runs the exact same checker that lives inside the Practice ACR PDF (vendor/acrChecker.js),
// against fields extracted on the server. One source of truth for the rule-based checks.
// To update: copy the PDF's document script over vendor/acrChecker.js.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SRC = fs.readFileSync(path.join(__dirname, '..', 'vendor', 'acrChecker.js'), 'utf8');

function makeDoc(fields) {
  const names = Object.keys(fields);
  const objs = {};
  for (const n of names) {
    const f = fields[n];
    objs[n] = {
      name: n, type: f.type, readonly: false, display: f.hidden ? 1 : 0, fillColor: ['T'], _v: f.value,
      get value() { return this._v; }, set value(x) { this._v = String(x); },
      get valueAsString() { return String(this._v); }, setFocus() {},
    };
  }
  return { getField: (n) => objs[n] || null, numFields: names.length, getNthFieldName: (i) => names[i] };
}

function runChecker(fields) {
  const app = { alert: () => 4, response: () => null };
  const display = { visible: 0, hidden: 1, noPrint: 2, noView: 3 };
  const color = { transparent: ['T'], white: ['G', 1] };
  const lib = new Function('app', 'display', 'color', SRC +
    '\nreturn { acrCheckIssues, acrPromptsFor, acrCalcIntervals, acrCalcTrend, acrReadBack };')(app, display, color);
  const doc = makeDoc(fields);
  return {
    issues: lib.acrCheckIssues(doc).map((i) => i.msg),
    issueDetails: lib.acrCheckIssues(doc).map((i) => ({ msg: i.msg, fields: i.fields, values: i.fields.map((f) => (fields[f] ? fields[f].value : '')) })),
    questions: lib.acrPromptsFor(doc),
    intervals: lib.acrCalcIntervals(doc),
    trend: lib.acrCalcTrend(doc),
    readBack: lib.acrReadBack(doc),
  };
}

export { runChecker };
