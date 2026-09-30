// Triage report practice. Say the report you'd give the triage nurse (or type it), and it's checked against your own
// chart: numbers that don't match, what's missing, whether you gave the trend, and whether it fit in a minute.
import React, { useEffect, useRef, useState } from "react";
import { checkTriageReport, errorMessage } from "./acrApi";

const LIMIT_S = 60; // what the nurse gives you
const HARD_STOP_S = 120;

const ICONS = {
  ok: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  conflict: <path d="M6 6l12 12M18 6L6 18" />,
  missing: <path d="M6 6l12 12M18 6L6 18" />,
  note: (
    <>
      <path d="M12 4l9 16H3z" />
      <path d="M12 10v4M12 17.5v.01" />
    </>
  ),
};
const LABEL = { ok: "Fine", conflict: "Doesn't match your chart", missing: "Missing", note: "Worth a look" };

function pickMime() {
  if (typeof MediaRecorder === "undefined" || !MediaRecorder.isTypeSupported) return "";
  return ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"].find((t) => MediaRecorder.isTypeSupported(t)) || "";
}
const clockOf = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export default function TriageReport({ file, confirmed, accessCode, canRecord }) {
  const [mode, setMode] = useState(canRecord ? "speak" : "type");
  const [phase, setPhase] = useState("idle"); // idle | starting | recording | checking | waking
  const [seconds, setSeconds] = useState(0);
  const [typed, setTyped] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const rec = useRef(null);
  const chunks = useRef([]);
  const started = useRef(0);
  const stream = useRef(null);

  // The server's settings arrive after the first render; recording becomes the default once it's allowed.
  useEffect(() => {
    setMode(canRecord ? "speak" : "type");
  }, [canRecord]);

  useEffect(() => {
    if (phase !== "recording") return undefined;
    const t = setInterval(() => {
      const s = (Date.now() - started.current) / 1000;
      setSeconds(s);
      if (s >= HARD_STOP_S && rec.current && rec.current.state === "recording") rec.current.stop();
    }, 200);
    return () => clearInterval(t);
  }, [phase]);

  // Let go of the microphone if the page goes away mid-recording.
  useEffect(() => () => {
    if (stream.current) stream.current.getTracks().forEach((tr) => tr.stop());
  }, []);

  const ready = () => {
    if (!file) return "Choose your ACR above first. The report is checked against it.";
    if (!confirmed) return "Tick the practice-chart box above first.";
    return "";
  };

  const send = async (extra) => {
    setPhase("checking");
    setError("");
    const fd = new FormData();
    fd.append("acr", file);
    fd.append("practiceConfirm", "yes");
    if (accessCode && accessCode.trim()) fd.append("accessCode", accessCode.trim());
    Object.entries(extra).forEach(([k, v]) => fd.append(k, v));
    try {
      setResult(await checkTriageReport(fd, () => setPhase("waking")));
    } catch (err) {
      setError(await errorMessage(err, "The check failed. Try again in a minute."));
    } finally {
      setPhase("idle");
    }
  };

  const start = async () => {
    const problem = ready();
    if (problem) { setError(problem); return; }
    if (phase !== "idle") return;
    setError("");
    setResult(null);
    setPhase("starting");
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      setPhase("idle");
      setError("The microphone isn't available. Allow it for this site, or type your report instead.");
      return;
    }
    const mimeType = pickMime();
    const r = new MediaRecorder(stream.current, mimeType ? { mimeType } : undefined);
    chunks.current = [];
    r.ondataavailable = (e) => { if (e.data && e.data.size) chunks.current.push(e.data); };
    r.onstop = () => {
      const duration = (Date.now() - started.current) / 1000;
      if (stream.current) stream.current.getTracks().forEach((tr) => tr.stop());
      stream.current = null;
      const type = r.mimeType || mimeType || "audio/webm";
      const blob = new Blob(chunks.current, { type });
      const ext = /mp4/.test(type) ? "m4a" : /ogg/.test(type) ? "ogg" : "webm";
      if (duration < 2 || blob.size < 1000) { setPhase("idle"); setError("That was too short to check. Press the button and give the whole report."); return; }
      send({ audio: new File([blob], `report.${ext}`, { type }), durationSec: String(Math.round(duration)) });
    };
    rec.current = r;
    started.current = Date.now();
    setSeconds(0);
    r.start(1000);
    setPhase("recording");
  };

  const stop = () => {
    if (rec.current && rec.current.state === "recording") rec.current.stop();
  };

  const checkTyped = () => {
    const problem = ready() || (typed.trim().length < 20 ? "Type the whole report first, the way you'd say it." : "");
    if (problem) { setError(problem); return; }
    setResult(null);
    send({ transcript: typed });
  };

  const over = seconds > LIMIT_S;
  const busy = phase === "checking" || phase === "waking" || phase === "starting";
  const locked = busy || phase === "recording";

  return (
    <div className="acr-panel acr-noprint tr-panel">
      <h2 className="acr-h2">Triage report practice</h2>
      <p className="acr-muted">
        The triage nurse has a minute. Give your report the way you would at the desk, then see it checked against your own
        chart: numbers that don't match, what's missing, whether you gave the trend.
      </p>

      {canRecord && (
        <div className="tr-tabs" role="tablist" aria-label="How to give the report">
          <button type="button" role="tab" aria-selected={mode === "speak"} className={`tr-tab${mode === "speak" ? " tr-tab-on" : ""}`} onClick={() => setMode("speak")} disabled={locked}>Say it</button>
          <button type="button" role="tab" aria-selected={mode === "type"} className={`tr-tab${mode === "type" ? " tr-tab-on" : ""}`} onClick={() => setMode("type")} disabled={locked}>Type it</button>
        </div>
      )}

      {mode === "speak" && canRecord ? (
        <div className="tr-record">
          <button
            type="button"
            className={`tr-mic${phase === "recording" ? " tr-mic-on" : ""}`}
            onClick={phase === "recording" ? stop : start}
            disabled={busy}
            aria-label={phase === "recording" ? "Stop and check my report" : "Start recording my report"}
          >
            {phase === "recording" ? (
              <svg width="30" height="30" viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" /></svg>
            ) : (
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0014 0M12 18v3" /></svg>
            )}
          </button>
          <div className="tr-timer">
            <div className={`tr-clock${over ? " tr-over" : ""}`} aria-live="off">{clockOf(seconds)}</div>
            <div className="tr-bar"><div className={over ? "tr-over-bg" : ""} style={{ width: `${Math.min(100, (seconds / LIMIT_S) * 100)}%` }} /></div>
            <div className="acr-muted acr-small">
              {phase === "recording" ? "Recording. Press the square when you're done." : "Press the microphone and start talking. 1:00 is the limit."}
            </div>
          </div>
          <p className="acr-muted acr-small tr-privacy">
            Your recording goes to this app's server and to OpenAI to be turned into text, and isn't kept here. Practice calls only,
            never a real patient.
          </p>
        </div>
      ) : (
        <div className="tr-typed">
          <label className="acr-label" htmlFor="tr-text">Your report, the way you'd say it</label>
          <textarea id="tr-text" className="acr-input tr-textarea" rows={5} value={typed} maxLength={4000}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="This is Farah, she's 78. Staff found her very drowsy at a community centre..." />
          <div className="acr-actions">
            <button type="button" className="acr-btn" onClick={checkTyped} disabled={busy}>Check my report</button>
          </div>
          {!canRecord && <p className="acr-muted acr-small">Recording isn't available here, so type it. The length is estimated from your words.</p>}
        </div>
      )}

      <div aria-live="polite">
        {phase === "checking" && <p className="acr-muted">Checking it against your chart...</p>}
        {phase === "waking" && <p className="acr-muted">The server was asleep. It takes up to a minute to wake up the first time.</p>}
        {error && <div className="acr-error">{error}</div>}
      </div>

      {result && (
        <div className="tr-result">
          <div className="tr-said">
            <div className="acr-k">{result.source === "audio" ? "What you said" : "What you typed"}</div>
            <p>{result.transcript}</p>
          </div>
          <div className="tr-checks">
            <div className="acr-k">Checked against your chart</div>
            <ul className="tr-list">
              {result.items.map((it, k) => (
                <li key={k} className={`tr-item tr-${it.status}`}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONS[it.status]}</svg>
                  <div>
                    <span className="tr-sr">{LABEL[it.status]}: </span>
                    {it.title}
                    {it.detail && <div className="acr-muted acr-small">{it.detail}</div>}
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div className="acr-actions">
            <button type="button" className="acr-btn acr-btn-secondary" onClick={() => { setResult(null); setSeconds(0); }}>Try it again</button>
          </div>
        </div>
      )}
    </div>
  );
}
