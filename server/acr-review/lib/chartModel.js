// Turn ~1,300 raw form fields into a compact, readable chart for the reviewer.
// Only filled-in content goes to the model. Empty sections are named as empty, because "blank" is feedback too.

const COLS = ['Dose/Unit', 'Route', 'Pulse', 'Resp', 'BP', 'Temp', 'Reading/Code', 'SpO2', 'EtCO2', 'GCS', 'Pupil R', 'Pupil L', 'Pain'];
const P_COLS = ['Dose/Unit', 'Route', 'Pulse', 'Resp', 'BP', 'Temp'];
const EVENTS = ['Call Received', 'Crew Notified', 'Crew Mobile', 'Arrive Scene', 'Patient Contact', 'Depart Scene', 'Arrive Destination', 'TOC '];

// When a write-across line is full, the form carries the words on to the row below (v3.6). Same measure as the form:
// Helvetica at 8 pt, in a line 191.6 pt wide (procedure side) or 159.8 pt (Results side), less 5 pt of padding.
const HELV = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556,
  278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667,
  944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500,
  278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584];
const LINE_ROOM = { procedure_line: 186.6, result_line: 154.8 };
const textWidth = (s) => [...String(s)].reduce((w, ch) => { const c = ch.charCodeAt(0); return w + (c >= 32 && c <= 126 ? HELV[c - 32] : 600); }, 0) * 8 / 1000;
// The line above was full: its text plus the next row's first word (or three wide letters) wouldn't fit.
function lineFull(prev, next, key) {
  if (!prev) return false;
  const first = String(next || '').split(/\s+/)[0] || '';
  return textWidth(`${prev} mmm`) > LINE_ROOM[key] || textWidth(`${prev} ${first}`) > LINE_ROOM[key];
}

