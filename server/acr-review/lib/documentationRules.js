// Server-side documentation rules that go past what the in-form checker can see: vitals that got worse with nothing
// charted after them, a late or missing glucose on an altered patient, ventilation with no rate or effect, a CTAS that
// doesn't fit the care given, no hospital notification for a high-acuity patient, and a handover with no name.
// They run on the extracted chart and are added to the checker's issues, so the rule-based review and the AI review
// both see them. Each message names the row or field it is about, which is what the review uses as evidence.

const MED_CODES = new Set(['498', '504', '528', '529', '530', '533', '534', '540', '541', '560', '561', '610', '615', '650', '700', '704', '706', '728']);
const VENT_CODES = new Set(['141', '144']);
const RESUS_CODES = new Set(['141', '144', '318', '380', '298', '305', '306', '307', '308']);

const norm = (code) => String(code || '').replace(/\s/g, '').replace(/^0+(?=\d)/, '');
const num = (x) => { const m = String(x || '').match(/-?\d+(\.\d+)?/); return m ? Number(m[0]) : null; };
const sbp = (bp) => num(String(bp || '').split('/')[0]);
const mins = (t) => { const m = String(t || '').match(/^(\d{1,2}):?(\d{2})/); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
const isVitals = (r) => !!(r.Pulse || r.Resp || r.BP || r.SpO2 || r.GCS || r.EtCO2);

// What got worse between two vitals rows, in plain words. Empty if nothing meaningful did.
function worsening(prev, cur) {
  const out = [];
  const rr = num(cur.Resp), prr = num(prev.Resp);
  if (rr != null && rr < 10 && (prr == null || prr >= 10)) out.push(`RR fell to ${rr}`);
  const sp = num(cur.SpO2), psp = num(prev.SpO2);
  if (sp != null && psp != null && sp < 94 && psp - sp >= 2) out.push(`SpO2 fell from ${psp} to ${sp}`);
  const g = num(cur.GCS), pg = num(prev.GCS);
  if (g != null && pg != null && pg - g >= 2) out.push(`GCS fell from ${pg} to ${g}`);
  const s = sbp(cur.BP), ps = sbp(prev.BP);
  if (s != null && s < 90 && (ps == null || ps >= 90)) out.push(`systolic BP fell to ${s}`);
  const e = num(cur.EtCO2), pe = num(prev.EtCO2);
  if (e != null && pe != null && e > 45 && e - pe >= 6) out.push(`EtCO2 rose from ${pe} to ${e}`);
  return out;
}

function documentationRules(chart, existingIssues = []) {
  const issues = [];
  const rows = chart.treatmentGrid || [];
  const remarks = String(chart.remarks || '');
  const vit = rows.filter(isVitals);

  // 1. Deterioration with nothing charted after it.
  for (let k = 1; k < vit.length; k++) {
    const what = worsening(vit[k - 1], vit[k]);
    if (!what.length) continue;
    const t = mins(vit[k].time);
    const after = rows.filter((r) => r.row > vit[k].row && (t == null || mins(r.time) == null || mins(r.time) - t <= 15) && (r.code && norm(r.code) !== '10' || r.procedure_line));
    if (!after.length) {
      issues.push(`Row ${vit[k].row} (${vit[k].time || 'no time'}): ${what.join(', ')}. Nothing charted after it shows what you did about it, or that you reassessed.`);
    }
  }

  // 2. Altered patient: a glucose, and early.
  const first = vit[0];
  const firstGcs = first ? num(first.GCS) : null;
  if (firstGcs != null && firstGcs < 15) {
    const bgl = rows.find((r) => norm(r.code) === '25');
    if (!bgl) issues.push(`Row ${first.row}: GCS ${firstGcs}, but no blood glucose is charted. Altered level of consciousness needs a glucose (code 25).`);
    else {
      const gap = mins(bgl.time) != null && mins(first.time) != null ? mins(bgl.time) - mins(first.time) : null;
      if (gap != null && gap > 10) issues.push(`Row ${bgl.row}: the glucose was checked ${gap} minutes after the first vitals, on a patient with GCS ${firstGcs}. On an altered patient it belongs in the first few minutes.`);
    }
  }

  // 3. Ventilation with no rate, oxygen or effect.
  for (const r of rows.filter((x) => VENT_CODES.has(norm(x.code)))) {
    const said = `${r.procedure_line || ''} ${r.result_line || ''} ${remarks}`;
    if (!/\b\d{1,2}\s*(\/\s*min|per min|breaths|bpm)|every \d+ ?(s|sec|seconds)|rate/i.test(said)) {
      issues.push(`Row ${r.row} (BVM): no ventilation rate, and nothing about chest rise or effect. Chart how you ventilated and what it did.`);
    }
  }

  // 4. CTAS that doesn't fit resuscitation-level care.
  const ctas = num(chart.disposition && chart.disposition.ctas && chart.disposition.ctas.arrivePatient);
  const resus = rows.find((r) => RESUS_CODES.has(norm(r.code)));
  if (resus && ctas != null && ctas > 1) {
    issues.push(`CTAS Arrive Patient is ${ctas}, but row ${resus.row} shows assisted ventilation or resuscitation. A patient who needs that is CTAS 1.`);
  }

  // 5. No notification for a high-acuity transport.
  const dest = chart.disposition && chart.disposition.ctas ? num(chart.disposition.ctas.departScene || chart.disposition.ctas.arrivePatient) : null;
  const transported = !!(chart.callEvents && (chart.callEvents['Depart Scene'] || chart.callEvents['Arrive Destination']));
  const notified = rows.some((r) => /^401(\.\d)?$/.test(norm(r.code))) || /\b(notif|pre-?alert|patch(ed)?|radioed|called ahead)/i.test(remarks);
  if (transported && dest != null && dest <= 2 && !notified) {
    issues.push(`Nothing shows the receiving hospital was notified. For a CTAS ${dest} patient, chart the notification as a procedure (code 401) with a time and what you reported.`);
  }

  // 6. Handover to a role with no name.
  const alreadyFlagged = existingIssues.some((m) => /who took over care/i.test(m));
  const toc = chart.callEvents && chart.callEvents.TOC;
  const handover = (remarks.match(/[^.]*\b(transferred|report (was )?(given )?to|handed over|care to|TOC)\b[^.]*\.?/i) || [])[0];
  const named = /\b[A-Z]\.\s?[A-Z][a-z]+|\b(RN|Dr\.?|nurse|charge|triage|physician)\s+\(?[A-Z]/.test(remarks);
  if (toc && handover && !alreadyFlagged && !named) {
    issues.push(`Care is transferred to "${handover.trim().replace(/^.*?\b(to)\b\s*/i, '').replace(/\.$/, '') || 'staff'}" with no name. Name the person who took report (for example "triage RN K. Singh"). (ODS 4.0)`);
  }

  // 7. Belongings that matter clinically, with nowhere they went.
  const story = `${chart.incidentHistory || ''} ${remarks} ${chart.medications ? chart.medications.details : ''}`;
  const effects = chart.disposition && chart.disposition.effects ? chart.disposition.effects : [];
  if (/\b(pill bottle|bottle of pills|medication bottle|pills? (found|in)|blister pack)\b/i.test(story) && !effects.length && !/\bbottle\b[^.]*\b(brought|with (the )?pt|with patient|given to|handed)/i.test(remarks)) {
    issues.push('A pill bottle is part of the story, but nothing says where it went. It should travel with the patient, and Disposition of Effects should say who has it.');
  }

  return issues;
}

export { documentationRules };
