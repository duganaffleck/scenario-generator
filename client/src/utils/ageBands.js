// Normal ranges by age, so a newborn's heart rate of 140 isn't shown or alarmed as dangerous.
// Awake, at rest. Pediatric bands follow the common PALS-style tables; adults keep the ranges the app always used.
// If your program teaches a different table, change the numbers here: the scenario view, the monitor and the
// rhythm labels all read from this one place.

export const BANDS = [
  { key: "newborn", label: "Newborn", maxDays: 28, hr: [100, 180], rr: [30, 60], hrLowRed: 100 },
  { key: "infant", label: "Infant", maxDays: 365, hr: [100, 160], rr: [30, 53] },
  { key: "toddler", label: "Toddler", maxDays: 3 * 365, hr: [90, 150], rr: [22, 37] },
  { key: "preschool", label: "Child", maxDays: 6 * 365, hr: [80, 140], rr: [20, 28] },
  { key: "school", label: "Child", maxDays: 12 * 365, hr: [70, 120], rr: [18, 25] },
  { key: "adolescent", label: "Adolescent", maxDays: 18 * 365, hr: [60, 100], rr: [12, 20] },
  { key: "adult", label: "Adult", maxDays: Infinity, hr: [60, 100], rr: [12, 20] },
];

const UNIT_DAYS = { minute: 1 / 1440, min: 1 / 1440, hour: 1 / 24, hr: 1 / 24, day: 1, week: 7, wk: 7, month: 30.4, mo: 30.4, year: 365, yr: 365, y: 365 };

// "2 minutes", "3 days old", "6 months", "18 mo", "4 y", "4", "newborn". Returns null when it can't tell.
export function parseAge(ageText) {
  const s = String(ageText ?? "").toLowerCase().trim();
  if (!s) return null;
  const m = s.match(/(\d+(?:\.\d+)?)\s*(minutes?|mins?|hours?|hrs?|days?|weeks?|wks?|months?|mo|years?|yrs?|y)?\b/);
  if (!m) return /newborn|neonate|just (been )?born/.test(s) ? { days: 0, minutes: null } : null;
  const n = Number(m[1]);
  const unit = (m[2] || "year").replace(/s$/, "");
  const days = n * (UNIT_DAYS[unit] ?? 365);
  const minutes = /^min/.test(unit) ? n : /^h/.test(unit) ? n * 60 : null;
  return { days, minutes };
}

export function bandFor(ageText) {
  const age = parseAge(ageText);
  if (!age) return BANDS[BANDS.length - 1];
  return BANDS.find((b) => age.days < b.maxDays) || BANDS[BANDS.length - 1];
}

export const isChild = (band) => band && band.key !== "adult";

// Lowest acceptable systolic for age (PALS hypotension): under 60 newborn, 70 infant, 70 + 2 x years to 10, then 90.
export function sbpFloor(ageText) {
  const age = parseAge(ageText);
  if (!age) return 90;
  const years = age.days / 365;
  if (age.days < 28) return 60;
  if (years < 1) return 70;
  if (years <= 10) return 70 + 2 * Math.floor(years);
  return 90;
}

// Newborn SpO2 targets in the first minutes of life (pre-ductal, NRP): 1 min 60%, 2 min 65%, 3 min 70%, 4 min 75%,
// 5 min 80%, 10 min 85%. Returns the lower target for a minute of life, or null past 10 minutes.
export function newbornSpo2Floor(minuteOfLife) {
  if (minuteOfLife === null || minuteOfLife === undefined || minuteOfLife > 10) return null;
  const m = Math.max(1, minuteOfLife);
  if (m <= 5) return 55 + 5 * Math.floor(m);
  return 80 + (5 * (m - 5)) / 5;
}

// The sinus label for a rate, by age: over the band's range is tachycardia, under it bradycardia.
export function sinusLabel(hr, band) {
  const b = band || BANDS[BANDS.length - 1];
  if (hr > b.hr[1]) return "Sinus Tachycardia";
  if (hr < b.hr[0]) return "Sinus Bradycardia";
  return "Normal Sinus Rhythm";
}

// Short text for the monitor's top bar: "Newborn · 2 min", "Infant · 6 mo", "Child · 4 y", "Adult".
export function ageLabel(ageText) {
  const band = bandFor(ageText);
  const s = String(ageText ?? "").trim();
  if (!s || band.key === "adult") return band.label;
  const age = parseAge(s);
  if (!age || (age.days === 0 && age.minutes === null)) return band.label;
  const short = age.minutes !== null && age.minutes < 120 ? `${Math.round(age.minutes)} min`
    : age.days < 1 ? `${Math.round(age.days * 24)} h`
    : age.days < 60 ? `${Math.round(age.days)} d`
    : age.days < 730 ? `${Math.round(age.days / 30.4)} mo`
    : `${Math.floor(age.days / 365)} y`;
  return `${band.label} · ${short}`;
}
