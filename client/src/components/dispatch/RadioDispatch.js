// Radio dispatch practice: the call is read aloud over radio static, once, the way a crew actually gets it.
// The student writes what they caught, then checks it against the transcript. Speech and static are made in the
// browser, so it costs nothing and nothing leaves the device. Voices vary by device.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { buildDispatch, checkCatch } from "./dispatchScript";
import "./dispatch.css";

const canSpeak = () => typeof window !== "undefined" && "speechSynthesis" in window && typeof window.SpeechSynthesisUtterance !== "undefined";

function pickVoice() {
  const voices = window.speechSynthesis.getVoices() || [];
  const by = (re) => voices.find((v) => re.test(v.lang));
  return by(/^en-CA/i) || by(/^en-US/i) || by(/^en-GB/i) || by(/^en/i) || null;
}

// Hiss under the voice, with a squelch burst at the start and end of the transmission.
function makeRadio() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  const ctx = new AC();
  const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const band = ctx.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = 1900;
  band.Q.value = 0.8;
  const gain = ctx.createGain();
  gain.gain.value = 0;
  src.connect(band).connect(gain).connect(ctx.destination);
  src.start();
  const at = (level, secs = 0) => {
    const t = ctx.currentTime + secs;
    gain.gain.cancelScheduledValues(t);
    gain.gain.setValueAtTime(level, t);
  };
  return {
    open() {
      at(0.32);
      at(0.035, 0.22);
    },
    close() {
      at(0.3);
      at(0, 0.18);
    },
    stop() {
      try {
        src.stop();
        ctx.close();
      } catch (e) {
        /* already stopped */
      }
    },
    resume() {
      return ctx.resume ? ctx.resume() : Promise.resolve();
    },
  };
}

export default function RadioDispatch({ scenario, environment, onClose }) {
  const dispatch = useMemo(() => buildDispatch(scenario, environment), [scenario, environment]);
  const [status, setStatus] = useState("idle"); // idle | playing | done
  const [plays, setPlays] = useState(0);
  const [staticOn, setStaticOn] = useState(true);
  const [written, setWritten] = useState("");
  const [results, setResults] = useState(null);
  const [showText, setShowText] = useState(false);
  const radio = useRef(null);
  const speakable = canSpeak();

  useEffect(() => {
    if (speakable) window.speechSynthesis.getVoices();
    return () => {
      if (speakable) window.speechSynthesis.cancel();
      if (radio.current) radio.current.stop();
    };
  }, [speakable]);

  const play = async () => {
    if (!speakable) return;
    window.speechSynthesis.cancel();
    if (staticOn) {
      if (!radio.current) radio.current = makeRadio();
      if (radio.current) {
        await radio.current.resume();
        radio.current.open();
      }
    }
    const u = new window.SpeechSynthesisUtterance(dispatch.speech);
    const v = pickVoice();
    if (v) u.voice = v;
    u.lang = (v && v.lang) || "en-CA";
    u.rate = 1.07;
    u.pitch = 0.95;
    const finish = () => {
      if (radio.current && staticOn) radio.current.close();
      setStatus("done");
    };
    u.onend = finish;
    u.onerror = finish;
    setStatus("playing");
    setPlays((n) => n + 1);
    // A short beat after the squelch, like someone keying the mic.
    setTimeout(() => window.speechSynthesis.speak(u), staticOn ? 350 : 0);
  };

  const check = () => {
    setResults(checkCatch(dispatch, written));
    setShowText(true);
  };

  const required = results ? results.filter((r) => !r.optional) : [];
  const caught = required.filter((r) => r.caught).length;

  return (
    <div className="rd-overlay" role="dialog" aria-modal="true" aria-label="Radio dispatch">
      <div className="rd-card">
        <div className="rd-head">
          <div>
            <p className="rd-eyebrow">Dispatch</p>
            <h2 className="rd-title">Listen once, like the real thing.</h2>
          </div>
          <button type="button" className="rd-btn rd-btn--ghost" onClick={onClose}>Close</button>
        </div>

        {speakable ? (
          <div className="rd-player">
            <button type="button" className={`rd-play${status === "playing" ? " rd-play--on" : ""}`} onClick={play}
              disabled={status === "playing"} aria-label={plays ? "Play the dispatch again" : "Play the dispatch"}>
              <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
            </button>
            <div className="rd-player-text">
              <strong>{status === "playing" ? "Dispatch on the air..." : plays ? "Play again" : "Play the dispatch"}</strong>
              <span>{plays > 1 ? `Played ${plays} times. On a real call you'd ask for a repeat.` : "Have something to write on first."}</span>
              <label className="rd-toggle">
                <input type="checkbox" checked={staticOn} onChange={(e) => setStaticOn(e.target.checked)} /> Radio static
              </label>
            </div>
          </div>
        ) : (
          <p className="rd-note">This browser can't read aloud. Have a partner read the transcript to you, then write what you caught.</p>
        )}

        <label className="rd-label" htmlFor="rd-written">What did you catch? Write it the way you'd jot it on your glove.</label>
        <textarea id="rd-written" className="rd-text" rows={4} value={written} onChange={(e) => setWritten(e.target.value)}
          placeholder="Priority, address, age and sex, why they called, anything to be careful of" />
        <div className="rd-row">
          <button type="button" className="rd-btn" onClick={check} disabled={!written.trim()}>Check what I caught</button>
          {!showText && (
            <button type="button" className="rd-btn rd-btn--ghost" onClick={() => setShowText(true)}>Show the transcript</button>
          )}
        </div>

        {results && (
          <div className="rd-results" aria-live="polite">
            <p className="rd-score">You caught {caught} of {required.length} key details.</p>
            <ul>
              {results.map((r, k) => (
                <li key={k} className={r.caught ? "rd-hit" : r.optional ? "rd-miss-soft" : "rd-miss"}>
                  <span className="rd-mark" aria-hidden="true">{r.caught ? "✓" : r.optional ? "·" : "✗"}</span>
                  <span>{r.label}{r.optional ? <em> (useful, not essential)</em> : null}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {showText && (
          <div className="rd-transcript">
            <p className="rd-eyebrow">Transcript</p>
            <p>"{dispatch.text}"</p>
            <p className="rd-note">The address is made up for practice. The rest comes from the scenario's call information.</p>
          </div>
        )}
      </div>
    </div>
  );
}
