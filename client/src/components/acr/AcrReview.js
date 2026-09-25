import React, { useEffect, useRef, useState } from "react";
import { getAcrConfig, reviewAcr, errorMessage } from "./acrApi";
import "./AcrReview.css";

// While a review runs (an AI review can take most of a minute), say what's happening.
const PROGRESS = ["Reading your chart...", "Running the documentation checks...", "Comparing it with the scenario...", "Writing your feedback..."];
const CODE_KEY = "vn.acrAccessCode";
const readSession = (k) => { try { return window.sessionStorage.getItem(k) || ""; } catch (e) { return ""; } };
const writeSession = (k, v) => { try { window.sessionStorage.setItem(k, v); } catch (e) { /* storage blocked: fine */ } };

const RESOURCES = [
  { href: "/acr/ACR_practice_v3.pdf", label: "Blank Practice ACR", note: "For a lab scenario that didn't come with a pre-filled ACR." },
  { href: "/acr/ACR_model_chest_pain.pdf", label: "Model chart: chest pain", note: "A clean chart with teaching notes in the margin." },
  { href: "/acr/ACR_model_hypoglycemia_refusal.pdf", label: "Model chart: hypoglycemia and refusal", note: "Glucagon, a capacity assessment and a refusal, charted properly." },
  { href: "/acr/ACR_find_the_errors.pdf", label: "Find the errors", note: "A COPD chart with 18 mistakes in it. Find them before you run the checker." },
];

function Evidence({ item }) {
  return (
    <div>
      <span className="acr-ev">{item.evidence}</span>
      {item.evidence_verified === false && <span className="acr-unverified"> not found on your chart, check this one</span>}
    </div>
  );
}

// "Other lab scenario": a call that wasn't generated here and isn't one of the samples, e.g. an instructor's own scenario.
const OTHER_LAB = "other-lab";

function ScenarioLine({ scenario, choice }) {
  if (!scenario && choice === OTHER_LAB) {
    return (
      <p className="acr-muted">
        Other lab scenario: reviewed for documentation only. There's no scenario here to compare your chart with, so talk the
        call itself through with your instructor.
      </p>
    );
  }
  if (!scenario) {
    return (
      <p className="acr-muted">
        No scenario was found in this ACR, so this review covers the documentation only. If the call came from a generated
        scenario, press Practice ACR on that scenario and chart on the ACR it gives you.
      </p>
    );
  }
  const how = scenario.source === "linked" ? "the scenario this ACR was made for" : "the sample scenario";
  return <p className="acr-muted">Compared with {how}: <strong>{scenario.title}</strong>.</p>;
}

