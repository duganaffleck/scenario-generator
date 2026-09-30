// Monitor screen: the instructor's controls for running a generated scenario in lab. Each vitals set in the scenario becomes
// a button; press the one that matches what the crew did and the monitor moves there. The monitor opens in its own
// window (drag it to the TV, or beside this one on an iPad) or sits next to these controls in split view.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import LiveMonitor from "./LiveMonitor";
import { MONITOR_HASH, openLiveChannel, saveLiveState } from "./liveChannel";
import { clock, progressionNotes, vitalSets } from "./liveModel";
import "./live.css";

const MONITOR_FEATURES = "popup=yes,width=1100,height=720";

export default function LiveRun({ scenario, studentMode, onClose }) {
  const sets = useMemo(() => vitalSets(scenario), [scenario]);
  const notes = useMemo(() => progressionNotes(scenario), [scenario]);
  const [confirmed, setConfirmed] = useState(!studentMode);
  const [current, setCurrent] = useState(0);
  const [attached, setAttached] = useState({ ecg: false, spo2: false, etco2: false });
  const [nibp, setNibp] = useState(null);
  const [reveal, setReveal] = useState({ bgl: false, temp: false });
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [log, setLog] = useState([]);
  const [split, setSplit] = useState(false);
  const [monitorSeen, setMonitorSeen] = useState(0);
  const [popupBlocked, setPopupBlocked] = useState(false);
  const [prints, setPrints] = useState([]);
  const startedAt = useRef(null);
  const channel = useRef(null);

  // Timer
  useEffect(() => {
    if (!running) return undefined;
    startedAt.current = Date.now() - elapsed;
    const id = setInterval(() => setElapsed(Date.now() - startedAt.current), 500);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  const set = useMemo(() => sets[current] || {}, [sets, current]);
  const monitorState = useMemo(
    () => ({
      v: 1,
      running,
      clock: clock(elapsed),
      set: {
        hr: set.hr, rr: set.rr, spo2: set.spo2, etco2: set.etco2, rhythm: set.rhythm, noPulse: set.noPulse,
        sys: set.sys, dia: set.dia, bgl: set.bgl, temp: set.temp,
      },
      attached,
      nibp,
      reveal,
      patternKey: (scenario && scenario.ecgFindings && scenario.ecgFindings.patternKey) || "",
      ecg: {
        twelveLeadFindings: (scenario && scenario.ecgFindings && scenario.ecgFindings.twelveLeadFindings) || "",
        fifteenLeadFindings: (scenario && scenario.ecgFindings && scenario.ecgFindings.fifteenLeadFindings) || "",
      },
      prints,
      ended: false,
    }),
    [running, elapsed, set, attached, nibp, reveal, scenario, prints]
  );
  const stateRef = useRef(monitorState);
  stateRef.current = monitorState;

  // Channel to the monitor window
  useEffect(() => {
    if (!confirmed) return undefined;
    const ch = openLiveChannel((msg) => {
      if (!msg) return;
      if (msg.type === "hello" || msg.type === "here") setMonitorSeen(Date.now());
      if (msg.type === "hello") ch.post({ type: "state", state: stateRef.current });
      if (msg.type === "acquire" && acquireRef.current) acquireRef.current(msg.leads === "15" ? "15" : "12");
    });
    channel.current = ch;
    return () => {
      const ended = { ...stateRef.current, ended: true };
      ch.post({ type: "state", state: ended });
      saveLiveState(ended);
      ch.close();
      channel.current = null;
    };
  }, [confirmed]);

  useEffect(() => {
    if (!confirmed || !channel.current) return;
    channel.current.post({ type: "state", state: monitorState });
    saveLiveState(monitorState);
  }, [monitorState, confirmed]);

  const addLog = useCallback((what) => setLog((l) => [{ t: clock(startedAt.current ? Date.now() - startedAt.current : 0), what }, ...l].slice(0, 30)), []);

  const goTo = (i) => {
    setCurrent(i);
    if (!running) setRunning(true);
    addLog(sets[i].label);
  };
  const toggle = (key, label) => {
    const on = !attached[key];
    setAttached({ ...attached, [key]: on });
    addLog(`${label} ${on ? "on" : "off"}`);
  };
  const cycleBp = () => {
    if (set.sys === null || set.sys === undefined) return;
    const at = clock(elapsed);
    setNibp({ sys: set.sys, dia: set.dia, at });
    addLog(`NIBP ${set.sys}/${set.dia}`);
  };
  const showReading = (key, label, value) => {
    setReveal((r) => ({ ...r, [key]: true }));
    addLog(`${label} ${value}`);
  };
  const openMonitor = () => {
    const url = `${window.location.origin}${window.location.pathname}${MONITOR_HASH}`;
    const w = window.open(url, "vn-live-monitor", MONITOR_FEATURES);
    setPopupBlocked(!w);
    if (w) channel.current && channel.current.post({ type: "state", state: stateRef.current });
  };
  // A 12- or 15-lead, from this panel or from the monitor itself. It prints the patient as they are right now.
  const acquire = (leads) => {
    if (!attached.ecg) setAttached((a) => ({ ...a, ecg: true }));
    setPrints((p) => [...p, { id: Date.now(), leads, at: clock(elapsed), hr: set.hr, rhythm: set.rhythm }].slice(-4));
    addLog(`${leads}-lead acquired`);
  };
  const acquireRef = useRef(null);
  acquireRef.current = acquire;

  const reset = () => {
    setRunning(false);
    setElapsed(0);
    startedAt.current = null;
    setCurrent(0);
    setAttached({ ecg: false, spo2: false, etco2: false });
    setNibp(null);
    setReveal({ bgl: false, temp: false });
    setLog([]);
    setPrints([]);
  };

  const connected = Date.now() - monitorSeen < 7000;
  const hasCo2 = sets.some((s) => s.etco2 !== null);

  if (!confirmed) {
    return (
      <div className="lr-overlay" role="dialog" aria-modal="true" aria-label="Monitor screen">
        <div className="lr-gate">
          <p className="lr-eyebrow">Monitor screen</p>
          <h2>This is the instructor's screen.</h2>
          <p>It shows every set of vitals and how the call can unfold. If you're the one running the scenario, carry on.</p>
          <div className="lr-row">
            <button type="button" className="lr-btn" onClick={() => setConfirmed(true)}>I'm running it</button>
            <button type="button" className="lr-btn lr-btn--ghost" onClick={onClose}>Go back</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`lr-overlay${split ? " lr-overlay--split" : ""}`} role="dialog" aria-modal="true" aria-label="Monitor screen">
      <div className="lr-panel">
        <header className="lr-head">
          <div>
            <p className="lr-eyebrow">Monitor screen · instructor controls</p>
            <h2 className="lr-title">{scenario.title || "Scenario"}</h2>
          </div>
          <div className="lr-clock" aria-live="off">{clock(elapsed)}</div>
          <div className="lr-row">
            <button type="button" className="lr-btn" onClick={() => setRunning((r) => !r)}>{running ? "Pause" : elapsed ? "Resume" : "Start"}</button>
            <button type="button" className="lr-btn lr-btn--ghost" onClick={reset}>Reset</button>
            <button type="button" className="lr-btn lr-btn--ghost" onClick={onClose}>Close</button>
          </div>
        </header>

        <section className="lr-card">
          <div className="lr-row lr-row--between">
            <h3 className="lr-h3">Monitor</h3>
            <span className={`lr-status${connected ? " lr-status--on" : ""}`}>{connected ? "Pop-out monitor connected" : split ? "Showing beside the controls" : "Monitor not open yet"}</span>
          </div>
          <div className="lr-row">
            <button type="button" className="lr-btn" onClick={openMonitor}>Pop out the monitor</button>
            <button type="button" className="lr-btn lr-btn--ghost" aria-pressed={split} onClick={() => setSplit((s) => !s)}>
              {split ? "Hide the monitor" : "Show the monitor beside these"}
            </button>
          </div>
          {popupBlocked && <p className="lr-warn">Your browser blocked the window. Allow pop-ups for this site, or show the monitor beside these controls.</p>}
          <p className="lr-hint">
            Two screens (laptop and TV): pop it out and drag the window to the TV. One screen or an iPad: show it beside
            these controls. On an iPad you can also pop it out and drag its tab to the side of the screen to split it.
          </p>
        </section>

        <section className="lr-card">
          <h3 className="lr-h3">What the crew has attached</h3>
          <div className="lr-row">
            <button type="button" className={`lr-chip${attached.ecg ? " lr-chip--on" : ""}`} aria-pressed={attached.ecg} onClick={() => toggle("ecg", "ECG leads")}>ECG leads</button>
            <button type="button" className={`lr-chip${attached.spo2 ? " lr-chip--on" : ""}`} aria-pressed={attached.spo2} onClick={() => toggle("spo2", "SpO2 probe")}>SpO2 probe</button>
            {hasCo2 && (
              <button type="button" className={`lr-chip${attached.etco2 ? " lr-chip--on" : ""}`} aria-pressed={attached.etco2} onClick={() => toggle("etco2", "EtCO2")}>EtCO2</button>
            )}
            <button type="button" className="lr-chip" onClick={cycleBp} disabled={set.sys === null || set.sys === undefined}>Cycle the BP</button>
            <button type="button" className="lr-chip" onClick={() => acquire("12")}>Print 12-lead</button>
            <button type="button" className="lr-chip" onClick={() => acquire("15")}>Print 15-lead</button>
            {set.bgl !== null && set.bgl !== undefined && (
              <button type="button" className="lr-chip" onClick={() => showReading("bgl", "BGL", set.bgl)}>Show glucose</button>
            )}
            {set.temp !== null && set.temp !== undefined && (
              <button type="button" className="lr-chip" onClick={() => showReading("temp", "Temp", set.temp)}>Show temp</button>
            )}
          </div>
        </section>

        <section className="lr-card">
          <h3 className="lr-h3">Where the call is now</h3>
          <div className="lr-sets">
            {sets.map((s) => (
              <button
                key={s.i}
                type="button"
                className={`lr-set${s.i === current ? " lr-set--on" : ""}${s.branch ? " lr-set--branch" : ""}`}
                aria-pressed={s.i === current}
                onClick={() => goTo(s.i)}
              >
                <span className="lr-set-tag">{s.branch ? "If care goes wrong" : `Set ${s.i + 1}`}</span>
                <span className="lr-set-label">{s.label}</span>
                <span className="lr-set-sum">
                  HR {s.hr ?? "-"} · RR {s.rr ?? "-"} · SpO2 {s.spo2 ?? "-"} · BP {s.bp || "-"}
                </span>
              </button>
            ))}
          </div>
          <dl className="lr-now">
            <div><dt>HR</dt><dd>{set.hrText || "-"}</dd></div>
            <div><dt>RR</dt><dd>{set.rrText || "-"}</dd></div>
            <div><dt>BP</dt><dd>{set.bp || "-"}</dd></div>
            <div><dt>SpO2</dt><dd>{set.spo2 ?? "-"}</dd></div>
            <div><dt>EtCO2</dt><dd>{set.etco2 ?? "-"}</dd></div>
            <div><dt>GCS</dt><dd>{set.gcs ?? "-"}</dd></div>
            <div><dt>BGL</dt><dd>{set.bgl ?? "-"}</dd></div>
            <div><dt>Rhythm</dt><dd>{set.rhythm || "-"}</dd></div>
          </dl>
          <p className="lr-hint">GCS and anything they have to assess by hand, say out loud when they check it.</p>
        </section>

        {notes.length > 0 && (
          <details className="lr-card">
            <summary className="lr-h3">How the patient responds</summary>
            {notes.map(([title, items]) => (
              <div key={title} className="lr-notes">
                <p className="lr-notes-title">{title}</p>
                <ul>{items.map((t, k) => <li key={k}>{t}</li>)}</ul>
              </div>
            ))}
          </details>
        )}

        <section className="lr-card">
          <h3 className="lr-h3">Log</h3>
          {log.length === 0 ? (
            <p className="lr-hint">Everything you press is logged here with the time, for the debrief.</p>
          ) : (
            <ol className="lr-log">
              {log.map((e, k) => (
                <li key={k}><span className="lr-log-t">{e.t}</span> {e.what}</li>
              ))}
            </ol>
          )}
        </section>
      </div>
      {split && (
        <div className="lr-split-monitor">
          <LiveMonitor embedded state={monitorState} onAcquire={(leads) => acquire(leads)} />
        </div>
      )}
    </div>
  );
}
