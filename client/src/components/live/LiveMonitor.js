// The student-facing monitor for the Monitor screen. Opens in its own window (#live-monitor) for a second screen or an iPad's
// Split View, or sits beside the instructor's controls in the same window. Numbers ease toward each new set the way a
// real monitor trends; nothing shows for a sensor the crew hasn't attached, and the BP only changes when it's cycled.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { isRhythmOnlyPattern, normalizeRhythm, sampleLead } from "../ecg/ecgEngine";
import { openLiveChannel, readLiveState } from "./liveChannel";
import "./live.css";

const COLORS = { ecg: "#3ee07a", pleth: "#43c6e8", co2: "#f5d547", nibp: "#e8ecef" };
const SWEEP_MS = 6000; // screen width in time, like a 25 mm/s strip

// Pleth and capnography shapes, one cycle each, phase 0..1 -> 0..1
const plethAt = (p) => (p < 0.12 ? Math.pow(p / 0.12, 1.4) : Math.exp(-(p - 0.12) * 4.2) * 0.92 + 0.14 * Math.exp(-((p - 0.42) ** 2) / 0.003));
const co2At = (p) => {
  if (p < 0.06) return 0;
  if (p < 0.12) return (p - 0.06) / 0.06;
  if (p < 0.5) return 0.94 + (p - 0.12) * 0.15;
  if (p < 0.56) return Math.max(0, 1 - (p - 0.5) / 0.06);
  return 0;
};

