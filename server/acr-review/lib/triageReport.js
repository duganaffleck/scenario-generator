// Triage report practice: the student says (or types) the report they'd give the triage nurse, and it's checked
// against their own chart. Rule-based on purpose: every item points at a row or box on the chart, so the student
// can see why. Nothing is stored.

// ---- spoken numbers to digits ---------------------------------------------------------------------------------
const UNITS = { zero: 0, oh: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19 };
const TENS = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const DECADES = { twenties: 20, thirties: 30, forties: 40, fifties: 50, sixties: 60, seventies: 70, eighties: 80, nineties: 90 };
const isNumWord = (w) => w in UNITS || w in TENS || w === 'hundred';

function groupValue(words) {
  // "one oh two" -> 102: spoken digit by digit
  if (words.includes('oh') && words.length >= 3) return Number(words.map((w) => (w in UNITS ? UNITS[w] : TENS[w] || 0)).join(''));
  // "one twenty two" -> 122: a leading 1 or 2 before a tens word is the hundreds, as in blood pressures
  if (words.length >= 2 && (words[0] === 'one' || words[0] === 'two') && words[1] in TENS) {
    return UNITS[words[0]] * 100 + groupValue(words.slice(1));
  }
  // "eighteen thirty" -> 1830: a time
  if (words.length >= 2 && UNITS[words[0]] >= 10 && words[1] in TENS) return Number(`${UNITS[words[0]]}${groupValue(words.slice(1))}`);
  let total = 0;
  let cur = 0;
  for (const w of words) {
    if (w === 'hundred') cur = (cur || 1) * 100;
    else if (w in TENS) cur += TENS[w];
    else if (w in UNITS) cur += UNITS[w];
  }
  total += cur;
  return total;
}