function Feedback({ data, onPrint, onRevise, onStartOver }) {
  const f = data.feedback;
  const mode = f.meta && f.meta.mode;
  return (
    <div className="acr-panel">
      {mode === "mock" && <div className="acr-banner">Rule-based feedback only (practice mode). It catches what the rules know about.</div>}
      {mode === "fallback" && <div className="acr-banner">The AI reviewer wasn't available, so this is the rule-based review only. Try again later for the full review.</div>}
      {data.notice && <div className="acr-banner">{data.notice}</div>}
      <ScenarioLine scenario={data.scenario} choice={data.choice} />
      <p className="acr-summary">{f.summary}</p>

      {f.improvement_since_last && f.improvement_since_last.length > 0 && (
        <>
          <div className="acr-k">Since your last version</div>
          <ul className="acr-list">{f.improvement_since_last.map((x) => <li key={x}>{x}</li>)}</ul>
        </>
      )}

      {f.fixes.length > 0 && <div className="acr-k">Fix these first</div>}
      {f.fixes.map((x) => (
        <div key={x.priority} className={`acr-fix${x.priority === 1 ? " acr-fix-first" : ""}`}>
          <h3>{x.priority}. {x.issue}</h3>
          <Evidence item={x} />
          <p><strong>Why it matters:</strong> {x.why_it_matters}</p>
          <p><strong>What to do:</strong> {x.what_to_do}</p>
        </div>
      ))}

      {f.strengths.length > 0 && <div className="acr-k">Keep doing this</div>}
      {f.strengths.map((x) => (
        <div key={x.point} className="acr-strength">{x.point}<Evidence item={x} /></div>
      ))}

      {f.scenario_questions.length > 0 && (
        <>
          <div className="acr-k">Your chart and the scenario</div>
          <ul className="acr-list">{f.scenario_questions.map((q) => <li key={q.question}>{q.question}</li>)}</ul>
        </>
      )}

      {f.question_to_think_about && (
        <>
          <div className="acr-k">Something to think about</div>
          <p className="acr-think">{f.question_to_think_about}</p>
        </>
      )}

      {f.model_sentence && f.model_sentence.offered && f.model_sentence.text && (
        <>
          <div className="acr-k">One example sentence</div>
          <p className="acr-ev acr-block">{f.model_sentence.text}</p>
          <p className="acr-muted">{f.model_sentence.note}</p>
        </>
      )}

      <div className="acr-k">ACR Review rubric{f.meta && f.meta.rubric_total ? ` (${f.meta.rubric_total})` : ""}</div>
      <p className="acr-muted acr-small">This app's own practice rubric. It isn't your program's grade.</p>
      <div className="acr-table-wrap">
        <table className="acr-table">
          <thead><tr><th>Domain</th><th>Score</th><th>Why</th></tr></thead>
          <tbody>
            {f.rubric.map((r) => (
              <tr key={r.domain}>
                <td>{r.domain}</td>
                <td className="acr-score">{r.score === null ? "n/a" : `${r.score} / 7`}</td>
                <td>{r.evidence}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <details className="acr-details">
        <summary>What the checker found ({data.checker.issues.length})</summary>
        {data.checker.issues.length ? (
          <ul className="acr-list">{data.checker.issues.map((i) => <li key={i}>{i}</li>)}</ul>
        ) : <p className="acr-muted">Nothing.</p>}
        <div className="acr-k">Questions it couldn't answer</div>
        <ul className="acr-list">{data.checker.questions.map((q) => <li key={q}>{q}</li>)}</ul>
        <div className="acr-k">Call intervals</div>
        <pre className="acr-pre">{data.checker.intervals}</pre>
      </details>

      {f.instructor_flags && f.instructor_flags.length > 0 && (
        <details className="acr-details">
          <summary>For your instructor ({f.instructor_flags.length})</summary>
          <ul className="acr-list">{f.instructor_flags.map((x) => <li key={x}>{x}</li>)}</ul>
        </details>
      )}

      <div className="acr-actions acr-noprint">
        <button type="button" className="acr-btn acr-btn-secondary" onClick={onPrint}>Print or save this feedback</button>
        <button type="button" className="acr-btn acr-btn-secondary" onClick={onRevise}>Upload a revised version</button>
        <button type="button" className="acr-btn acr-btn-quiet" onClick={onStartOver}>Start over with a different chart</button>
      </div>
      <p className="acr-muted acr-small">Nothing you upload is stored.</p>
    </div>
  );
}

export default function AcrReview() {
  const [config, setConfig] = useState(null);
  const [scenarioId, setScenarioId] = useState("");
  const [file, setFile] = useState(null);
  const [confirmed, setConfirmed] = useState(false);
  const [accessCode, setAccessCode] = useState(() => readSession(CODE_KEY));
  const [progress, setProgress] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [lastFeedback, setLastFeedback] = useState(null);
  const fileInput = useRef(null);
  const resultRef = useRef(null);

  useEffect(() => {
    let alive = true;
    getAcrConfig()
      .then((c) => { if (alive) setConfig(c); })
      .catch(() => { if (alive) setConfig({ mode: "unknown", accessCodeRequired: false, scenarios: [] }); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (status !== "reviewing") return undefined;
    setProgress(0);
    const t = setInterval(() => setProgress((p) => Math.min(p + 1, PROGRESS.length - 1)), 4000);
    return () => clearInterval(t);
  }, [status]);

  useEffect(() => {
    if (result && resultRef.current) resultRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [result]);

  const clearFile = () => {
    setFile(null);
    if (fileInput.current) fileInput.current.value = "";
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!file) { setError("Choose your ACR PDF first."); return; }
    if (!confirmed) { setError("Tick the box to confirm this is a practice chart from a lab scenario."); return; }
    const fd = new FormData();
    fd.append("acr", file);
    fd.append("practiceConfirm", "yes");
    if (scenarioId && scenarioId !== OTHER_LAB) fd.append("scenarioId", scenarioId);
    if (accessCode.trim()) fd.append("accessCode", accessCode.trim());
    if (lastFeedback) fd.append("previousFeedback", JSON.stringify(lastFeedback));
    setStatus("reviewing");
    try {
      const data = await reviewAcr(fd, () => setStatus("waking"));
      if (accessCode.trim()) writeSession(CODE_KEY, accessCode.trim());
      setResult({ ...data, choice: scenarioId });
      setLastFeedback(data.feedback);
    } catch (err) {
      if (err?.response?.status === 403) setConfig((c) => ({ ...(c || {}), accessCodeRequired: true }));
      setError(await errorMessage(err, "The review failed. Try again in a minute."));
    } finally {
      setStatus("idle");
    }
  };

  const revise = () => {
    clearFile();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const startOver = () => {
    clearFile();
    setResult(null);
    setLastFeedback(null);
    setScenarioId("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const printFeedback = () => {
    document.body.classList.add("acr-print");
    window.print();
    setTimeout(() => document.body.classList.remove("acr-print"), 500);
  };

  const busy = status !== "idle";
  const samples = (config && config.scenarios) || [];
  const buttonLabel = status === "waking" ? "Waking the server up..." : status === "reviewing" ? "Reviewing..." : lastFeedback ? "Review my revised ACR" : "Review my ACR";

  return (
    <div className="acr-review">
      <form className="acr-panel acr-noprint" onSubmit={submit}>
        <h2 className="acr-h2">Get feedback on your ACR</h2>
        <ol className="acr-steps">
          <li><b>Get the ACR.</b> On a generated scenario, press Practice ACR. For any other lab call, use the blank ACR at the bottom of this page.</li>
          <li><b>Chart the call</b> in Adobe Acrobat Reader. Press Check my ACR inside the form and fix what it finds.</li>
          <li><b>Upload it here.</b> You get what to fix first, what to keep doing, and questions about your decisions.</li>
          <li><b>Revise and upload again.</b> The review says what you fixed and what's still open.</li>
        </ol>
        {config && config.mode === "mock" && (
          <div className="acr-banner">Practice mode: feedback comes from the rule-based checker only, without the AI reviewer.</div>
        )}

        <label className="acr-label" htmlFor="acr-file">Your ACR (the Practice ACR PDF)</label>
        <div
          className={`acr-drop${dragging ? " acr-drop-over" : ""}${file ? " acr-drop-has" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const f = e.dataTransfer.files && e.dataTransfer.files[0];
            if (!f) return;
            if (!/\.pdf$/i.test(f.name) && f.type !== "application/pdf") { setError("That isn't a PDF. Drop the Practice ACR PDF."); return; }
            setError("");
            setFile(f);
          }}
        >
          <input id="acr-file" ref={fileInput} type="file" accept="application/pdf,.pdf" className="acr-file-input"
            onChange={(e) => setFile(e.target.files && e.target.files[0] ? e.target.files[0] : null)} />
          <span className="acr-drop-text">{file ? file.name : "Drop your PDF here, or click to choose it"}</span>
        </div>

        {config && !lastFeedback && (
          <>
            <label className="acr-label" htmlFor="acr-scenario">Which scenario was this?</label>
            <select id="acr-scenario" className="acr-input" value={scenarioId} onChange={(e) => setScenarioId(e.target.value)}>
              <option value="">Generated scenario (found automatically from the Practice ACR)</option>
              <option value={OTHER_LAB}>Other lab scenario (not generated here, not a sample)</option>
              {samples.map((s) => <option key={s.id} value={s.id} title={s.summary}>Sample: {s.title}</option>)}
            </select>
          </>
        )}

        {config && config.accessCodeRequired && (
          <>
            <label className="acr-label" htmlFor="acr-code">Class access code</label>
            <input id="acr-code" className="acr-input" value={accessCode} autoComplete="off"
              onChange={(e) => setAccessCode(e.target.value)} placeholder="From your instructor" />
          </>
        )}

        <label className="acr-check">
          <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
          <span>This is a practice chart from a lab scenario. It has no real patient information in it. I have not uploaded an ACR from a real call or a placement.</span>
        </label>

        <div className="acr-actions">
          <button type="submit" className="acr-btn" disabled={busy}>{buttonLabel}</button>
        </div>
        <div aria-live="polite">
          {status === "reviewing" && <p className="acr-muted">{PROGRESS[progress]}</p>}
          {status === "waking" && <p className="acr-muted">The server was asleep. It takes up to a minute to wake up the first time.</p>}
          {error && <div className="acr-error">{error}</div>}
        </div>
      </form>

      <div ref={resultRef}>
        {result && <Feedback data={result} onPrint={printFeedback} onRevise={revise} onStartOver={startOver} />}
      </div>

      <div className="acr-panel acr-noprint">
        <h2 className="acr-h2">Practice ACR files</h2>
        <p className="acr-muted">Open them in Adobe Acrobat Reader. The buttons inside the form don't work in a browser or Preview.</p>
        <ul className="acr-resources">
          {RESOURCES.map((r) => (
            <li key={r.href}><a href={r.href} download>{r.label}</a><span className="acr-muted"> {r.note}</span></li>
          ))}
        </ul>
      </div>
    </div>
  );
}