function Trace({ kind, params, height }) {
  const ref = useRef(null);
  const live = useRef(params);
  live.current = params;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext("2d");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let W = 0;
    let H = 0;
    const size = () => {
      const r = canvas.getBoundingClientRect();
      W = Math.max(50, Math.floor(r.width * dpr));
      H = Math.max(20, Math.floor(r.height * dpr));
      canvas.width = W;
      canvas.height = H;
      ctx.fillStyle = "#0b1419";
      ctx.fillRect(0, 0, W, H);
    };
    size();
    const onResize = () => size();
    window.addEventListener("resize", onResize);

    let x = 0;
    let T = 0;
    let lastY = null;
    let last = performance.now();
    let raf = 0;

    const valueAt = (t) => {
      const p = live.current;
      if (!p || !p.on) return null;
      if (kind === "ecg") {
        const s = p.samples;
        if (!s || !s.length) return H * 0.55;
        const i = Math.floor((((t % p.duration) + p.duration) % p.duration) / 4) % s.length;
        const v = s[i] ? s[i][1] : 0;
        return H * 0.58 - v * (H / 3.2);
      }
      if (kind === "pleth") {
        if (!p.rate) return H * 0.82;
        const period = 60000 / p.rate;
        return H * 0.85 - plethAt((t % period) / period) * H * 0.7 * p.amp;
      }
      if (!p.rate) return H * 0.85;
      const period = 60000 / p.rate;
      return H * 0.88 - co2At((t % period) / period) * H * 0.75 * p.amp;
    };

    const frame = (now) => {
      const dt = Math.max(0, Math.min(100, now - last)); // rAF can report a time just before `last`
      last = now;
      const pxPerMs = W / SWEEP_MS;
      const steps = Math.max(1, Math.ceil(dt * pxPerMs));
      ctx.lineWidth = 2.2 * dpr;
      ctx.lineJoin = "round";
      ctx.strokeStyle = COLORS[kind];
      for (let k = 0; k < steps; k++) {
        const nx = x + (dt * pxPerMs) / steps;
        T += dt / steps;
        const y = valueAt(T);
        // erase a little ahead of the sweep
        ctx.fillStyle = "#0b1419";
        ctx.fillRect(Math.floor(nx) + 1, 0, 14 * dpr, H);
        if (nx >= W) {
          x = 0;
          lastY = null;
          continue;
        }
        if (y !== null && lastY !== null) {
          ctx.beginPath();
          ctx.moveTo(x, lastY);
          ctx.lineTo(nx, y);
          ctx.stroke();
        }
        lastY = y;
        x = nx;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, [kind]);

  return <canvas ref={ref} className="lm-trace" style={{ height }} aria-hidden="true" />;
}

// A number that eases toward its target instead of jumping.
function useEased(target, perSecond) {
  const [value, setValue] = useState(target);
  const targetRef = useRef(target);
  targetRef.current = target;
  useEffect(() => {
    const id = setInterval(() => {
      setValue((v) => {
        const t = targetRef.current;
        if (t === null || t === undefined) return t;
        if (v === null || v === undefined) return t;
        if (Math.abs(t - v) <= perSecond / 2) return t;
        return v + Math.sign(t - v) * (perSecond / 2);
      });
    }, 500);
    return () => clearInterval(id);
  }, [perSecond]);
  return value;
}

const round = (v) => (v === null || v === undefined ? null : Math.round(v));

function MonitorFace({ state }) {
  const set = state.set || {};
  const att = state.attached || {};
  const rhythm = normalizeRhythm(set.rhythm) || "Normal Sinus Rhythm";
  const hr = set.noPulse && /fibrillation|asystole/i.test(rhythm) ? null : set.hr;
  const shapeKey = state.patternKey && !isRhythmOnlyPattern(state.patternKey) ? state.patternKey : "";
  const ecgRate = Math.max(20, Math.min(220, set.hr || 60));

  const samples = useMemo(() => {
    try {
      return sampleLead({ rhythm, hr: ecgRate, lead: "II", patternKey: shapeKey, durationMs: 12000, step: 4, seed: 7 });
    } catch (e) {
      return [];
    }
  }, [rhythm, ecgRate, shapeKey]);

  const eHr = round(useEased(hr, 6));
  const eSpo2 = round(useEased(set.spo2, 2));
  const eCo2 = round(useEased(set.etco2, 2));
  const eRr = round(useEased(set.rr, 2));
  const perfusionAmp = set.noPulse ? 0 : set.sys && set.sys < 90 ? 0.45 : 0.85;

  const alarm = {
    hr: att.ecg && eHr !== null && (eHr < 50 || eHr > 130),
    spo2: att.spo2 && eSpo2 !== null && eSpo2 < 90,
    co2: att.etco2 && eCo2 !== null && (eCo2 > 50 || eCo2 < 30),
  };

  const cell = (key, label, value, unit, sub, on, isAlarm) => (
    <div className={`lm-num lm-num--${key}${isAlarm ? " lm-alarm" : ""}`}>
      <div className="lm-num-label">{label}</div>
      <div className="lm-num-value">
        {on && value !== null && value !== undefined ? value : "---"}
        <span className="lm-num-unit">{unit}</span>
      </div>
      <div className="lm-num-sub">{on ? sub : "not connected"}</div>
    </div>
  );

  return (
    <div className="lm-face">
      <div className="lm-traces">
        <div className="lm-trace-label" style={{ color: COLORS.ecg }}>II {att.ecg ? "" : "· leads off"}</div>
        <Trace kind="ecg" height="34%" params={{ on: !!att.ecg, samples, duration: 12000 }} />
        <div className="lm-trace-label" style={{ color: COLORS.pleth }}>Pleth {att.spo2 ? "" : "· probe off"}</div>
        <Trace kind="pleth" height="24%" params={{ on: !!att.spo2, rate: set.noPulse ? 0 : set.hr, amp: perfusionAmp }} />
        <div className="lm-trace-label" style={{ color: COLORS.co2 }}>CO2 {att.etco2 ? "" : "· not connected"}</div>
        <Trace kind="co2" height="24%" params={{ on: !!att.etco2, rate: set.rr || 0, amp: Math.max(0.15, Math.min(1, (set.etco2 || 0) / 60)) }} />
        <div className="lm-footer">
          {state.reveal && state.reveal.bgl && set.bgl !== null && <span>BGL {set.bgl} mmol/L</span>}
          {state.reveal && state.reveal.temp && set.temp !== null && <span>Temp {set.temp} °C</span>}
        </div>
      </div>
      <div className="lm-nums">
        {cell("hr", "HR", eHr, "bpm", rhythm, !!att.ecg, alarm.hr)}
        {cell("spo2", "SpO2", eSpo2, "%", "", !!att.spo2, alarm.spo2)}
        {cell("co2", "EtCO2", eCo2, "mmHg", eRr !== null ? `awRR ${eRr}` : "", !!att.etco2, alarm.co2)}
        {cell("nibp", "NIBP", state.nibp ? `${state.nibp.sys}/${state.nibp.dia}` : null, "mmHg",
          state.nibp ? `taken at ${state.nibp.at}` : "not taken yet", true, false)}
      </div>
    </div>
  );
}

// state: pass it to embed the monitor beside the controls; leave it out to listen for the instructor's window.
export default function LiveMonitor({ state: embeddedState, embedded = false }) {
  const [remote, setRemote] = useState(() => (embedded ? null : readLiveState()));

  useEffect(() => {
    if (embedded) return undefined;
    const ch = openLiveChannel((msg) => {
      if (msg && msg.type === "state") setRemote(msg.state);
    });
    ch.post({ type: "hello" });
    const beat = setInterval(() => ch.post({ type: "here" }), 3000);
    return () => {
      clearInterval(beat);
      ch.close();
    };
  }, [embedded]);

  const state = embedded ? embeddedState : remote;
  const [full, setFull] = useState(false);
  const canFull = !embedded && typeof document !== "undefined" && document.fullscreenEnabled;
  const toggleFull = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen().then(() => setFull(true)).catch(() => {});
    else document.exitFullscreen().then(() => setFull(false)).catch(() => {});
  };

  return (
    <div className={`lm-root${embedded ? " lm-embedded" : ""}`}>
      <div className="lm-topbar">
        <span className="lm-top-title">Patient monitor</span>
        <span>{state && !state.ended ? `Adult · ${state.running ? "running" : "paused"} · ${state.clock || "00:00"}` : ""}</span>
        {canFull && (
          <button type="button" className="lm-full-btn" onClick={toggleFull}>
            {full ? "Exit full screen" : "Full screen"}
          </button>
        )}
      </div>
      {!state || state.ended ? (
        <div className="lm-waiting">
          <p className="lm-waiting-title">{state && state.ended ? "The monitor screen was closed." : "Waiting for the instructor."}</p>
          <p>
            On the instructor's screen, open a scenario, press <strong>Monitor screen</strong>, then <strong>Pop out the monitor</strong>.
            This window updates on its own.
          </p>
        </div>
      ) : (
        <MonitorFace state={state} />
      )}
    </div>
  );
}
