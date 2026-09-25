// Instructor run sheet: one printable page (two at most) for running a generated scenario in lab.
// Pure function: scenario in, HTML out. Opened in a new tab so the instructor can print it or keep it on a tablet.

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const isBlank = (v) =>
  v === undefined || v === null || v === "" ||
  (Array.isArray(v) && v.every(isBlank)) ||
  (typeof v === "object" && !Array.isArray(v) && Object.values(v).every(isBlank));

// Any value as short readable text: strings as-is, arrays joined, objects as "Key: value; ..."
const text = (v) => {
  if (isBlank(v)) return "";
  if (Array.isArray(v)) return v.map(text).filter(Boolean).join("; ");
  if (typeof v === "object") {
    return Object.entries(v)
      .filter(([, x]) => !isBlank(x))
      .map(([k, x]) => `${label(k)}: ${text(x)}`)
      .join("; ");
  }
  // Teaching cues are hidden everywhere else on the site; older saved scenarios may still carry them.
  return String(v).replace(/\s*\*\(💡[\s\S]*?\)\*/g, "").trim();
};

const SMALL = new Set(["and", "or", "of", "to", "the", "in", "on", "with", "for"]);
const SPECIAL = { instructorPriorities: "Watch For", opqrst: "OPQRST", sample: "SAMPLE", headNeck: "Head/Neck", backPelvis: "Back/Pelvis", spo2: "SpO2", etco2: "EtCO2", gcs: "GCS", bgl: "BGL", hr: "HR", rr: "RR", bp: "BP" };
const label = (k) => SPECIAL[k] ||
  String(k)
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .split(" ")
    .map((w, i) => (i > 0 && SMALL.has(w.toLowerCase()) ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");

const list = (v) => (Array.isArray(v) ? v : isBlank(v) ? [] : [v]).map(text).filter(Boolean);

function dl(obj, keys) {
  const rows = (keys || Object.keys(obj || {}))
    .filter((k) => obj && !isBlank(obj[k]))
    .map((k) => `<dt>${esc(label(k))}</dt><dd>${esc(text(obj[k]))}</dd>`);
  return rows.length ? `<dl>${rows.join("")}</dl>` : "";
}

function vitalsTable(v) {
  if (!v) return "";
  const sets = [v.firstSet, v.secondSet, ...(Array.isArray(v.additionalSets) ? v.additionalSets : [])].filter((s) => s && !isBlank(s));
  if (!sets.length) return "";
  const cols = [["hr", "HR"], ["bp", "BP"], ["rr", "RR"], ["spo2", "SpO2"], ["etco2", "EtCO2"], ["gcs", "GCS"], ["bgl", "BGL"], ["temp", "Temp"], ["ecgInterpretation", "Rhythm"]]
    .filter(([k]) => sets.some((s) => !isBlank(s[k])));
  const head = `<tr><th>Stage</th>${cols.map(([, h]) => `<th>${h}</th>`).join("")}</tr>`;
  const body = sets.map((s, i) =>
    `<tr><td class="stage">${esc(s.context || `Set ${i + 1}`)}</td>${cols.map(([k]) => `<td>${esc(text(s[k]))}</td>`).join("")}</tr>`).join("");
  return `<table class="vitals">${head}${body}</table>`;
}

function progression(cp) {
  if (!cp || isBlank(cp)) return "";
  const tracks = [
    ["withProperTreatment", "Good care"],
    ["withoutProperTreatment", "Delayed or missing care"],
    ["withIncorrectTreatment", "Wrong care"],
    ["movementOrTransportChanges", "Moving and transport"],
  ].filter(([k]) => !isBlank(cp[k]));
  return `<div class="tracks">${tracks.map(([k, h]) =>
    `<div class="track"><h4>${h}</h4><ul>${list(cp[k]).map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>`).join("")}</div>`;
}

function grs(anchors) {
  if (!anchors || isBlank(anchors)) return "";
  const names = {
    situationalAwareness: "Situation Awareness", historyGathering: "History Gathering", patientAssessment: "Patient Assessment",
    decisionMaking: "Decision Making", proceduralSkill: "Procedural Skill", resourceUtilization: "Resource Utilization", communication: "Communication",
  };
  const scores = ["3", "5", "7"].filter((sc) => Object.values(anchors).some((d) => d && !isBlank(d[sc])));
  const rows = Object.entries(anchors)
    .filter(([, d]) => d && !isBlank(d))
    .map(([dom, d]) => `<tr><th>${esc(names[dom] || label(dom))}</th>${scores.map((sc) =>
      `<td><ul>${list(d[sc]).map((x) => `<li>${esc(x)}</li>`).join("")}</ul></td>`).join("")}</tr>`);
  if (!rows.length) return "";
  return `<table class="grs"><tr><th>Domain</th>${scores.map((sc) => `<th>${sc}</th>`).join("")}</tr>${rows.join("")}</table>`;
}

export function buildRunSheetHtml(scenario, formData = {}) {
  const s = scenario || {};
  const meta = [
    formData.semester && `Semester ${formData.semester}`, formData.type, formData.environment, formData.complexity,
    formData.scenarioFriction, formData.shiftMode,
  ].filter(Boolean).join(" · ");
  const treatment = list(s.expectedTreatment);
  const priorities = s.instructorGuidance ? list(s.instructorGuidance.instructorPriorities) : [];
  const debrief = s.instructorGuidance ? text(s.instructorGuidance.psychologicalSafetyDebrief) : "";
  const section = (title, body) => (body ? `<section><h2>${title}</h2>${body}</section>` : "");

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Run sheet: ${esc(s.title || "Scenario")}</title>
<style>
  :root { --ink:#1f2933; --muted:#5d6570; --line:#cfd6dc; --accent:#0a6e72; }
  * { box-sizing: border-box; }
  body { font: 13px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: var(--ink); margin: 0; background: #fff; }
  main { max-width: 900px; margin: 0 auto; padding: 22px 18px 40px; }
  header { border-bottom: 2px solid var(--accent); padding-bottom: 8px; margin-bottom: 12px; display: flex; justify-content: space-between; gap: 12px; align-items: flex-end; flex-wrap: wrap; }
  h1 { font-size: 20px; margin: 0; }
  .meta { color: var(--muted); font-size: 12px; margin-top: 3px; }
  button { font: inherit; font-weight: 700; padding: 7px 14px; border-radius: 8px; border: 1px solid var(--accent); background: var(--accent); color: #fff; cursor: pointer; }
  section { margin: 12px 0; break-inside: avoid; }
  h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .05em; color: var(--accent); margin: 0 0 5px; border-bottom: 1px solid var(--line); padding-bottom: 2px; }
  h4 { margin: 0 0 3px; font-size: 12px; }
  dl { display: grid; grid-template-columns: max-content 1fr; gap: 2px 12px; margin: 0; }
  dt { font-weight: 700; } dd { margin: 0; }
  ul { margin: 0; padding-left: 18px; } li { margin: 1px 0; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { border: 1px solid var(--line); padding: 3px 5px; text-align: left; vertical-align: top; }
  th { background: #f1f5f7; }
  .vitals td.stage { font-weight: 600; max-width: 220px; }
  .tracks { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .track { border: 1px solid var(--line); border-radius: 6px; padding: 6px 8px; }
  .check { list-style: none; padding: 0; }
  .check li { display: grid; grid-template-columns: 16px 1fr 70px; gap: 8px; align-items: start; padding: 3px 0; border-bottom: 1px dotted var(--line); }
  .box { width: 12px; height: 12px; border: 1.5px solid var(--ink); border-radius: 2px; margin-top: 2px; }
  .time { border-bottom: 1px solid var(--muted); height: 14px; }
  .grs td ul { padding-left: 14px; font-size: 11px; }
  .notes { height: 90px; border: 1px solid var(--line); border-radius: 6px; }
  .foot { color: var(--muted); font-size: 11px; margin-top: 14px; }
  @media (max-width: 640px) { .tracks { grid-template-columns: 1fr; } dl { grid-template-columns: 1fr; } }
  @media print { button { display: none; } main { padding: 0; } @page { margin: 12mm; } }
</style></head>
<body><main>
<header><div><h1>${esc(s.title || "Scenario")}</h1><div class="meta">Run sheet${meta ? " · " + esc(meta) : ""}</div></div>
<button onclick="window.print()">Print</button></header>
${section("Dispatch", dl(s.callInformation, ["type", "location", "time", "dispatchCode", "dispatchNotes", "hazardsOrFlags"]))}
${section("Patient", dl(s.patientDemographics, ["name", "age", "sex", "weight", "chiefComplaint", "appearance"]) +
    (s.patientPresentation ? `<p>${esc(text(s.patientPresentation))}</p>` : ""))}
${section("History", dl({ opqrst: s.opqrst, sample: s.sample }))}
${section("Physical exam", dl(s.physicalExam))}
${section("Vitals by stage", vitalsTable(s.vitalSigns))}
${section("How the patient responds", progression(s.caseProgression))}
${section("Expected treatment (tick and time as it happens)", treatment.length
    ? `<ul class="check">${treatment.map((t) => `<li><span class="box"></span><span>${esc(t)}</span><span class="time"></span></li>`).join("")}</ul>` : "")}
${section("Watch for", priorities.length ? `<ul>${priorities.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>` : "")}
${section("GRS anchors", grs(s.grsAnchors))}
${section("Debrief", (debrief ? `<p>${esc(debrief)}</p>` : "") +
    (list(s.selfReflectionPrompts).length ? `<ul>${list(s.selfReflectionPrompts).map((q) => `<li>${esc(q)}</li>`).join("")}</ul>` : ""))}
<section><h2>Notes</h2><div class="notes"></div></section>
<p class="foot">Generated by AI. Check doses and directive details against the current Ontario BLS and ALS PCS.</p>
</main></body></html>`;
}

// Opens the run sheet in a new tab. Called from a click, so pop-up blockers allow it.
export function openRunSheet(scenario, formData) {
  const url = URL.createObjectURL(new Blob([buildRunSheetHtml(scenario, formData)], { type: "text/html" }));
  const win = window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  return Boolean(win);
}
