// 12- and 15-lead printouts on the monitor. Press the button (or the instructor does), the monitor "acquires" for a few
// seconds, then a paper printout slides out of the bottom. Tap it to open it full size and zoom in. The printout shows
// the tracing only, never the finding: reading it is the student's job.
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { TwelveLeadSVG } from "../ecg/EcgViews";

export const ACQUIRE_MS = 8000;
const SHOW_MS = 7000; // a fresh printout stays out this long, then tucks down to a tab so it doesn't cover the traces

function Printout({ print, ecg, patternKey }) {
  const leads = print.leads === "15" ? "15" : "12";
  return (
    <div className="lm-paper">
      <div className="lm-paper-head">
        <strong>{leads}-lead ECG</strong>
        <span>Acquired {print.at}</span>
        <span>HR {print.hr ?? "--"}</span>
        <span>0.05 to 150 Hz</span>
      </div>
      <TwelveLeadSVG
        ecgType={leads === "15" ? "15-lead" : "12-lead"}
        leadSet={leads}
        rhythmInterp={print.rhythm}
        twelveLeadFindings={(ecg && ecg.twelveLeadFindings) || ""}
        fifteenLeadFindings={(ecg && ecg.fifteenLeadFindings) || ""}
        hr={print.hr || 60}
        patternKey={patternKey}
        isNightShift={false}
        caption=" "
      />
    </div>
  );
}

function Viewer({ print, ecg, patternKey, onClose }) {
  const [zoom, setZoom] = useState(1);
  const [size, setSize] = useState({ w: 1000, h: 640 });
  const inner = useRef(null);
  const scroller = useRef(null);
  const drag = useRef(null);

  useEffect(() => {
    if (inner.current) setSize({ w: inner.current.offsetWidth, h: inner.current.offsetHeight });
    // Start at "fit to width"
    if (inner.current && scroller.current) {
      const fit = Math.min(1.6, (scroller.current.clientWidth - 24) / inner.current.offsetWidth);
      setZoom(Math.max(0.4, fit));
    }
  }, []);

  const step = (d) => setZoom((z) => Math.min(4, Math.max(0.4, Math.round((z + d) * 10) / 10)));
  const onWheel = (e) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    step(e.deltaY < 0 ? 0.2 : -0.2);
  };
  const onDown = (e) => {
    if (e.pointerType !== "mouse") return; // touch scrolls and pinches natively
    const el = scroller.current;
    drag.current = { x: e.clientX, y: e.clientY, left: el.scrollLeft, top: el.scrollTop };
    el.setPointerCapture && el.setPointerCapture(e.pointerId);
  };
  const onMove = (e) => {
    if (!drag.current) return;
    const el = scroller.current;
    el.scrollLeft = drag.current.left - (e.clientX - drag.current.x);
    el.scrollTop = drag.current.top - (e.clientY - drag.current.y);
  };
  const onUp = () => {
    drag.current = null;
  };

  return (
    <div className="lm-viewer" role="dialog" aria-modal="true" aria-label={`${print.leads}-lead ECG printout`}>
      <div className="lm-viewer-bar">
        <strong>{print.leads}-lead ECG · {print.at}</strong>
        <div className="lm-viewer-tools">
          <button type="button" onClick={() => step(-0.2)} aria-label="Zoom out">−</button>
          <span className="lm-zoom">{Math.round(zoom * 100)}%</span>
          <button type="button" onClick={() => step(0.2)} aria-label="Zoom in">+</button>
          <button type="button" onClick={() => window.print()}>Print on paper</button>
          <button type="button" onClick={onClose}>Close</button>
        </div>
      </div>
      <div
        className="lm-viewer-scroll"
        ref={scroller}
        onWheel={onWheel}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        <div style={{ width: size.w * zoom, height: size.h * zoom }}>
          <div ref={inner} style={{ transform: `scale(${zoom})`, transformOrigin: "0 0", width: "max-content" }}>
            <Printout print={print} ecg={ecg} patternKey={patternKey} />
          </div>
        </div>
      </div>
      <p className="lm-viewer-hint">Drag to move around. Ctrl + scroll or the buttons to zoom. On an iPad, pinch.</p>
    </div>
  );
}

export default function EcgPrintouts({ prints, ecgOn, onAcquire, ecg, patternKey, buttonsSlot }) {
  const seen = useRef({});
  const [now, setNow] = useState(Date.now());
  const [open, setOpen] = useState(null);
  const [notice, setNotice] = useState("");
  const list = prints || [];

  list.forEach((p) => {
    if (!seen.current[p.id]) seen.current[p.id] = Date.now();
  });
  const latest = list[list.length - 1];
  const acquiring = latest && now - seen.current[latest.id] < ACQUIRE_MS;
  const progress = latest ? Math.min(1, (now - seen.current[latest.id]) / ACQUIRE_MS) : 0;
  const ready = list.filter((p) => now - seen.current[p.id] >= ACQUIRE_MS);

  const age = (p) => now - seen.current[p.id] - ACQUIRE_MS;
  const showing = ready.some((p) => age(p) < SHOW_MS);
  useEffect(() => {
    if (!acquiring && !showing) return undefined;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [acquiring, showing]);
  useEffect(() => {
    setNow(Date.now());
  }, [list.length]);

  const press = (leads) => {
    if (!ecgOn) {
      setNotice("Attach the ECG leads first.");
      setTimeout(() => setNotice(""), 2500);
      return;
    }
    if (acquiring) return;
    if (onAcquire) onAcquire(leads);
  };

  const openPrint = open !== null ? list.find((p) => p.id === open) : null;

  // The buttons sit in the monitor's top bar, clear of the traces and the numbers.
  const buttons = (
    <div className="lm-ecg-buttons">
      {notice && <span className="lm-ecg-notice">{notice}</span>}
      <button type="button" onClick={() => press("12")} disabled={!onAcquire || acquiring}>12-lead</button>
      <button type="button" onClick={() => press("15")} disabled={!onAcquire || acquiring}>15-lead</button>
    </div>
  );

  return (
    <>
      {buttonsSlot ? createPortal(buttons, buttonsSlot) : buttons}
      {acquiring && (
        <div className="lm-acquiring" role="status">
          <strong>Acquiring {latest.leads}-lead. Patient still, please.</strong>
          <div className="lm-acquire-bar"><div style={{ width: `${Math.round(progress * 100)}%` }} /></div>
        </div>
      )}
      {ready.length > 0 && (
        <div className="lm-tray">
          {ready.map((p) => {
            const fresh = age(p) < SHOW_MS;
            return (
              <button
                type="button"
                key={p.id}
                className={`lm-slip${fresh ? " lm-slip--new" : " lm-slip--tab"}`}
                onClick={() => setOpen(p.id)}
                aria-label={`Open the ${p.leads}-lead from ${p.at}`}
              >
                {fresh && (
                  <span className="lm-slip-thumb" aria-hidden="true">
                    <span className="lm-slip-scale">
                      <Printout print={p} ecg={ecg} patternKey={patternKey} />
                    </span>
                  </span>
                )}
                <span className="lm-slip-label">{p.leads}-lead · {p.at}{fresh ? "" : " · tap to open"}</span>
              </button>
            );
          })}
        </div>
      )}
      {openPrint && <Viewer print={openPrint} ecg={ecg} patternKey={patternKey} onClose={() => setOpen(null)} />}
    </>
  );
}