export function normalizeSpoken(text) {
  const tokens = String(text || '')
    .toLowerCase()
    .replace(/[“”"’]/g, "'")
    .replace(/(\d),(\d{3})/g, '$1$2')
    .replace(/([a-z])-([a-z])/g, '$1 $2')
    .replace(/([a-z0-9])[.,;:!?](?=\s|$)/g, '$1')
    .replace(/[^a-z0-9./%' ]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  const out = [];
  for (let i = 0; i < tokens.length; i += 1) {
    const t = tokens[i];
    if (t in DECADES) { out.push(`${DECADES[t]}s`); continue; }
    // "point four" with nothing before it: 0.4
    if (t === 'point' && i + 1 < tokens.length && tokens[i + 1] in UNITS && !/^\d/.test(out[out.length - 1] || '')) {
      out.push(`0.${UNITS[tokens[i + 1]]}`);
      i += 1;
      continue;
    }
    if (!isNumWord(t) || (t === 'oh' && !(i + 1 < tokens.length && isNumWord(tokens[i + 1])))) { out.push(t); continue; }
    const group = [];
    while (i < tokens.length && (isNumWord(tokens[i]) || (tokens[i] === 'and' && tokens[i - 1] === 'hundred'))) {
      if (tokens[i] !== 'and') group.push(tokens[i]);
      i += 1;
    }
    let value = String(groupValue(group));
    // "five point nine" -> 5.9
    if (tokens[i] === 'point' && i + 1 < tokens.length && tokens[i + 1] in UNITS) {
      i += 1;
      const decimals = [];
      while (i < tokens.length && tokens[i] in UNITS && UNITS[tokens[i]] < 10) { decimals.push(UNITS[tokens[i]]); i += 1; }
      value += `.${decimals.join('')}`;
    }
    i -= 1;
    out.push(value);
  }
  return out.join(' ').replace(/(\d)\s+over\s+(\d)/g, '$1/$2').replace(/(\d) point (\d)/g, '$1.$2');
}

// ---- what was said ---------------------------------------------------------------------------------------------
const VITALS = [
  { key: 'Pulse', name: 'heart rate', words: /\b(heart rate|hr|pulse|heart)\b/, tol: 5, core: true, range: [20, 250] },
  { key: 'Resp', name: 'respiratory rate', words: /\b(resps?|respirations?|resp rate|respiratory rate|rr|breathing|breaths)\b/, tol: 2, core: true, range: [0, 60] },
  { key: 'BP', name: 'blood pressure', words: /\b(bp|pressure|blood pressure)\b/, tol: 4, core: true, bp: true },
  { key: 'SpO2', name: 'SpO2', words: /\b(sats?|spo2|sat|saturations?|saturating|o2 sats?|oxygen saturation|pulse ox)\b/, tol: 1, core: true, range: [50, 100] },
  { key: 'GCS', name: 'GCS', words: /\b(gcs|glasgow)\b/, tol: 0, range: [3, 15] },
  { key: 'EtCO2', name: 'EtCO2', words: /\b(etco2|end tidal|end tidal co2|capnography|co2)\b/, tol: 3, range: [5, 120] },
  { key: 'Temp', name: 'temperature', words: /\b(temp|temperature)\b/, tol: 0.3, range: [25, 45] },
];

// Another vital's name ends the search window, so "pressure 102/60, sats 95" doesn't give the pressure 95.
const ANY_VITAL = /^(sats?|spo2|saturations?|gcs|glasgow|bp|pressure|pulse|heart|hr|resps?|respirations?|rr|etco2|co2|tidal|temp|temperature|glucose|sugar|bgl|cbg)$/;

const TREND_LINK = new Set(['on', 'arrival', 'now', 'then', 'to', 'and', 'up', 'down', 'from', 'improved', 'improving', 'came', 'went',
  'dropped', 'rose', 'after', 'initially', 'first', 'later', 'currently', 'is', 'was', "it's", 'it', 'are', 'were', 'at', 'of', 'back']);

// Numbers said within a few words after a vital's name: "sats 89", "pressure 102/60", "heart rate's in the 50s".
function saidValues(norm, vital) {
  const tokens = norm.split(' ');
  const found = [];
  for (let i = 0; i < tokens.length; i += 1) {
    // The vital's name has to start here, not somewhere later in the window
    const phrase = tokens.slice(i, i + 3).join(' ').replace(/'s\b/g, '');
    const m = phrase.match(vital.words);
    if (!m || m.index !== 0) continue;
    if (tokens[i] === 'pulse' && tokens[i + 1] === 'ox' && !vital.words.test('pulse ox')) continue;
    const start = i + m[0].split(' ').length;
    // "GCS 11 on arrival, now 13" gives both numbers: the trend counts.
    let got = 0;
    for (let j = start; j <= start + (got ? 9 : 5) && j < tokens.length && got < 3; j += 1) {
      const t = tokens[j].replace(/'s$/, '');
      // After the first number, only linking words ("on arrival, now 13") may sit between it and the next.
      if (got && !/^\d/.test(t) && !TREND_LINK.has(t)) break;
      if (j > start && ANY_VITAL.test(t) && !vital.words.test(`${tokens[j - 1]} ${t}`)) break;
      if (vital.bp) {
        const b = t.match(/^(\d{2,3})\/(\d{2,3})$/);
        if (b) { found.push({ sys: Number(b[1]), dia: Number(b[2]), text: t }); got += 1; }
        continue;
      }
      const decade = t.match(/^(\d0)s$/);
      if (decade) { found.push({ low: Number(decade[1]), high: Number(decade[1]) + 9, text: `${decade[1]}s` }); got += 1; continue; }
      const n = t.match(/^(\d{1,3}(?:\.\d)?)%?$/);
      if (n && (!vital.range || (Number(n[1]) >= vital.range[0] && Number(n[1]) <= vital.range[1]))) {
        found.push({ value: Number(n[1]), text: n[1] });
        got += 1;
      }
    }
  }
  return found;
}

// ---- what the chart says ---------------------------------------------------------------------------------------
const num = (v) => {
  const m = String(v || '').match(/\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
};
function chartedSeries(chart, key) {
  return (chart.treatmentGrid || [])
    .filter((r) => r[key])
    .map((r) => {
      if (key === 'BP') {
        const m = String(r.BP).match(/(\d{2,3})\s*\/\s*(\d{2,3})/);
        return m ? { sys: Number(m[1]), dia: Number(m[2]), text: `${m[1]}/${m[2]}`, row: r.row, time: r.time } : null;
      }
      const v = num(r[key]);
      return v === null ? null : { value: v, text: String(v), row: r.row, time: r.time };
    })
    .filter(Boolean);
}
const matches = (said, charted, tol) => {
  if (said.sys !== undefined) return charted.sys !== undefined && Math.abs(said.sys - charted.sys) <= tol && Math.abs(said.dia - charted.dia) <= tol;
  if (said.low !== undefined) return charted.value >= said.low && charted.value <= said.high;
  return Math.abs(said.value - charted.value) <= tol;
};
const at = (c) => `row ${c.row}${c.time ? ` at ${c.time}` : ''}`;

// Treatments a triage nurse needs to hear about, by ACR procedure code, and the words that count as saying so.
const TREATMENTS = [
  { codes: ['504'], name: 'ASA', said: /\b(asa|aspirin)\b/ },
  { codes: ['615'], name: 'nitroglycerin', said: /\b(nitro\w*|ntg|spray)\b/ },
  { codes: ['610'], name: 'naloxone', said: /\b(naloxone|narcan)\b/ },
  { codes: ['560'], name: 'glucagon', said: /\bglucagon\b/ },
  { codes: ['561'], name: 'oral glucose', said: /\b(oral glucose|glucose gel|gel|insta ?glucose|dex ?4|juice)\b/ },
  { codes: ['528', '529', '530'], name: 'dextrose', said: /\b(dextrose|d10|d25|d50)\b/ },
  { codes: ['540', '541'], name: 'epinephrine', said: /\b(epi|epinephrine|adrenaline|epipen)\b/ },
  { codes: ['650'], name: 'salbutamol', said: /\b(salbutamol|ventolin|puffers?|puffs|nebs?|mdi)\b/ },
  { codes: ['533'], name: 'dimenhydrinate', said: /\b(dimenhydrinate|gravol)\b/ },
  { codes: ['534'], name: 'diphenhydramine', said: /\b(diphenhydramine|benadryl)\b/ },
  { codes: ['498'], name: 'acetaminophen', said: /\b(acetaminophen|tylenol)\b/ },
  { codes: ['704'], name: 'ibuprofen', said: /\b(ibuprofen|advil|motrin)\b/ },
  { codes: ['706'], name: 'ketorolac', said: /\b(ketorolac|toradol)\b/ },
  { codes: ['728'], name: 'ondansetron', said: /\b(ondansetron|zofran)\b/ },
  { codes: ['620'], name: 'oxytocin', said: /\b(oxytocin|pitocin)\b/ },
  { codes: ['141', '144'], name: 'assisted ventilation (BVM)', said: /\b(bvm|bag|bagged|bagging|bag valve|ventilat\w*|assisted (breaths|breathing|ventilations?)|breaths for)\b/ },
  { codes: ['383'], name: 'CPAP', said: /\bcpap\b/ },
  { codes: ['313', '313.1'], name: 'the 12-lead', said: /\b(12|15) lead|\b(ecg|ekg|stemi)\b/ },
  { codes: ['300'], name: 'CPR', said: /\b(cpr|compressions)\b/ },
  { codes: ['306', '307', '308'], name: 'defibrillation', said: /\b(shock\w*|defib\w*)\b/ },
  { codes: ['316'], name: 'return of spontaneous circulation', said: /\b(rosc|pulse back|got (a|her|him) pulse back|return of (spontaneous )?circulation)\b/ },
];
const NOTHING_GIVEN = /\b(haven'?t|have not|didn'?t|did not|nothing|no) (given|give|meds|medications|treatment|anything)\b|\bnothing given\b|\bhaven'?t given\b/;

const CC_WORDS = { od: 'overdose', sob: 'short of breath', cp: 'chest pain', aloc: 'altered', loc: 'conscious', mvc: 'collision', nv: 'nausea', 'n/v': 'nausea', abd: 'abdominal', fx: 'fracture', gi: 'bleed' };
const STOP = new Set(['and', 'the', 'with', 'after', 'for', 'from', 'of', 'to', 'a', 'x', 'min', 'mins', 'minutes', 'hour', 'hours', 'pt', 'patient', 'possible', 'query', 'since', 'at', 'in', 'on']);

// ---- the check -------------------------------------------------------------------------------------------------
export function checkTriageReport(chart, transcript, { durationSec = null } = {}) {
  const norm = normalizeSpoken(transcript);
  const words = norm.split(' ').filter(Boolean);
  const items = [];
  const add = (status, title, detail = '') => items.push({ status, title, detail });

  // Who
  const age = num(chart.patient && chart.patient.age);
  if (age !== null) {
    if (new RegExp(`\\b${age}\\b`).test(norm)) add('ok', 'Age');
    else add('missing', 'Age', `Your chart says ${age}. It's usually the first thing the nurse writes.`);
  }

  // Why they called
  const cc = String(chart.chiefComplaint || '').toLowerCase();
  if (cc) {
    const ccWords = cc.split(/[^a-z/]+/).map((w) => CC_WORDS[w] || w).filter((w) => w.length > 2 && !STOP.has(w));
    const hit = ccWords.some((w) => norm.includes(w.slice(0, Math.max(4, w.length - 2))));
    if (hit) add('ok', 'Why they called');
    else add('note', 'Why they called', `Your chart's chief complaint is "${chart.chiefComplaint}". Check the nurse would hear that in your first sentence.`);
  }

  // Vitals: the latest set, and whether anything said disagrees with the chart
  let trendShown = false;
  const vitalRows = (chart.treatmentGrid || []).filter((r) => r.Pulse || r.Resp || r.BP || r.SpO2);
  for (const v of VITALS) {
    const series = chartedSeries(chart, v.key);
    const said = saidValues(norm, v);
    if (!series.length) {
      if (said.length) add('note', `You gave ${v.name}`, `There's no ${v.name} on your chart. If you took it, chart it.`);
      continue;
    }
    const last = series[series.length - 1];
    if (!said.length) {
      const matters = v.core || (v.key === 'GCS' && series.some((c) => c.value < 15)) || (v.key === 'EtCO2' && series.length > 1);
      if (matters) add('missing', `No ${v.name}`, `Your last charted ${v.name} is ${last.text} (${at(last)}).`);
      continue;
    }
    const matchLast = said.some((s) => matches(s, last, v.tol));
    const matchedRows = series.filter((c) => said.some((s) => matches(s, c, v.tol)));
    const stray = said.filter((s) => !series.some((c) => matches(s, c, v.tol)));
    if (matchedRows.length >= 2 && matchLast) trendShown = true;
    if (stray.length) {
      add('conflict', `You said ${v.name} ${stray[0].text}. Your chart doesn't have that.`,
        `Charted: ${series.map((c) => c.text).join(', ')}. The last one is ${last.text} (${at(last)}). Which is true when you hand over?`);
    } else if (!matchLast) {
      add('note', `${v.name[0].toUpperCase()}${v.name.slice(1)} from an earlier set`,
        `You gave ${said[0].text}, which is on ${at(matchedRows[0])}. Your latest is ${last.text} (${at(last)}). Give the current one, and the change if it matters.`);
    } else {
      add('ok', `${v.name[0].toUpperCase()}${v.name.slice(1)} matches your last set`, `${last.text}, ${at(last)}.`);
    }
  }

  // Glucose: code 25 rows carry the reading
  const bglRows = (chart.treatmentGrid || []).filter((r) => String(r.code) === '25' && num(r['Reading/Code']) !== null);
  if (bglRows.length) {
    const last = bglRows[bglRows.length - 1];
    const lastVal = num(last['Reading/Code']);
    const said = saidValues(norm, { words: /\b(bgl|glucose|sugar|blood sugar|cbg|gluc)\b/ });
    if (!said.length) add('missing', 'No blood glucose', `Your chart has ${lastVal} (${at(last)}).`);
    else if (said.some((s) => Math.abs(s.value - lastVal) <= 0.2)) add('ok', 'Blood glucose', `${lastVal}, ${at(last)}.`);
    else add('conflict', `You said glucose ${said[0].text}. Your chart says ${lastVal}.`, `${at(last)}.`);
  }

  // Trend
  if (vitalRows.length >= 2) {
    const trendWords = /\b(now|improved|improving|better|worse|worsening|came up|went up|dropped|down to|up to|after|since|repeat|second set|responded|response)\b/.test(norm);
    if (trendShown || trendWords) add('ok', 'The trend', 'The nurse hears how the patient changed, not just one snapshot.');
    else add('note', 'Only one snapshot', `You charted ${vitalRows.length} sets of vitals. One line on how they changed tells the nurse more than any single number.`);
  }

  // Treatment
  const given = [];
  for (const t of TREATMENTS) {
    const rows = (chart.treatmentGrid || []).filter((r) => t.codes.includes(String(r.code).split('.')[0]) || t.codes.includes(String(r.code)));
    if (!rows.length) continue;
    const r = rows[0];
    const dose = [r['Dose/Unit'], r.Route].filter(Boolean).join(' ');
    given.push(t.name);
    if (t.said.test(norm)) add('ok', `Said ${t.name}`);
    else add('missing', `${t.name[0].toUpperCase()}${t.name.slice(1)} isn't in your report`, `Charted${dose ? ` ${dose}` : ''} at ${r.time || `row ${r.row}`}${rows.length > 1 ? `, ${rows.length} times` : ''}.`);
  }
  if (given.length && NOTHING_GIVEN.test(norm)) {
    add('conflict', 'You said nothing was given.', `Your chart has ${given.join(', ')}.`);
  }

  // Allergies
  const allergies = chart.allergies || {};
  const charted = [...(allergies.ticked || []), allergies.details].filter(Boolean).join(', ');
  if (/\b(allerg\w*|nka|nkda|no known)\b/.test(norm)) add('ok', 'Allergies');
  else add('note', 'Allergies not mentioned', charted ? `Charted as ${charted}. One word covers it.` : 'Nothing is charted either. Ask, then chart it.');

  // Time
  const secs = durationSec !== null && Number.isFinite(durationSec) ? Math.round(durationSec) : Math.round((words.length / 150) * 60);
  const label = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
  const how = durationSec !== null ? '' : ' (estimated from length)';
  if (secs <= 60) add('ok', `Under a minute: ${label}${how}`);
  else add('note', `Over a minute: ${label}${how}`, 'After a minute the nurse is usually turning to the next stretcher. Cut what doesn\'t change what they do next.');

  const order = { conflict: 0, missing: 1, note: 2, ok: 3 };
  items.sort((a, b) => order[a.status] - order[b.status]);
  return { items, wordCount: words.length, seconds: secs };
}
