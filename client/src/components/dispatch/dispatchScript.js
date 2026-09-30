// Turns a scenario's call information into what a dispatcher would say over the radio, and the items a student should
// catch from it. Nothing here comes from the parts of the scenario a crew wouldn't know yet.

const STREETS = ["Birch Street", "Wellington Street", "Maple Avenue", "Church Street", "Victoria Road", "Elm Crescent",
  "Mill Street", "Queen Street", "Lakeview Drive", "Station Road", "Cedar Lane", "King Street"];
const RURAL = ["Concession Road 6", "Ridge Line", "Sideroad 15", "Township Road 4", "Old Mill Road", "County Road 12"];
const NUMBER_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];

function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

// A made-up address that fits the setting. It is only ever spoken on the radio; the scenario itself has no address.
export function fictionalAddress(scenario, environment) {
  const seed = hash(String((scenario && scenario.title) || "") + String(environment || ""));
  const env = String(environment || "").toLowerCase();
  if (env === "wilderness") return "";
  if (env === "rural") return `${1000 + (seed % 8000)} ${RURAL[seed % RURAL.length]}`;
  return `${20 + (seed % 880)} ${STREETS[seed % STREETS.length]}`;
}

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const trimDot = (s) => String(s || "").trim().replace(/[.\s]+$/, "");

function ageSex(demo) {
  const age = String((demo && demo.age) || "").match(/\d+/);
  const sex = String((demo && demo.sex) || "").toLowerCase();
  const who = sex.startsWith("f") ? "female" : sex.startsWith("m") ? "male" : "patient";
  if (!age) return cap(who);
  const n = Number(age[0]);
  if (n < 2 && /month|mo\b/i.test(String(demo.age))) return `${n}-month-old ${who}`;
  return `${n}-year-old ${who}`;
}

function spokenTime(t) {
  const m = String(t || "").match(/(\d{1,2}):?(\d{2})/);
  if (!m) return "";
  return `${m[1].padStart(2, "0")}:${m[2]}`;
}

// Words worth catching in a phrase: skip the small ones.
const STOP = new Set(["the", "and", "with", "from", "that", "this", "very", "about", "into", "their", "they", "have", "has",
  "was", "were", "been", "possible", "reports", "reported", "caller", "states", "says", "after", "near", "while", "some"]);
const keyWords = (s) => String(s || "").toLowerCase().match(/[a-z0-9]+/g)?.filter((w) => w.length > 3 && !STOP.has(w)) || [];

export function buildDispatch(scenario, environment) {
  const ci = (scenario && scenario.callInformation) || {};
  const demo = (scenario && scenario.patientDemographics) || {};
  const priority = trimDot(ci.dispatchCode || "");
  const address = fictionalAddress(scenario, environment);
  const place = trimDot(ci.location || "");
  // "Elderly female very drowsy..." after "78-year-old female" says it twice: drop the leading description.
  const WHO = /^(an?\s+)?(elderly|older|adult|teenage|young|middle-aged|older adult)?\s*(adult\s+)?(male|female|man|woman|patient|person|worker|boy|girl|child)?\s*/i;
  const notes = (Array.isArray(ci.dispatchNotes) ? ci.dispatchNotes : ci.dispatchNotes ? [ci.dispatchNotes] : [])
    .map(trimDot).filter(Boolean).slice(0, 3)
    .map((n, k) => (k === 0 ? n.replace(/^\d+[- ]year[- ]old\s+/i, "").replace(WHO, "") || n : n));
  const hazards = (Array.isArray(ci.hazardsOrFlags) ? ci.hazardsOrFlags : ci.hazardsOrFlags ? [ci.hazardsOrFlags] : [])
    .map(trimDot).filter(Boolean).slice(0, 2);
  const unitNo = hash(String(scenario && scenario.title)) % 90 + 10;
  const unit = `Medic ${Math.floor(unitNo / 10)}-${unitNo % 10}`;
  const unitSpoken = `Medic ${NUMBER_WORDS[Math.floor(unitNo / 10)]} ${NUMBER_WORDS[unitNo % 10]}`;
  const time = spokenTime(ci.time);
  const who = ageSex(demo);

  const parts = [
    `${unit}, ${unit}.`,
    priority ? `${priority}.` : "",
    address ? `${address}${place ? `, ${place.charAt(0).toLowerCase()}${place.slice(1)}` : ""}.` : `${cap(place)}.`,
    `${who}${notes.length ? `, ${notes[0].charAt(0).toLowerCase()}${notes[0].slice(1)}` : ""}.`,
    ...notes.slice(1).map((n) => `${cap(n)}.`),
    hazards.length ? `Be advised: ${hazards.map((h) => h.charAt(0).toLowerCase() + h.slice(1)).join(", ")}.` : "",
    time ? `Time out ${time}.` : "",
  ].filter(Boolean);
  const text = parts.join(" ");
  const speech = text.split(unit).join(unitSpoken).replace(/\bEtCO2\b/g, "end tidal");

  const ageMatch = String(demo.age || "").match(/\d+/);
  const items = [
    priority && { label: priority, test: (t) => new RegExp(priority.replace(/priority\s*/i, "").trim(), "i").test(t) },
    { label: address || cap(place), test: (t) => { const where = address || place; const n = where.match(/\d+/); const w = (where.toLowerCase().match(/[a-z]+/g) || []).filter((x) => x.length >= 3 && !STOP.has(x)); return (n ? t.includes(n[0]) : true) && (!w.length || w.some((x) => t.includes(x.slice(0, 4)))); } },
    ageMatch && {
      label: who,
      test: (t) => {
        if (!t.includes(ageMatch[0])) return false;
        if (who.includes("female")) return /\bf\b|female|woman|lady|\d\s*f\b/.test(t);
        if (who.includes("male")) return /\bm\b|\bmale|\bman\b|\bguy\b|\d\s*m\b/.test(t);
        return true;
      },
    },
    ...notes.map((n, k) => ({ label: cap(n), optional: k >= 2, test: (t) => { const w = keyWords(n); if (!w.length) return true; const hit = w.filter((x) => t.includes(x.slice(0, 5))).length; return hit >= (w.length <= 3 ? 1 : Math.ceil(w.length * 0.4)); } })),
    ...hazards.map((h) => ({ label: h, optional: true, test: (t) => { const w = keyWords(h); return w.some((x) => t.includes(x.slice(0, 5))); } })),
  ].filter(Boolean);

  return { unit, text, speech, items, priority };
}

export function checkCatch(dispatch, written) {
  const t = String(written || "").toLowerCase();
  return dispatch.items.map((it) => ({ label: it.label, optional: !!it.optional, caught: !!it.test(t) }));
}