function chartModel(fields) {
  const v = (n) => (fields[n] ? fields[n].value : '');
  const on = (n) => fields[n] && fields[n].value && fields[n].value !== 'Off';
  const ticked = (prefix) => Object.keys(fields).filter((n) => n.startsWith(prefix) && fields[n].type === 'checkbox' && on(n)).map((n) => n.slice(prefix.length));

  const rows = [];
  let above = null; // the row directly above, as written
  for (let i = 1; i <= 52; i++) {
    const r = (k) => v(`Treatment Row ${i} - ${k}`);
    // v3.4: P writes across the procedure side (Dose/Unit to Temp), R across the Results side (Reading/Code to Pain).
    // v3.3 charts had one line across the whole row ("Full Line" / "Line"); that counts as both sides.
    const legacy = on(`Treatment Row ${i} - Full Line`);
    const pAcross = legacy || on(`Treatment Row ${i} - Procedure Across`);
    const rAcross = legacy || on(`Treatment Row ${i} - Result Across`);
    const row = { row: i, time: r('Time'), code: r('Procedure Code'), crew: r('Crew Member Number') };
    const procedure = r('Procedure Line') || (legacy ? r('Line') : '');
    const result = r('Result Line');
    if (procedure) row.procedure_line = procedure;
    if (result) row.result_line = result;
    COLS.forEach((c) => {
      const hidden = P_COLS.includes(c) ? pAcross : rAcross;
      if (!hidden && r(c)) row[c] = r(c);
    });
    const prevRaw = above;
    above = row;
    if (!Object.keys(row).some((k) => !['row'].includes(k) && row[k])) continue;
    // A row the words carried on to from the row above joins that row: written across, nothing else on it, and the
    // same side of the row above full. A new entry missing its time and code, under a short line, stays a row.
    const last = rows[rows.length - 1];
    const carry = (pAcross || rAcross) && !row.time && !row.code && !row.crew && prevRaw
      && Object.keys(row).every((k) => ['row', 'time', 'code', 'crew', 'procedure_line', 'result_line'].includes(k))
      && (!row.procedure_line || lineFull(prevRaw.procedure_line, row.procedure_line, 'procedure_line'))
      && (!row.result_line || lineFull(prevRaw.result_line, row.result_line, 'result_line'));
    if (carry && last && last.row + (last.carried || 0) === i - 1) {
      if (row.procedure_line) last.procedure_line = last.procedure_line ? `${last.procedure_line} ${row.procedure_line}` : row.procedure_line;
      if (row.result_line) last.result_line = last.result_line ? `${last.result_line} ${row.result_line}` : row.result_line;
      last.carried = (last.carried || 0) + 1;
      continue;
    }
    rows.push(row);
  }
  const events = {};
  for (const e of EVENTS) {
    const key = Object.keys(fields).find((n) => n.startsWith(e) && /HH/.test(n));
    if (key) events[e.trim()] = v(key);
  }
  const capacity = {};
  ['Understands clinical situation', 'Appreciates applicable risks', 'Can make an alternative care plan', 'Responsible adult on scene']
    .forEach((q) => { capacity[q] = v('Capacity - ' + q) || 'unanswered'; });
  const refusalSigned = !!(v('Signature of Patient or SDM  Signature du patient ou du MS') || v('Patient or SDM Name and Address'));

  return {
    call: { callNumber: v('Call Number'), callDate: v('Call Date'), pickupCode: v('Pickup Code'), occurrence: `${v('Date of Occurrence')} ${v('Time of Occurrence')}`.trim() },
    patient: { age: v('Age'), sex: v('Sex'), weightKg: v('Weight kg'), dob: v('Date of birth') },
    chiefComplaint: v('Chief Complaint'),
    incidentHistory: v('Incident Hx'),
    pastHistory: { ticked: ticked('Past History - '), cno: on('Relevant Past History - CNO'), providedBy: ticked('Past History Source - '), details: v('Relevant Past History Details') },
    medications: { ticked: ticked('Medication - '), details: v('Medication Details') },
    allergies: { ticked: ticked('Allergy - ').concat(ticked('Allergies - ')), details: v('Allergy Details') },
    treatmentPriorToArrival: { ticked: ticked('Treatment Prior to Arrival - '), details: v('Treatment Prior to Arrival Details') },
    cardiacArrest: { witnessedBy: ticked('Cardiac Arrest - Witnessed By - '), cprBy: ticked('Cardiac Arrest - CPR Started By - '), firstShockBy: ticked('Cardiac Arrest - First Shock By - ') },
    physicalExam: {
      skinColour: v('Skin Colour'), skinCondition: v('Skin Condition'), generalAppearance: v('General Appearance Details'),
      headNeck: { ticked: ticked('Physical Exam - Head/Neck - '), details: v('Head/Neck') },
      chest: { ticked: ticked('Physical Exam - Chest - '), details: v('Chest Exam Details') },
      abdomen: { ticked: ticked('Physical Exam - Abdomen - '), details: v('Abdomen') },
      backPelvis: { ticked: ticked('Physical Exam - Back/Pelvis - '), details: v('Back/Pelvis Details') },
      extremities: { ticked: ticked('Physical Exam - Extremities - '), details: v('Extremities Details') },
      traumaCodes: [1, 2, 3].map((k) => [v(`Location ${k}`), v(`Type ${k}`), v(`Mechanism ${k}`)].filter(Boolean).join('/')).filter(Boolean),
    },
    treatmentGrid: rows,
    remarks: [v('Remarks'), v('Remarks 2'), v('Remarks 3')].filter(Boolean).join('\n'),
    disposition: {
      primaryProblem: v('Primary Problem'), problemCode: v('Problem Code'), specialTransportCode: v('Sp Trans Code'),
      ctas: { arrivePatient: v('CTAS Arrive Patient'), departScene: v('CTAS Depart Scene'), arriveDestination: v('CTAS Arrive Destination') },
      receivingFacility: v('Receiving Facility/Destination'), dispatchPriority: v('Dispatch #'), returnPriority: v('Return #'),
      warningSystems: ticked('Warning Systems - '), deceased: ticked('Deceased - '), effects: ticked('Disposition of Effects - '),
    },
    callEvents: events,
    crew: [1, 2, 3, 4].map((k) => ({ number: v(k === 1 ? 'Crew 1 Number (Attending)' : `Crew ${k} Number`), name: v(`Crew ${k} Name`), designation: v(`Crew ${k} Designation`) })).filter((c) => c.name || c.number),
    refusal: refusalSigned ? {
      capacity, subject: v('Capacity Assessment Subject'), signedAt: `${v('Patient or SDM Signature Date')} ${v('Patient or SDM Signature Time')}`.trim(),
      witness: v('Non-paramedic Witness Name') || (v('Witness or Paramedic 2 Signature') ? 'paramedic 2 signed' : ''), sdmRelationship: v('SDM Relationship to Patient'),
    } : null,
    studentReflection: { decisionTheChartMustExplain: v('Review - Reflection 1'), wouldChartDifferently: v('Review - Reflection 2') },
  };
}

export { chartModel };
