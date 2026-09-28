// ECG tracings for the exported PDF, drawn as vector lines at true scale (25 mm/s, 10 mm/mV) so a printed strip can be
// measured with calipers. Same engine and patterns as the on-screen views, so paper and screen always match.
import { _TL_PATTERNS, pickTwelveLeadPattern } from "./ecgPatterns";
import { MM_PER_MV, MM_PER_SEC, isRhythmOnlyPattern, normalizeRhythm, rhythmEvents, rhythmForPattern, sampleLead } from "./ecgEngine";

const INK = [25, 25, 25];
const MINOR = [248, 208, 208];
const MAJOR = [236, 150, 150];
const LABEL = [184, 70, 70];

function drawGrid(doc, x, y, w, h) {
  doc.setLineWidth(0.07);
  doc.setDrawColor(...MINOR);
  for (let i = 1; i < w; i += 1) if (i % 5) doc.line(x + i, y, x + i, y + h);
  for (let j = 1; j < h; j += 1) if (j % 5) doc.line(x, y + j, x + w, y + j);
  doc.setLineWidth(0.16);
  doc.setDrawColor(...MAJOR);
  for (let i = 0; i <= w + 0.01; i += 5) doc.line(x + i, y, x + i, y + h);
  for (let j = 0; j <= h + 0.01; j += 5) doc.line(x, y + j, x + w, y + j);
}

// samples: [[ms, mV], ...] from sampleLead. Clipped to the box like a paper edge.
function drawTrace(doc, samples, x, y, w, h, baselineMm) {
  const pts = samples
    .map(([t, mv]) => [x + (t * MM_PER_SEC) / 1000, Math.min(y + h - 0.2, Math.max(y + 0.2, y + baselineMm - mv * MM_PER_MV))])
    .filter((p) => p[0] <= x + w + 0.01);
  if (pts.length < 2) return;
  const deltas = pts.slice(1).map((p, i) => [p[0] - pts[i][0], p[1] - pts[i][1]]);
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.22);
  doc.lines(deltas, pts[0][0], pts[0][1], [1, 1], "S", false);
}

function cellLabel(doc, text, x, y) {
  doc.setFont(undefined, "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(...LABEL);
  doc.text(text, x + 1.2, y + 3);
}

// Six seconds of lead II, 150 x 30 mm. Returns the height used, caption included.
export function drawRhythmStrip(doc, { x, y, rhythm, hr, patternKey = "", caption = "" }) {
  const name = normalizeRhythm(rhythm) || "Normal Sinus Rhythm";
  const shapeKey = patternKey && !isRhythmOnlyPattern(patternKey) ? patternKey : "";
  const w = 150, h = 30;
  doc.setFont(undefined, "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(90, 100, 110);
  const flat = name === "Ventricular Fibrillation" || name === "Asystole";
  doc.text(caption || `Lead II · ${name}${flat ? "" : ` · ${hr} bpm`}`, x, y + 3);
  const top = y + 5;
  drawGrid(doc, x, top, w, h);
  drawTrace(doc, sampleLead({ rhythm: name, hr, lead: "II", patternKey: shapeKey, durationMs: 6000, step: 4, seed: 7 }), x, top, w, h, 19);
  cellLabel(doc, "II", x, top);
  doc.setFont(undefined, "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(120, 128, 136);
  doc.text("25 mm/s · 10 mm/mV · 6 s", x + w, top + h + 3.2, { align: "right" });
  return 5 + h + 5;
}

// The 12-lead (or 15-lead) printout: four columns of 2.5 s from one 10 s recording, then 10 s of lead II.
// 250 mm wide, so it goes on a landscape page. Returns the height used.
export function drawTwelveLead(doc, { x, y, ecgType, rhythmInterp, twelveLeadFindings, fifteenLeadFindings, hr, patternKey }) {
  const pattern = pickTwelveLeadPattern(ecgType, rhythmInterp, twelveLeadFindings, fifteenLeadFindings, patternKey);
  const p = _TL_PATTERNS[pattern] || _TL_PATTERNS.normal;
  const rhythm = normalizeRhythm(rhythmInterp) || rhythmForPattern(pattern) || "Normal Sinus Rhythm";
  const is15 = ecgType === "15-lead" || pattern === "inferiorRV" || pattern === "posterior";
  const cols = [["I", "II", "III"], ["aVR", "aVL", "aVF"], ["V1", "V2", "V3"], is15 ? ["V4R", "V8", "V9"] : ["V4", "V5", "V6"]];
  const events = rhythmEvents(rhythm, hr, 10000, 11);
  const sinus = /sinus rhythm$|sinus (brady|tachy)cardia/i.test(rhythm) && rhythm !== "Sinus Rhythm with PVCs";
  const title = isRhythmOnlyPattern(pattern) ? `${rhythm}: ${is15 ? "15" : "12"}-Lead` : `${p.title}${sinus ? "" : ` · ${rhythm}`}`;
  const cw = 62.5, ch = 34, base = 21;

  doc.setFont(undefined, "bold");
  doc.setFontSize(9);
  doc.setTextColor(60, 70, 80);
  doc.text(`${title} · ${hr} bpm`, x, y + 3.5);
  const top = y + 6;
  cols.forEach((col, ci) => col.forEach((lead, ri) => {
    const cx = x + ci * cw, cy = top + ri * ch;
    drawGrid(doc, cx, cy, cw, ch);
    drawTrace(doc, sampleLead({ rhythm, hr, lead, patternKey: pattern, startMs: ci * 2500, durationMs: 2500, step: 4, events, seed: 11 }), cx, cy, cw, ch, base);
    cellLabel(doc, lead, cx, cy);
  }));
  const ry = top + 3 * ch + 2;
  drawGrid(doc, x, ry, 250, ch);
  drawTrace(doc, sampleLead({ rhythm, hr, lead: "II", patternKey: pattern, startMs: 0, durationMs: 10000, step: 4, events, seed: 11 }), x, ry, 250, ch, base);
  cellLabel(doc, "II", x, ry);
  doc.setFont(undefined, "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(120, 128, 136);
  doc.text(`${is15 ? "V4R · V8 · V9: modified 15-lead positions · " : ""}25 mm/s · 10 mm/mV · 10 s rhythm strip, lead II`, x + 250, ry + ch + 3.5, { align: "right" });
  return 6 + 4 * ch + 2 + 5;
}
