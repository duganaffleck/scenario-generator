// Case variants: same decision, different patient. The variant keeps what the scenario is testing (the practice
// target) and changes the patient, the setting and whatever looks reassuring at first. From VitalNotes, From
// Scenario to Practice Target: change the diagnosis, keep the decision problem.
import React, { useEffect, useRef, useState } from "react";
import "../dispatch/dispatch.css";
import "./variant.css";

const firstSentences = (text, n) => {
  const parts = String(text || "").replace(/\s+/g, " ").trim().match(/[^.!?]+[.!?]+/g) || [];
  return parts.slice(0, n).join(" ").trim() || String(text || "").slice(0, 300);
};

// The first learning objective is usually the decision the case was built around. The instructor can rewrite it.
export function suggestedTarget(scenario) {
  const s = scenario || {};
  const lo = Array.isArray(s.learningObjectives) ? s.learningObjectives.find((x) => typeof x === "string" && x.trim()) : "";
  if (lo) return lo.trim();
  return firstSentences(s.clinicalReasoning && s.clinicalReasoning.summary, 1);
}

// What the server needs to know about the original: a short description, never the whole scenario.
export function describeForVariant(scenario, target, harder) {
  const s = scenario || {};
  const d = s.patientDemographics || {};
  const age = String(d.age || "").match(/\d+/);
  const patient = [age ? `${age[0]}-year-old` : "", String(d.sex || "").toLowerCase()].filter(Boolean).join(" ");
  const setting = [(s.callInformation && s.callInformation.location) || "", d.chiefComplaint ? `chief complaint: ${d.chiefComplaint}` : ""]
    .filter(Boolean)
    .join("; ");
  return {
    title: s.title || "",
    target: String(target || "").trim().slice(0, 300),
    summary: firstSentences(s.clinicalReasoning && s.clinicalReasoning.summary, 2).slice(0, 700),
    patient,
    setting: setting.slice(0, 240),
    harder: { distractor: !!harder.distractor, laterCue: !!harder.laterCue },
  };
}

export default function VariantDialog({ scenario, pressuredNow, onMake, onClose }) {
  const [target, setTarget] = useState(() => suggestedTarget(scenario));
  const [distractor, setDistractor] = useState(false);
  const [laterCue, setLaterCue] = useState(false);
  const [pressured, setPressured] = useState(!!pressuredNow);
  const field = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  // Focus the decision once on open, close on Escape, and hand focus back to the button that opened it.
  useEffect(() => {
    const opener = document.activeElement;
    if (field.current) field.current.focus();
    const onKey = (e) => {
      if (e.key === "Escape") closeRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (opener && typeof opener.focus === "function" && document.contains(opener)) opener.focus();
    };
  }, []);

  const ready = target.trim().length >= 12;
  const make = () => {
    if (!ready) return;
    onMake({ variantOf: describeForVariant(scenario, target, { distractor, laterCue }), pressured });
  };

  return (
    <div className="rd-overlay" role="dialog" aria-modal="true" aria-labelledby="cv-title">
      <div className="rd-card cv-card">
        <div className="rd-head">
          <div>
            <p className="rd-eyebrow">Case variant</p>
            <h2 className="rd-title" id="cv-title">Same decision, different patient</h2>
          </div>
          <button type="button" className="rd-btn rd-btn--ghost" onClick={onClose}>Close</button>
        </div>
        <p className="cv-note">
          A new case that puts the crew in front of the same decision as <strong>{scenario.title || "this scenario"}</strong>,
          with a different patient, setting and story. Same semester, call type and complexity. This scenario stays in your
          recent list.
        </p>
        <label className="rd-label" htmlFor="cv-target">Keep this decision</label>
        <textarea
          id="cv-target"
          ref={field}
          className="rd-text"
          rows={3}
          maxLength={300}
          value={target}
          onChange={(e) => setTarget(e.target.value)}
        />
        <p className="cv-hint">Taken from the first learning objective. Rewrite it as the one decision you want practised again.</p>
        <fieldset className="cv-harder">
          <legend className="rd-label">Make it harder (optional)</legend>
          <label><input type="checkbox" checked={distractor} onChange={(e) => setDistractor(e.target.checked)} /> Add one believable distractor</label>
          <label><input type="checkbox" checked={laterCue} onChange={(e) => setLaterCue(e.target.checked)} /> Move the key cue later in the call</label>
          <label><input type="checkbox" checked={pressured} onChange={(e) => setPressured(e.target.checked)} /> Pressured scene</label>
        </fieldset>
        <div className="cv-actions">
          <button type="button" className="rd-btn" onClick={make} disabled={!ready}>Make the variant</button>
        </div>
      </div>
    </div>
  );
}
