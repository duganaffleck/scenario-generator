import React from "react";
import { _TL_PATTERNS, pickTwelveLeadPattern } from "./ecgPatterns";
import {
  gridLines, isRhythmOnlyPattern, normalizeRhythm, rhythmEvents, rhythmForPattern, sampleLead, toPath,
} from "./ecgEngine";

const palette = (night) => ({
  bg: night ? "#1a0a0a" : "#fff8f8",
  minor: night ? "#3a1a1a" : "#fbd3d3",
  major: night ? "#6a2828" : "#f19a9a",
  wave: night ? "#00e87a" : "#111111",
  label: night ? "#ff6060" : "#c05050",
});

function Tracing({ samples, widthMm, heightMm, baselineMm, pxPerMm, night, label, strokeWidth = 1.3 }) {
  const c = palette(night);
  const w = widthMm * pxPerMm, h = heightMm * pxPerMm;
  const { minor, major } = gridLines(widthMm, heightMm, pxPerMm);
  const line = ([dir, p]) => (dir === "v" ? `M${p.toFixed(1)} 0V${h}` : `M0 ${p.toFixed(1)}H${w}`);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", display: "block" }} role="img" aria-label={label}>
      <rect width={w} height={h} fill={c.bg} />
      <path d={minor.map(line).join("")} stroke={c.minor} strokeWidth={0.35} />
      <path d={major.map(line).join("")} stroke={c.major} strokeWidth={0.8} />
      <path d={toPath(samples, { pxPerMm, baselineMm, heightMm })} stroke={c.wave} strokeWidth={strokeWidth} fill="none" strokeLinejoin="round" strokeLinecap="round" />
      {label && <text x={4} y={11} fontSize={10} fontFamily="monospace" fontWeight={700} fill={c.label}>{label}</text>}
    </svg>
  );
}

// Monitor-style rhythm strip: 6 seconds of lead II. If the scenario has a 12-lead pattern, lead II takes its
// shape from it (an inferior STEMI shows its ST elevation on the monitor too).
export function RhythmStripSVG({ rhythm, hr, isNightShift, patternKey = "" }) {
  const name = normalizeRhythm(rhythm) || "Normal Sinus Rhythm";
  const shapeKey = patternKey && !isRhythmOnlyPattern(patternKey) ? patternKey : "";
  const samples = sampleLead({ rhythm: name, hr, lead: "II", patternKey: shapeKey, durationMs: 6000, seed: 7 });
  const flat = name === "Ventricular Fibrillation" || name === "Asystole";
  return (
    <div>
      <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--vn-muted-text)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.4rem" }}>
        Lead II · {name}{flat ? "" : ` · ${hr} bpm`}
      </div>
      <Tracing samples={samples} widthMm={150} heightMm={30} baselineMm={19} pxPerMm={5.4} night={isNightShift} label="II" />
      <div style={{ fontSize: "0.68rem", color: "var(--vn-muted-text)", marginTop: "0.3rem", textAlign: "right" }}>
        25 mm/s · 10 mm/mV · 6 seconds
      </div>
    </div>
  );
}

// 12-lead (or 15-lead) printout: four columns of 2.5 s from one continuous 10 s recording, then a 10 s lead II.
// caption replaces the title line (a printout for students shouldn't name the finding); leadSet '12' or '15' overrides
// which right-hand column prints.
export function TwelveLeadSVG({ ecgType, rhythmInterp, twelveLeadFindings, fifteenLeadFindings, hr, isNightShift, patternKey, caption, leadSet }) {
  const pattern = pickTwelveLeadPattern(ecgType, rhythmInterp, twelveLeadFindings, fifteenLeadFindings, patternKey);
  const p = _TL_PATTERNS[pattern] || _TL_PATTERNS.normal;
  const rhythm = normalizeRhythm(rhythmInterp) || rhythmForPattern(pattern) || "Normal Sinus Rhythm";
  const is15 = leadSet ? leadSet === "15" : ecgType === "15-lead" || pattern === "inferiorRV" || pattern === "posterior";
  const cols = [["I", "II", "III"], ["aVR", "aVL", "aVF"], ["V1", "V2", "V3"], is15 ? ["V4R", "V8", "V9"] : ["V4", "V5", "V6"]];
  const events = rhythmEvents(rhythm, hr, 10000, 11);
  const sinus = /sinus rhythm$|sinus (brady|tachy)cardia/i.test(rhythm) && rhythm !== "Sinus Rhythm with PVCs";
  const title = isRhythmOnlyPattern(pattern) ? `${rhythm}: ${is15 ? "15" : "12"}-Lead` : `${p.title}${sinus ? "" : ` · ${rhythm}`}`;
  const cell = { widthMm: 62.5, heightMm: 34, baselineMm: 21, pxPerMm: 4 };
  const c = palette(isNightShift);
  return (
    <div>
      <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--vn-muted-text)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.5rem" }}>
        {caption || `${title} · ${hr} bpm`}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "2px", background: c.major, border: `1px solid ${c.major}`, borderRadius: 4, overflow: "hidden" }}>
        {[0, 1, 2].map((row) => cols.map((col, ci) => {
          const lead = col[row];
          const samples = sampleLead({ rhythm, hr, lead, patternKey: pattern, startMs: ci * 2500, durationMs: 2500, events, seed: 11 });
          return <Tracing key={lead} samples={samples} {...cell} night={isNightShift} label={lead} strokeWidth={1.1} />;
        }))}
      </div>
      <div style={{ marginTop: "2px", border: `1px solid ${c.major}`, borderRadius: 4, overflow: "hidden" }}>
        <Tracing samples={sampleLead({ rhythm, hr, lead: "II", patternKey: pattern, startMs: 0, durationMs: 10000, events, seed: 11 })}
          widthMm={250} heightMm={34} baselineMm={21} pxPerMm={4} night={isNightShift} label="II" strokeWidth={1.1} />
      </div>
      <div style={{ fontSize: "9px", color: "var(--vn-muted-text)", textAlign: "right", fontFamily: "monospace", marginTop: "3px" }}>
        {is15 ? "V4R · V8 · V9: modified 15-lead positions · " : ""}25 mm/s · 10 mm/mV · 10 s rhythm strip, lead II
      </div>
    </div>
  );
}
