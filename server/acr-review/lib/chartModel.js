// Turn ~1,300 raw form fields into a compact, readable chart for the reviewer.
// Only filled-in content goes to the model. Empty sections are named as empty, because "blank" is feedback too.

const COLS = ['Dose/Unit', 'Route', 'Pulse', 'Resp', 'BP', 'Temp', 'Reading/Code', 'SpO2', 'EtCO2', 'GCS', 'Pupil R', 'Pupil L', 'Pain'];
const EVENTS = ['Call Received', 'Crew Notified', 'Crew Mobile', 'Arrive Scene', 'Patient Contact', 'Depart Scene', 'Arrive Destination', 'TOC '];

function chartModel(fields) {
  const v = (n) => (fields[n] ? fields[n].value : '');
  const on = (n) => fields[n] && fields[n].value && fields[n].value !== 'Off';
  const ticked = (prefix) => Object.keys(fields).filter((n) => n.startsWith(prefix) && fields[n].type === 'checkbox' && on(n)).map((n) => n.slice(prefix.length));

  const rows = [];
  for (let i = 1; i <= 52; i++) {
    const r = (k) => v(`Treatment Row ${i} - ${k}`);
    const fullLine = on(`Treatment Row ${i} - Full Line`);
    const row = { row: i, time: r('Time'), code: r('Procedure Code'), crew: r('Crew Member Number') };
    // Narrative rows (ACR Manual style): one line across from Dose/Unit to Pain Scale. Otherwise, the columns.
    if (fullLine) row.narrative = r('Line');
    else COLS.forEach((c) => { if (r(c)) row[c] = r(c); });
    if (Object.keys(row).some((k) => !['row'].includes(k) && row[k])) rows.push(row);
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
