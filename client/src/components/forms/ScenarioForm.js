import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import jsPDF from "jspdf";
import { FaSpinner, FaFilePdf, FaMoon, FaSun, FaUndoAlt } from "react-icons/fa";

// Simple confetti effect (no external lib)
function Confetti() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const W = window.innerWidth;
    const H = window.innerHeight;
    canvas.width = W;
    canvas.height = H;
    let confetti = Array.from({ length: 150 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H - H,
      r: Math.random() * 6 + 4,
      d: Math.random() * 50 + 50,
      color: `hsl(${Math.random() * 360}, 80%, 60%)`,
      tilt: Math.random() * 10 - 10,
      tiltAngle: 0,
    }));
    let angle = 0;
    let animationFrame;
    function draw() {
      ctx.clearRect(0, 0, W, H);
      confetti.forEach(c => {
        ctx.beginPath();
        ctx.ellipse(c.x, c.y, c.r, c.r/2, c.tilt, 0, 2 * Math.PI);
        ctx.fillStyle = c.color;
        ctx.fill();
      });
      update();
      animationFrame = requestAnimationFrame(draw);
    }
    function update() {
      angle += 0.01;
      confetti.forEach(c => {
        c.y += (Math.cos(angle + c.d) + 1 + c.r / 2) * 1.2;
        c.x += Math.sin(angle) * 2;
        c.tiltAngle += 0.1;
        c.tilt = Math.sin(c.tiltAngle) * 15;
        if (c.y > H) {
          c.x = Math.random() * W;
          c.y = -10;
        }
      });
    }
    draw();
    return () => cancelAnimationFrame(animationFrame);
  }, []);
  return (
    <canvas ref={canvasRef} style={{position:'fixed',top:0,left:0,width:'100vw',height:'100vh',pointerEvents:'none',zIndex:30000}} />
  );
}

function FlashOverlay({onEnd}) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    let flashes = 0;
    const interval = setInterval(() => {
      setVisible(v => !v);
      flashes++;
      if (flashes > 30) { // triple the flashes
        clearInterval(interval);
        onEnd && onEnd();
      }
    }, 150);
    return () => clearInterval(interval);
  }, [onEnd]);
  return visible ? (
    <div style={{position:'fixed',top:0,left:0,width:'100vw',height:'100vh',background:'rgba(255,255,0,0.4)',zIndex:29999,pointerEvents:'none'}} />
  ) : null;
}

// eslint-disable-next-line no-unused-vars
const ecgImageMap = {
  "Normal Sinus Rhythm": "/ecg/NSR.jpg",
  "Sinus Bradycardia": "/ecg/sinusbrad.jpeg",
  "Sinus Tachycardia": "/ecg/sinustach.jpg",
  "Atrial Fibrillation": "/ecg/afib.jpg",
  "Atrial Flutter": "/ecg/atrialflutter.jpg",
  SVT: "/ecg/SVT.jpg",
  "Ventricular Tachycardia": "/ecg/vtach.jpg",
  "Ventricular Fibrillation": "/ecg/vfib.jpg",
  Asystole: "/ecg/asystole.jpeg",
  "Pulseless Electrical Activity": "/ecg/sinusbrad.jpeg",
  "First Degree AV Block": "/ecg/firstdegree.jpg",
  "Second Degree AV Block Type I": "/ecg/secondegree1.jpg",
  "Second Degree AV Block Type II": "/ecg/seconddegree2.jpg",
  "Third Degree AV Block": "/ecg/thirddegree.jpg",
};

// ── ECG SVG Rhythm Strip Generator ──────────────────────────────────────────
function parseECGHR(hrStr) {
  if (!hrStr) return 75;
  const n = parseInt(String(hrStr).replace(/[^0-9]/g, ''));
  return isNaN(n) || n < 20 || n > 300 ? 75 : n;
}
function _seededRand(seed) {
  let s = seed >>> 0;
  return function () { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}
const _ECG_W = 800, _ECG_H = 120, _ECG_BASELINE = 82;
const _ECG_PX_MS = _ECG_W / 6000, _ECG_MV = 28, _ECG_TOTAL = 6000;
function _pt(ms, mv) { return [ms * _ECG_PX_MS, _ECG_BASELINE - mv * _ECG_MV]; }
function _ptsToD(pts) { return pts.map((p, i) => (i === 0 ? 'M' : 'L') + p[0].toFixed(2) + ' ' + p[1].toFixed(2)).join(' '); }
function _sinusBeat(t, opts) {
  const {
    prInterval = 160, pAmp = 0.15, rAmp = 1.0,
    qDepth = 0.08, sDepth = 0.15, tAmp = 0.3,
    stElev = 0, showP = true, wideQRS = false,
    tFlat = false
  } = opts;
  const pts = [];
  if (showP) {
    pts.push(_pt(t, 0));
    pts.push(_pt(t + 20, pAmp * 0.5));
    pts.push(_pt(t + 40, pAmp));
    pts.push(_pt(t + 60, pAmp * 0.5));
    pts.push(_pt(t + 80, 0));
    pts.push(_pt(t + prInterval - 5, 0));
  } else {
    pts.push(_pt(t, 0));
    pts.push(_pt(t + prInterval - 5, 0));
  }
  const qs = t + prInterval;
  if (wideQRS) {
    pts.push(_pt(qs, 0));
    pts.push(_pt(qs + 15, -qDepth * 1.5));
    pts.push(_pt(qs + 30, rAmp * 0.6));
    pts.push(_pt(qs + 50, rAmp * 0.85));
    pts.push(_pt(qs + 70, rAmp * 0.4));
    pts.push(_pt(qs + 95, -sDepth * 2.2));
    pts.push(_pt(qs + 130, stElev));
    pts.push(_pt(qs + 200, stElev));
    pts.push(_pt(qs + 260, tFlat ? stElev * 0.3 : tAmp * 0.5 + stElev));
    pts.push(_pt(qs + 330, tFlat ? stElev * 0.1 : tAmp + stElev));
    pts.push(_pt(qs + 400, 0));
  } else {
    pts.push(_pt(qs, 0));
    pts.push(_pt(qs + 8, -qDepth));
    pts.push(_pt(qs + 20, rAmp));
    pts.push(_pt(qs + 32, -sDepth));
    pts.push(_pt(qs + 50, stElev));
    pts.push(_pt(qs + 100, stElev));
    pts.push(_pt(qs + 155, tFlat ? stElev * 0.2 : tAmp * 0.8 + stElev));
    pts.push(_pt(qs + 200, tFlat ? 0 : tAmp + stElev));
    pts.push(_pt(qs + 250, tFlat ? 0 : tAmp * 0.25 + stElev));
    pts.push(_pt(qs + 280, 0));
  }
  return pts;
}

function _buildSinus(rr, opts = {}) {
  const pts = [_pt(0, 0)];
  let t = 40;
  while (t + rr < _ECG_TOTAL + rr * 0.5) {
    _sinusBeat(t, opts).forEach(p => pts.push(p));
    t += rr;
  }
  pts.push(_pt(_ECG_TOTAL, 0));
  return pts;
}

function _buildAFib(rr) {
  const rand = _seededRand(rr);
  const pts = [_pt(0, 0)];
  let t = 40, lastMs = 0;
  const vrr = rr * 0.5;
  function fibLine(start, end) {
    for (let ms = start; ms < end; ms += 14) {
      const fibAmp = (rand() - 0.5) * 0.14;
      pts.push(_pt(ms, fibAmp));
    }
  }
  while (t < _ECG_TOTAL - rr * 0.3) {
    const thisRR = rr + (rand() - 0.5) * vrr * 2;
    fibLine(lastMs, t - 10);
    pts.push(_pt(t, 0));
    pts.push(_pt(t + 8, -0.08));
    pts.push(_pt(t + 20, 1.0));
    pts.push(_pt(t + 32, -0.14));
    pts.push(_pt(t + 50, 0));
    pts.push(_pt(t + 100, 0));
    pts.push(_pt(t + 155, 0.22));
    pts.push(_pt(t + 205, 0.08));
    pts.push(_pt(t + 230, 0));
    lastMs = t + 230;
    t += Math.max(220, thisRR);
  }
  fibLine(lastMs, _ECG_TOTAL);
  pts.push(_pt(_ECG_TOTAL, 0));
  return pts;
}

function _buildFlutter(rr) {
  const pts = [_pt(0, 0)];
  const flutterRR = 200;
  const ratio = Math.max(2, Math.round(rr / flutterRR));
  let fms = 0, beatCount = 0;
  while (fms < _ECG_TOTAL) {
    const cycEnd = fms + flutterRR;
    pts.push(_pt(fms, 0));
    pts.push(_pt(fms + flutterRR * 0.15, -0.22));
    pts.push(_pt(fms + flutterRR * 0.35, -0.04));
    pts.push(_pt(fms + flutterRR * 0.5, -0.18));
    pts.push(_pt(fms + flutterRR * 0.65, 0.08));
    pts.push(_pt(fms + flutterRR * 0.85, -0.05));
    beatCount++;
    if (beatCount % ratio === 0) {
      const qs = fms + flutterRR * 0.4;
      pts.push(_pt(qs, 0));
      pts.push(_pt(qs + 8, -0.08));
      pts.push(_pt(qs + 20, 1.0));
      pts.push(_pt(qs + 32, -0.14));
      pts.push(_pt(qs + 52, 0));
      pts.push(_pt(qs + 100, 0));
      pts.push(_pt(qs + 150, 0.18));
      pts.push(_pt(qs + 200, 0));
    }
    fms = cycEnd;
  }
  pts.push(_pt(_ECG_TOTAL, 0));
  return pts;
}

function _buildVTach(rr) {
  const rand = _seededRand(rr + 7);
  const pts = [_pt(0, 0)];
  let t = 20;
  const pRate = Math.round(60000 / 72);
  let pTime = 60;
  while (t < _ECG_TOTAL - rr * 0.3) {
    while (pTime < t - 20 && pTime < _ECG_TOTAL) {
      pts.push(_pt(pTime, 0));
      pts.push(_pt(pTime + 15, 0.07));
      pts.push(_pt(pTime + 30, 0.09));
      pts.push(_pt(pTime + 45, 0.07));
      pts.push(_pt(pTime + 60, 0));
      pTime += pRate;
    }
    const slur = 0.08 + rand() * 0.04;
    pts.push(_pt(t, 0));
    pts.push(_pt(t + 25, -0.18));
    pts.push(_pt(t + 50, 0.3 + slur));
    pts.push(_pt(t + 75, 1.1));
    pts.push(_pt(t + 95, 0.85));
    pts.push(_pt(t + 115, -0.4));
    pts.push(_pt(t + 140, -0.5));
    pts.push(_pt(t + 165, -0.32));
    pts.push(_pt(t + 185, -0.10));
    pts.push(_pt(t + 200, 0));
    t += rr;
  }
  pts.push(_pt(_ECG_TOTAL, 0));
  return pts;
}

function _buildVFib() {
  const rand = _seededRand(42);
  const pts = [_pt(0, 0)];
  let lastAmp = 0;
  for (let ms = 0; ms <= _ECG_TOTAL; ms += 10) {
    const phase = ms / _ECG_TOTAL;
    const maxAmp = (0.8 + rand() * 0.5) * (1 - phase * 0.45);
    const target = (rand() - 0.48) * maxAmp * 2;
    lastAmp = lastAmp * 0.6 + target * 0.4;
    pts.push(_pt(ms, lastAmp));
  }
  pts.push(_pt(_ECG_TOTAL, 0));
  return pts;
}

function _buildAsystole() {
  const rand = _seededRand(99);
  const pts = [_pt(0, 0)];
  for (let ms = 0; ms <= _ECG_TOTAL; ms += 30) {
    pts.push(_pt(ms, (rand() - 0.5) * 0.04));
  }
  pts.push(_pt(_ECG_TOTAL, 0));
  return pts;
}

function _buildMobitzI(rr) {
  const pts = [_pt(0, 0)];
  let t = 40, pr = 140;
  while (t < _ECG_TOTAL - rr) {
    if (pr > 340) {
      pts.push(_pt(t, 0));
      pts.push(_pt(t + 20, 0.07));
      pts.push(_pt(t + 40, 0.14));
      pts.push(_pt(t + 60, 0.07));
      pts.push(_pt(t + 80, 0));
      pts.push(_pt(t + rr * 0.6, 0));
      pr = 140;
    } else {
      _sinusBeat(t, { prInterval: pr, pAmp: 0.14, rAmp: 1.0, qDepth: 0.08, sDepth: 0.14, tAmp: 0.28 }).forEach(p => pts.push(p));
      pr += 60;
    }
    t += rr;
  }
  pts.push(_pt(_ECG_TOTAL, 0));
  return pts;
}

function _buildMobitzII(rr) {
  const pts = [_pt(0, 0)];
  let t = 40, beatNum = 0;
  while (t < _ECG_TOTAL - rr) {
    beatNum++;
    if (beatNum % 3 === 0) {
      pts.push(_pt(t, 0));
      pts.push(_pt(t + 20, 0.07));
      pts.push(_pt(t + 40, 0.14));
      pts.push(_pt(t + 60, 0.07));
      pts.push(_pt(t + 80, 0));
      pts.push(_pt(t + rr * 0.5, 0));
    } else {
      _sinusBeat(t, { prInterval: 180, pAmp: 0.14, rAmp: 1.0, qDepth: 0.08, sDepth: 0.14, tAmp: 0.28 }).forEach(p => pts.push(p));
    }
    t += rr;
  }
  pts.push(_pt(_ECG_TOTAL, 0));
  return pts;
}

function _buildThirdDegree() {
  const pts = [_pt(0, 0)];
  const pRR = Math.round(60000 / 72);
  const escRR = Math.round(60000 / 38);
  let pTime = 30, escTime = 200;
  while (pTime < _ECG_TOTAL || escTime < _ECG_TOTAL) {
    if (pTime <= escTime && pTime < _ECG_TOTAL) {
      pts.push(_pt(pTime, 0));
      pts.push(_pt(pTime + 15, 0.07));
      pts.push(_pt(pTime + 35, 0.13));
      pts.push(_pt(pTime + 55, 0.07));
      pts.push(_pt(pTime + 75, 0));
      pTime += pRR;
    } else if (escTime < _ECG_TOTAL) {
      pts.push(_pt(escTime, 0));
      pts.push(_pt(escTime + 20, -0.10));
      pts.push(_pt(escTime + 45, 0.75));
      pts.push(_pt(escTime + 65, 0.60));
      pts.push(_pt(escTime + 85, -0.22));
      pts.push(_pt(escTime + 115, -0.28));
      pts.push(_pt(escTime + 155, 0));
      pts.push(_pt(escTime + 210, 0.20));
      pts.push(_pt(escTime + 270, 0.08));
      pts.push(_pt(escTime + 300, 0));
      escTime += escRR;
    } else break;
  }
  pts.push(_pt(_ECG_TOTAL, 0));
  return pts;
}

function _buildECGStrip(rhythm, hr) {
  const rr = Math.round(60000 / Math.max(20, Math.min(280, hr || 75)));
  const isTach = hr > 100;
  // eslint-disable-next-line no-unused-vars
  const isBrad = hr < 60;
  switch (rhythm) {
    case 'Normal Sinus Rhythm':
      return _buildSinus(rr, { pAmp: 0.15, rAmp: 1.0, qDepth: 0.08, sDepth: 0.14, tAmp: 0.30, prInterval: 160 });
    case 'Sinus Tachycardia':
      return _buildSinus(rr, { pAmp: 0.16, rAmp: 1.0, qDepth: 0.07, sDepth: 0.13, tAmp: 0.24, prInterval: 150, tFlat: isTach && hr > 140 });
    case 'Sinus Bradycardia':
      return _buildSinus(rr, { pAmp: 0.16, rAmp: 1.0, qDepth: 0.09, sDepth: 0.14, tAmp: 0.36, prInterval: 170 });
    case 'Atrial Fibrillation':
      return _buildAFib(rr);
    case 'Atrial Flutter':
      return _buildFlutter(rr);
    case 'SVT':
      return _buildSinus(rr, { showP: false, prInterval: 60, rAmp: 0.92, qDepth: 0.05, sDepth: 0.09, tAmp: 0.18 });
    case 'Ventricular Tachycardia':
      return _buildVTach(rr);
    case 'Ventricular Fibrillation':
      return _buildVFib();
    case 'Asystole':
      return _buildAsystole();
    case 'Pulseless Electrical Activity':
      return _buildSinus(rr, { prInterval: 180, rAmp: 0.55, pAmp: 0.10, tAmp: 0.13, qDepth: 0.05, sDepth: 0.10 });
    case 'First Degree AV Block':
      return _buildSinus(rr, { prInterval: 240, pAmp: 0.15, rAmp: 1.0, qDepth: 0.08, sDepth: 0.14, tAmp: 0.30 });
    case 'Second Degree AV Block Type I':
      return _buildMobitzI(rr);
    case 'Second Degree AV Block Type II':
      return _buildMobitzII(rr);
    case 'Third Degree AV Block':
      return _buildThirdDegree();
    default:
      return _buildSinus(rr, {});
  }
}
function RhythmStripSVG({ rhythm, hr, isNightShift }) {
  const pts = _buildECGStrip(rhythm, hr);
  const pathD = _ptsToD(pts);
  const gridC = isNightShift ? '#3a1a1a' : '#ffcccc';
  const heavyC = isNightShift ? '#6a2828' : '#ff9999';
  const bgC = isNightShift ? '#1a0a0a' : '#fff8f8';
  const waveC = isNightShift ? '#00e87a' : '#111111';
  const vLines = [];
  for (let ms = 0; ms <= 6000; ms += 40) {
    const lx = (ms * _ECG_PX_MS).toFixed(2);
    const heavy = ms % 200 === 0;
    vLines.push(<line key={'v' + ms} x1={lx} y1="0" x2={lx} y2={_ECG_H} stroke={heavy ? heavyC : gridC} strokeWidth={heavy ? 0.9 : 0.4} />);
  }
  const hLines = [];
  for (let step = -5; step <= 15; step++) {
    const ly = (_ECG_BASELINE - step * 0.1 * _ECG_MV).toFixed(2);
    if (parseFloat(ly) >= -2 && parseFloat(ly) <= _ECG_H + 2) {
      const heavy = step % 5 === 0;
      hLines.push(<line key={'h' + step} x1="0" y1={ly} x2={_ECG_W} y2={ly} stroke={heavy ? heavyC : gridC} strokeWidth={heavy ? 0.9 : 0.4} />);
    }
  }
  return (
    <div>
      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--vn-muted-text)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.4rem' }}>
        Lead II — {rhythm} — {hr} bpm
      </div>
      <svg viewBox={`0 0 ${_ECG_W} ${_ECG_H}`} style={{ width: '100%', display: 'block', borderRadius: '6px' }} preserveAspectRatio="none">
        <rect width={_ECG_W} height={_ECG_H} fill={bgC} />
        {vLines}
        {hLines}
        <path d={pathD} stroke={waveC} strokeWidth="1.5" fill="none" strokeLinejoin="round" />
      </svg>
      <div style={{ fontSize: '0.68rem', color: 'var(--vn-muted-text)', marginTop: '0.3rem', textAlign: 'right' }}>
        25 mm/s · 10 mm/mV · Lead II
      </div>
    </div>
  );
}
function pickTwelveLeadPattern(ecgType, rhythmInterp, twelveLeadFindings, fifteenLeadFindings) {
  const txt = ((twelveLeadFindings || '') + ' ' + (rhythmInterp || '')).toLowerCase().replace(/\s*-\s*/g, ' ');
  if (ecgType === '15-lead' || fifteenLeadFindings) {
    if (txt.includes('posterior')) return 'posterior';
    return 'inferiorRV';
  }
  if (txt.includes('wellens') || txt.includes('lad warning') || txt.includes('biphasic t') || (txt.includes('t wave inversion') && (txt.includes('v2') || txt.includes('v3')))) return 'wellens';
  if (txt.includes('de winter') || txt.includes('winter t') || txt.includes('upsloping st depression') || txt.includes('upward sloping st depression')) return 'deWinter';
  if (txt.includes('pericarditis') || txt.includes('saddle') || txt.includes('pr depression')) return 'pericarditis';
  if (txt.includes('hyperkal') || (txt.includes('peaked t') && txt.includes('potassium'))) return 'hyperkalemia';
  if (txt.includes('inferolateral')) return 'inferolateralSTEMI';
  if (txt.includes('high lateral') || (txt.includes('diagonal') && txt.includes('stemi')) || (txt.includes('avl') && (txt.includes('elevation in i') || txt.includes('in i and avl') || txt.includes('leads i and avl') || txt.includes('i, avl')))) return 'highLateralSTEMI';
  if (txt.includes('left bundle') || txt.includes('lbbb')) return 'lbbb';
  if (txt.includes('right bundle') || txt.includes('rbbb')) return 'rbbb';
  if (txt.includes('anterior') && (txt.includes('stemi') || txt.includes('elevation') || txt.includes('v1') || txt.includes('v2') || txt.includes('v3') || txt.includes('v4'))) return 'anteriorSTEMI';
  if (txt.includes('lateral') && (txt.includes('stemi') || txt.includes('elevation'))) return 'lateralSTEMI';
  if (txt.includes('inferior') && (txt.includes('stemi') || txt.includes('elevation'))) return 'inferiorSTEMI';
  if (txt.includes('flutter')) return 'atrialFlutter12';
  if (txt.includes('fibrillation') || txt.includes('afib') || txt.includes('a-fib')) return 'afib12';
  if (txt.includes('supraventricular') || txt.includes('svt')) return 'svt12';
  if (txt.includes('ventricular tach') || txt.includes('vtach') || txt.includes('v-tach')) return 'vtach12';
  return 'normal';
}

const _TL_W = 200, _TL_H = 40, _TL_BL = 28, _TL_PX = _TL_W / 2400, _TL_MV = 10, _TL_TOTAL = 2400;
function _tlPt(ms, mv) { return [ms * _TL_PX, _TL_BL - mv * _TL_MV]; }
function _tlD(pts) { return pts.map((p, i) => (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' '); }

function _tlSinusBeat(t, opts) {
  const { pr = 160, pA = 0.15, rA = 1.0, qD = 0.08, sD = 0.15, tA = 0.3, st = 0, noP = false, wide = false, flip = false, pFlip = false } = opts;
  const s = flip ? -1 : 1; const ps = pFlip ? -1 : 1;
  const pts = [];
  if (!noP) {
    pts.push(_tlPt(t, 0)); pts.push(_tlPt(t + 20, ps * pA * 0.5)); pts.push(_tlPt(t + 40, ps * pA));
    pts.push(_tlPt(t + 60, ps * pA * 0.5)); pts.push(_tlPt(t + 80, 0)); pts.push(_tlPt(t + pr - 5, 0));
  } else { pts.push(_tlPt(t, 0)); pts.push(_tlPt(t + pr - 5, 0)); }
  const qs = t + pr;
  if (wide) {
    pts.push(_tlPt(qs, 0)); pts.push(_tlPt(qs + 15, s * -qD * 2)); pts.push(_tlPt(qs + 40, s * rA * 0.5));
    pts.push(_tlPt(qs + 70, s * rA * 0.9)); pts.push(_tlPt(qs + 100, s * -sD * 2.5)); pts.push(_tlPt(qs + 140, s * st));
    pts.push(_tlPt(qs + 220, s * st)); pts.push(_tlPt(qs + 280, s * tA * 0.5 + s * st));
    pts.push(_tlPt(qs + 340, s * tA + s * st)); pts.push(_tlPt(qs + 400, s * tA * 0.2)); pts.push(_tlPt(qs + 440, 0));
  } else {
    pts.push(_tlPt(qs, 0)); pts.push(_tlPt(qs + 10, s * -qD)); pts.push(_tlPt(qs + 22, s * rA));
    pts.push(_tlPt(qs + 35, s * -sD)); pts.push(_tlPt(qs + 55, s * st)); pts.push(_tlPt(qs + 110, s * st));
    pts.push(_tlPt(qs + 170, s * tA + s * st)); pts.push(_tlPt(qs + 230, s * tA * 0.3 + s * st)); pts.push(_tlPt(qs + 270, 0));
  }
  return pts;
}

function _tlBuildFlutter(rr, opts) {
  const pts = [_tlPt(0, 0)];
  const flutterRR = 200;
  const ratio = Math.max(2, Math.round(rr / flutterRR));
  let fms = 0, beatCount = 0;
  const { rA = 1, sD = 0.14, tA = 0.22, flip = false } = opts;
  const s = flip ? -1 : 1;
  while (fms < _TL_TOTAL) {
    pts.push(_tlPt(fms, 0));
    pts.push(_tlPt(fms + flutterRR * 0.15, -0.20));
    pts.push(_tlPt(fms + flutterRR * 0.35, -0.04));
    pts.push(_tlPt(fms + flutterRR * 0.5, -0.16));
    pts.push(_tlPt(fms + flutterRR * 0.65, 0.06));
    pts.push(_tlPt(fms + flutterRR * 0.85, -0.04));
    beatCount++;
    if (beatCount % ratio === 0) {
      const qs = fms + flutterRR * 0.4;
      pts.push(_tlPt(qs, 0));
      pts.push(_tlPt(qs + 8, s * -0.07));
      pts.push(_tlPt(qs + 20, s * rA));
      pts.push(_tlPt(qs + 32, s * -sD));
      pts.push(_tlPt(qs + 50, 0));
      pts.push(_tlPt(qs + 100, 0));
      pts.push(_tlPt(qs + 150, s * tA));
      pts.push(_tlPt(qs + 195, 0));
    }
    fms += flutterRR;
  }
  pts.push(_tlPt(_TL_TOTAL, 0));
  return pts;
}
function _tlBuildLead(rr, opts) {
  const pts = [_tlPt(0, 0)]; let t = 30;
  while (t + rr < _TL_TOTAL + rr * 0.5) { _tlSinusBeat(t, opts).forEach(p => pts.push(p)); t += rr; }
  pts.push(_tlPt(_TL_TOTAL, 0)); return pts;
}

function _tlBuildAFib(rr, seed, opts) {
  const rand = _seededRand(seed); const pts = [_tlPt(0, 0)]; let t = 30, last = 0;
  const vr = rr * 0.4;
  while (t < _TL_TOTAL - rr * 0.3) {
    const tr = rr + (rand() - 0.5) * vr * 2;
    for (let ms = last; ms < t; ms += 18) pts.push(_tlPt(ms, (rand() - 0.5) * 0.06));
    const { rA = 1, sD = 0.15, tA = 0.3, st = 0, flip = false } = opts;
    const s = flip ? -1 : 1; const qs = t;
    pts.push(_tlPt(qs, 0)); pts.push(_tlPt(qs + 10, s * -0.07)); pts.push(_tlPt(qs + 22, s * rA));
    pts.push(_tlPt(qs + 35, s * -sD)); pts.push(_tlPt(qs + 55, s * st)); pts.push(_tlPt(qs + 110, s * st));
    pts.push(_tlPt(qs + 170, s * tA + s * st)); pts.push(_tlPt(qs + 230, s * tA * 0.3)); pts.push(_tlPt(qs + 270, 0));
    last = qs + 270; t += Math.max(280, tr);
  }
  for (let ms = last; ms < _TL_TOTAL; ms += 18) pts.push(_tlPt(ms, (rand() - 0.5) * 0.06));
  pts.push(_tlPt(_TL_TOTAL, 0)); return pts;
}

function _tlBuildVTach(rr, opts) {
  const { rA = 1.1, flip = false } = opts; const s = flip ? -1 : 1;
  const pts = [_tlPt(0, 0)]; let t = 20;
  while (t < _TL_TOTAL - rr * 0.3) {
    pts.push(_tlPt(t, 0)); pts.push(_tlPt(t + 20, s * -0.15)); pts.push(_tlPt(t + 40, s * rA));
    pts.push(_tlPt(t + 55, s * rA * 0.85)); pts.push(_tlPt(t + 70, s * -0.35)); pts.push(_tlPt(t + 90, s * -0.1));
    pts.push(_tlPt(t + 130, s * -0.25)); pts.push(_tlPt(t + 160, 0)); t += rr;
  }
  pts.push(_tlPt(_TL_TOTAL, 0)); return pts;
}

// eslint-disable-next-line no-unused-vars
function _tlGrid(w, h) {
  let g = '';
  for (let ms = 0; ms <= _TL_TOTAL; ms += 40) {
    const lx = (ms * _TL_PX).toFixed(1); const hv = ms % 200 === 0;
    g += `<line x1="${lx}" y1="0" x2="${lx}" y2="${h}" stroke="${hv ? '#ff9999' : '#ffcccc'}" stroke-width="${hv ? 0.7 : 0.3}"/>`;
  }
  for (let mv = -3; mv <= 5; mv++) {
    const ly = (_TL_BL - mv * _TL_MV).toFixed(1); if (parseFloat(ly) < -1 || parseFloat(ly) > h + 1) continue;
    const hv = mv % 5 === 0;
    g += `<line x1="0" y1="${ly}" x2="${w}" y2="${ly}" stroke="${hv ? '#ff9999' : '#ffcccc'}" stroke-width="${hv ? 0.7 : 0.3}"/>`;
  }
  return g;
}

function _tlRBBBBeat(t, opts) {
  const { pr = 160, pA = 0.15, rA = 0.5, sA = 0.8, rPrime = 0.9, sLate = 0, flip = false, noP = false } = opts;
  const s = flip ? -1 : 1; const ps = flip ? -1 : 1;
  const pts = [];
  if (!noP) {
    pts.push(_tlPt(t, 0)); pts.push(_tlPt(t + 20, ps * pA * 0.5)); pts.push(_tlPt(t + 40, ps * pA));
    pts.push(_tlPt(t + 60, ps * pA * 0.5)); pts.push(_tlPt(t + 80, 0)); pts.push(_tlPt(t + pr - 5, 0));
  } else { pts.push(_tlPt(t, 0)); pts.push(_tlPt(t + pr - 5, 0)); }
  const qs = t + pr;
  pts.push(_tlPt(qs, 0));
  pts.push(_tlPt(qs + 10, s * rA * 0.4));
  pts.push(_tlPt(qs + 22, s * rA));
  pts.push(_tlPt(qs + 35, s * -sA));
  pts.push(_tlPt(qs + 55, s * -sA * 0.3));
  pts.push(_tlPt(qs + 75, s * rPrime));
  pts.push(_tlPt(qs + 100, s * -sLate));
  pts.push(_tlPt(qs + 130, 0));
  pts.push(_tlPt(qs + 180, s * -0.18));
  pts.push(_tlPt(qs + 240, s * -0.08));
  pts.push(_tlPt(qs + 270, 0));
  return pts;
}

function _tlRBBBLateralBeat(t, opts) {
  const { pr = 160, pA = 0.15, rA = 1.0, sLate = 0.35, tA = 0.28, flip = false } = opts;
  const s = flip ? -1 : 1;
  const pts = [];
  pts.push(_tlPt(t, 0)); pts.push(_tlPt(t + 20, pA * 0.5)); pts.push(_tlPt(t + 40, pA));
  pts.push(_tlPt(t + 60, pA * 0.5)); pts.push(_tlPt(t + 80, 0)); pts.push(_tlPt(t + pr - 5, 0));
  const qs = t + pr;
  pts.push(_tlPt(qs, 0));
  pts.push(_tlPt(qs + 8, -0.06));
  pts.push(_tlPt(qs + 22, s * rA));
  pts.push(_tlPt(qs + 35, -0.08));
  pts.push(_tlPt(qs + 55, 0));
  pts.push(_tlPt(qs + 90, -sLate));
  pts.push(_tlPt(qs + 130, -sLate * 0.5));
  pts.push(_tlPt(qs + 160, 0));
  pts.push(_tlPt(qs + 200, s * tA));
  pts.push(_tlPt(qs + 255, s * tA * 0.3));
  pts.push(_tlPt(qs + 280, 0));
  return pts;
}

function _tlBuildRBBBLead(rr, opts) {
  const pts = [_tlPt(0, 0)]; let t = 30;
  const useRSR = opts.rsrPattern;
  while (t + rr < _TL_TOTAL + rr * 0.5) {
    if (useRSR) { _tlRBBBBeat(t, opts).forEach(p => pts.push(p)); }
    else { _tlRBBBLateralBeat(t, opts).forEach(p => pts.push(p)); }
    t += rr;
  }
  pts.push(_tlPt(_TL_TOTAL, 0)); return pts;
}

const _TL_PATTERNS = {
  normal: {
    title: 'Normal 12-Lead ECG',
    leads: {
      'I':   { pr:160, pA:0.12, rA:0.65, qD:0.06, sD:0.06, tA:0.22, st:0 },
      'II':  { pr:160, pA:0.15, rA:1.00, qD:0.08, sD:0.14, tA:0.30, st:0 },
      'III': { pr:160, pA:0.08, rA:0.40, qD:0.04, sD:0.05, tA:0.15, st:0 },
      'aVR': { pr:160, pA:0.12, rA:0.30, qD:0.08, sD:0.05, tA:0.12, st:0, flip:true, pFlip:true },
      'aVL': { pr:160, pA:0.08, rA:0.35, qD:0.06, sD:0.06, tA:0.12, st:0 },
      'aVF': { pr:160, pA:0.13, rA:0.72, qD:0.06, sD:0.10, tA:0.25, st:0 },
      'V1':  { pr:160, pA:0.06, rA:0.18, qD:0.04, sD:0.45, tA:-0.10, st:0 },
      'V2':  { pr:160, pA:0.08, rA:0.35, qD:0.04, sD:0.38, tA:-0.08, st:0.05 },
      'V3':  { pr:160, pA:0.10, rA:0.65, qD:0.05, sD:0.22, tA:0.12, st:0.04 },
      'V4':  { pr:160, pA:0.12, rA:1.00, qD:0.07, sD:0.14, tA:0.30, st:0 },
      'V5':  { pr:160, pA:0.12, rA:1.10, qD:0.06, sD:0.10, tA:0.32, st:0 },
      'V6':  { pr:160, pA:0.12, rA:0.88, qD:0.06, sD:0.08, tA:0.28, st:0 },
    }
  },
  inferiorSTEMI: {
    title: 'Inferior STEMI — ST Elevation II, III, aVF',
    leads: {
      'I':   { pr:160, pA:0.12, rA:0.60, qD:0.06, sD:0.06, tA:0.15, st:-0.10 },
      'II':  { pr:160, pA:0.15, rA:1.00, qD:0.12, sD:0.14, tA:0.40, st:0.25 },
      'III': { pr:160, pA:0.10, rA:0.85, qD:0.18, sD:0.10, tA:0.42, st:0.32 },
      'aVR': { pr:160, pA:0.12, rA:0.28, qD:0.06, sD:0.05, tA:0.08, st:0, flip:true, pFlip:true },
      'aVL': { pr:160, pA:0.06, rA:0.28, qD:0.04, sD:0.05, tA:-0.15, st:-0.18 },
      'aVF': { pr:160, pA:0.13, rA:0.90, qD:0.16, sD:0.10, tA:0.38, st:0.28 },
      'V1':  { pr:160, pA:0.06, rA:0.18, qD:0.04, sD:0.45, tA:-0.10, st:-0.08 },
      'V2':  { pr:160, pA:0.08, rA:0.35, qD:0.04, sD:0.38, tA:-0.05, st:-0.06 },
      'V3':  { pr:160, pA:0.10, rA:0.65, qD:0.05, sD:0.22, tA:0.12, st:0 },
      'V4':  { pr:160, pA:0.12, rA:1.00, qD:0.07, sD:0.14, tA:0.30, st:0 },
      'V5':  { pr:160, pA:0.12, rA:1.10, qD:0.06, sD:0.10, tA:0.32, st:0 },
      'V6':  { pr:160, pA:0.12, rA:0.88, qD:0.06, sD:0.08, tA:0.28, st:0 },
    }
  },
  anteriorSTEMI: {
    title: 'Anterior STEMI — ST Elevation V1-V4',
    leads: {
      'I':   { pr:160, pA:0.12, rA:0.65, qD:0.06, sD:0.06, tA:0.25, st:0.08 },
      'II':  { pr:160, pA:0.15, rA:1.00, qD:0.08, sD:0.14, tA:0.20, st:-0.08 },
      'III': { pr:160, pA:0.08, rA:0.38, qD:0.04, sD:0.05, tA:0.10, st:-0.10 },
      'aVR': { pr:160, pA:0.12, rA:0.30, qD:0.08, sD:0.05, tA:0.10, st:0, flip:true, pFlip:true },
      'aVL': { pr:160, pA:0.10, rA:0.42, qD:0.06, sD:0.06, tA:0.22, st:0.12 },
      'aVF': { pr:160, pA:0.12, rA:0.68, qD:0.06, sD:0.10, tA:0.15, st:-0.08 },
      'V1':  { pr:160, pA:0.06, rA:0.12, qD:0.14, sD:0.50, tA:0.28, st:0.32 },
      'V2':  { pr:160, pA:0.08, rA:0.22, qD:0.12, sD:0.40, tA:0.38, st:0.38 },
      'V3':  { pr:160, pA:0.10, rA:0.45, qD:0.10, sD:0.28, tA:0.35, st:0.30 },
      'V4':  { pr:160, pA:0.12, rA:0.75, qD:0.08, sD:0.18, tA:0.30, st:0.18 },
      'V5':  { pr:160, pA:0.12, rA:1.10, qD:0.06, sD:0.10, tA:0.32, st:0 },
      'V6':  { pr:160, pA:0.12, rA:0.88, qD:0.06, sD:0.08, tA:0.28, st:0 },
    }
  },
  lateralSTEMI: {
    title: 'Lateral STEMI — ST Elevation I, aVL, V5-V6',
    leads: {
      'I':   { pr:160, pA:0.12, rA:0.80, qD:0.06, sD:0.05, tA:0.38, st:0.25 },
      'II':  { pr:160, pA:0.15, rA:0.90, qD:0.08, sD:0.14, tA:0.15, st:-0.10 },
      'III': { pr:160, pA:0.08, rA:0.35, qD:0.04, sD:0.05, tA:0.05, st:-0.15 },
      'aVR': { pr:160, pA:0.12, rA:0.30, qD:0.08, sD:0.05, tA:0.10, st:0, flip:true, pFlip:true },
      'aVL': { pr:160, pA:0.10, rA:0.55, qD:0.06, sD:0.05, tA:0.35, st:0.22 },
      'aVF': { pr:160, pA:0.12, rA:0.65, qD:0.06, sD:0.10, tA:0.12, st:-0.12 },
      'V1':  { pr:160, pA:0.06, rA:0.18, qD:0.04, sD:0.45, tA:-0.10, st:0 },
      'V2':  { pr:160, pA:0.08, rA:0.35, qD:0.04, sD:0.38, tA:-0.05, st:0 },
      'V3':  { pr:160, pA:0.10, rA:0.65, qD:0.05, sD:0.22, tA:0.12, st:0 },
      'V4':  { pr:160, pA:0.12, rA:1.00, qD:0.07, sD:0.14, tA:0.28, st:0.08 },
      'V5':  { pr:160, pA:0.12, rA:1.10, qD:0.06, sD:0.10, tA:0.40, st:0.22 },
      'V6':  { pr:160, pA:0.12, rA:0.90, qD:0.06, sD:0.08, tA:0.38, st:0.20 },
    }
  },
  lbbb: {
    title: 'Left Bundle Branch Block',
    leads: {
      'I':   { pr:160, pA:0.12, rA:0.90, qD:0.00, sD:0.04, tA:-0.22, st:-0.08, wide:true },
      'II':  { pr:160, pA:0.15, rA:0.75, qD:0.00, sD:0.08, tA:-0.18, st:-0.06, wide:true },
      'III': { pr:160, pA:0.06, rA:0.00, qD:0.00, sD:0.60, tA:0.20, st:0.10, wide:true, flip:true },
      'aVR': { pr:160, pA:0.12, rA:0.00, qD:0.00, sD:0.70, tA:0.25, st:0.12, wide:true, flip:true, pFlip:true },
      'aVL': { pr:160, pA:0.10, rA:0.85, qD:0.00, sD:0.04, tA:-0.20, st:-0.08, wide:true },
      'aVF': { pr:160, pA:0.10, rA:0.00, qD:0.00, sD:0.55, tA:0.18, st:0.08, wide:true, flip:true },
      'V1':  { pr:160, pA:0.06, rA:0.00, qD:0.00, sD:0.75, tA:0.32, st:0.18, wide:true, flip:true },
      'V2':  { pr:160, pA:0.08, rA:0.00, qD:0.00, sD:0.70, tA:0.28, st:0.15, wide:true, flip:true },
      'V3':  { pr:160, pA:0.08, rA:0.20, qD:0.00, sD:0.50, tA:0.18, st:0.10, wide:true, flip:true },
      'V4':  { pr:160, pA:0.10, rA:0.60, qD:0.00, sD:0.15, tA:-0.10, st:-0.04, wide:true },
      'V5':  { pr:160, pA:0.12, rA:1.00, qD:0.00, sD:0.06, tA:-0.20, st:-0.08, wide:true },
      'V6':  { pr:160, pA:0.12, rA:0.92, qD:0.00, sD:0.04, tA:-0.18, st:-0.06, wide:true },
    }
  },
  rbbb: {
    title: 'Right Bundle Branch Block',
    rbbb: true,
    leads: {
      'I':   { pr:160, pA:0.12, rA:1.00, sLate:0.38, tA:0.28 },
      'II':  { pr:160, pA:0.15, rA:0.95, sLate:0.22, tA:0.25 },
      'III': { pr:160, pA:0.08, rA:0.42, sLate:0.10, tA:0.18 },
      'aVR': { pr:160, pA:0.12, rA:0.30, sLate:0.10, tA:0.12, flip:true },
      'aVL': { pr:160, pA:0.08, rA:0.32, sLate:0.30, tA:-0.12 },
      'aVF': { pr:160, pA:0.13, rA:0.70, sLate:0.12, tA:0.22 },
      'V1':  { pr:160, pA:0.06, rA:0.35, sA:0.70, rPrime:0.90, sLate:0, tA:-0.18, rsrPattern:true },
      'V2':  { pr:160, pA:0.08, rA:0.30, sA:0.65, rPrime:0.85, sLate:0, tA:-0.15, rsrPattern:true },
      'V3':  { pr:160, pA:0.10, rA:0.60, sLate:0.28, tA:-0.08 },
      'V4':  { pr:160, pA:0.12, rA:0.95, sLate:0.22, tA:0.18 },
      'V5':  { pr:160, pA:0.12, rA:1.05, sLate:0.32, tA:0.28 },
      'V6':  { pr:160, pA:0.12, rA:0.85, sLate:0.35, tA:0.25 },
    }
  },
  afib12: {
    afib: true,
    title: 'Atrial Fibrillation — 12-Lead',
    leads: {
      'I':   { rA:0.65, sD:0.08, tA:0.22 },
      'II':  { rA:1.00, sD:0.14, tA:0.28 },
      'III': { rA:0.40, sD:0.05, tA:0.15 },
      'aVR': { rA:0.30, flip:true, tA:-0.10 },
      'aVL': { rA:0.35, sD:0.06, tA:0.12 },
      'aVF': { rA:0.70, sD:0.10, tA:0.22 },
      'V1':  { rA:0.18, sD:0.45, tA:-0.08 },
      'V2':  { rA:0.35, sD:0.38, tA:-0.05 },
      'V3':  { rA:0.65, sD:0.22, tA:0.12 },
      'V4':  { rA:1.00, sD:0.14, tA:0.30 },
      'V5':  { rA:1.10, sD:0.10, tA:0.32 },
      'V6':  { rA:0.88, sD:0.08, tA:0.28 },
    }
  },
  vtach12: {
    vtach: true,
    title: 'Ventricular Tachycardia — 12-Lead',
    leads: {
      'I':   { rA:0.90, flip:false },
      'II':  { rA:1.10, flip:false },
      'III': { rA:0.75, flip:true },
      'aVR': { rA:0.85, flip:true },
      'aVL': { rA:0.55, flip:false },
      'aVF': { rA:0.80, flip:false },
      'V1':  { rA:1.00, flip:true },
      'V2':  { rA:1.10, flip:true },
      'V3':  { rA:0.95, flip:false },
      'V4':  { rA:0.85, flip:false },
      'V5':  { rA:0.75, flip:false },
      'V6':  { rA:0.65, flip:false },
    }
  },
  inferiorRV: {
    title: 'Inferior + RV STEMI — Modified 15-Lead',
    leads: {
      'I':   { pr:160, pA:0.12, rA:0.60, qD:0.06, sD:0.06, tA:0.15, st:-0.10 },
      'II':  { pr:160, pA:0.15, rA:1.00, qD:0.12, sD:0.14, tA:0.40, st:0.25 },
      'III': { pr:160, pA:0.10, rA:0.90, qD:0.20, sD:0.10, tA:0.45, st:0.35 },
      'aVR': { pr:160, pA:0.12, rA:0.28, qD:0.06, sD:0.05, tA:0.08, st:0, flip:true, pFlip:true },
      'aVL': { pr:160, pA:0.06, rA:0.28, qD:0.04, sD:0.05, tA:-0.18, st:-0.20 },
      'aVF': { pr:160, pA:0.13, rA:0.90, qD:0.16, sD:0.10, tA:0.40, st:0.28 },
      'V1':  { pr:160, pA:0.06, rA:0.20, qD:0.04, sD:0.42, tA:0.10, st:0.12 },
      'V2':  { pr:160, pA:0.08, rA:0.35, qD:0.04, sD:0.38, tA:-0.05, st:-0.05 },
      'V3':  { pr:160, pA:0.10, rA:0.65, qD:0.05, sD:0.22, tA:0.12, st:0 },
      'V4R': { pr:160, pA:0.06, rA:0.12, qD:0.04, sD:0.52, tA:0.22, st:0.25 },
      'V8':  { pr:160, pA:0.10, rA:0.32, qD:0.04, sD:0.16, tA:0.28, st:0.10 },
      'V9':  { pr:160, pA:0.10, rA:0.28, qD:0.04, sD:0.14, tA:0.25, st:0.08 },
    }
  },
  posterior: {
    title: 'Posterior STEMI — Modified 15-Lead',
    leads: {
      'I':   { pr:160, pA:0.12, rA:0.65, qD:0.06, sD:0.06, tA:0.22, st:0 },
      'II':  { pr:160, pA:0.15, rA:1.00, qD:0.08, sD:0.14, tA:0.28, st:0 },
      'III': { pr:160, pA:0.08, rA:0.40, qD:0.04, sD:0.05, tA:0.15, st:0 },
      'aVR': { pr:160, pA:0.12, rA:0.30, qD:0.08, sD:0.05, tA:0.10, st:0, flip:true, pFlip:true },
      'aVL': { pr:160, pA:0.08, rA:0.35, qD:0.06, sD:0.06, tA:0.12, st:0 },
      'aVF': { pr:160, pA:0.13, rA:0.72, qD:0.06, sD:0.10, tA:0.25, st:0 },
      'V1':  { pr:160, pA:0.06, rA:0.72, qD:0.02, sD:0.08, tA:0.25, st:-0.22 },
      'V2':  { pr:160, pA:0.08, rA:0.80, qD:0.02, sD:0.06, tA:0.28, st:-0.20 },
      'V3':  { pr:160, pA:0.10, rA:0.75, qD:0.04, sD:0.10, tA:0.18, st:-0.12 },
      'V4R': { pr:160, pA:0.06, rA:0.14, qD:0.04, sD:0.50, tA:0.20, st:0.15 },
      'V8':  { pr:160, pA:0.10, rA:0.32, qD:0.04, sD:0.16, tA:0.28, st:0.22 },
      'V9':  { pr:160, pA:0.10, rA:0.28, qD:0.04, sD:0.14, tA:0.25, st:0.18 },
    }
  },
  wellens: {
    title: "Wellens Syndrome — LAD T-Wave Warning",
    leads: {
      'I':   { pr:160, pA:0.12, rA:0.65, qD:0.06, sD:0.06, tA:0.18, st:0 },
      'II':  { pr:160, pA:0.15, rA:1.00, qD:0.08, sD:0.14, tA:0.22, st:0 },
      'III': { pr:160, pA:0.08, rA:0.40, qD:0.04, sD:0.05, tA:0.12, st:0 },
      'aVR': { pr:160, pA:0.12, rA:0.30, qD:0.08, sD:0.05, tA:0.10, st:0, flip:true, pFlip:true },
      'aVL': { pr:160, pA:0.08, rA:0.35, qD:0.06, sD:0.06, tA:0.10, st:0 },
      'aVF': { pr:160, pA:0.13, rA:0.72, qD:0.06, sD:0.10, tA:0.18, st:0 },
      'V1':  { pr:160, pA:0.06, rA:0.18, qD:0.04, sD:0.42, tA:-0.28, st:0 },
      'V2':  { pr:160, pA:0.08, rA:0.32, qD:0.04, sD:0.35, tA:-0.55, st:0 },
      'V3':  { pr:160, pA:0.10, rA:0.55, qD:0.05, sD:0.20, tA:-0.60, st:0 },
      'V4':  { pr:160, pA:0.12, rA:0.85, qD:0.07, sD:0.14, tA:-0.45, st:0 },
      'V5':  { pr:160, pA:0.12, rA:1.05, qD:0.06, sD:0.10, tA:-0.25, st:0 },
      'V6':  { pr:160, pA:0.12, rA:0.88, qD:0.06, sD:0.08, tA:-0.12, st:0 },
    }
  },
  deWinter: {
    title: "De Winter Pattern — STEMI Equivalent (LAD)",
    leads: {
      'I':   { pr:160, pA:0.12, rA:0.65, qD:0.06, sD:0.06, tA:0.28, st:0.08 },
      'II':  { pr:160, pA:0.15, rA:1.00, qD:0.08, sD:0.14, tA:0.25, st:0 },
      'III': { pr:160, pA:0.08, rA:0.40, qD:0.04, sD:0.05, tA:0.15, st:-0.05 },
      'aVR': { pr:160, pA:0.12, rA:0.30, qD:0.08, sD:0.05, tA:0.15, st:0.15, flip:true, pFlip:true },
      'aVL': { pr:160, pA:0.08, rA:0.35, qD:0.06, sD:0.06, tA:0.22, st:0.10 },
      'aVF': { pr:160, pA:0.13, rA:0.72, qD:0.06, sD:0.10, tA:0.18, st:-0.05 },
      'V1':  { pr:160, pA:0.06, rA:0.15, qD:0.04, sD:0.48, tA:0.42, st:-0.15 },
      'V2':  { pr:160, pA:0.08, rA:0.25, qD:0.04, sD:0.40, tA:0.55, st:-0.18 },
      'V3':  { pr:160, pA:0.10, rA:0.45, qD:0.05, sD:0.28, tA:0.58, st:-0.20 },
      'V4':  { pr:160, pA:0.12, rA:0.70, qD:0.07, sD:0.18, tA:0.52, st:-0.18 },
      'V5':  { pr:160, pA:0.12, rA:0.95, qD:0.06, sD:0.12, tA:0.42, st:-0.12 },
      'V6':  { pr:160, pA:0.12, rA:0.85, qD:0.06, sD:0.08, tA:0.30, st:-0.06 },
    }
  },
  inferolateralSTEMI: {
    title: "Inferolateral STEMI — II, III, aVF, V5, V6",
    leads: {
      'I':   { pr:160, pA:0.12, rA:0.65, qD:0.06, sD:0.06, tA:0.28, st:0.18 },
      'II':  { pr:160, pA:0.15, rA:1.00, qD:0.14, sD:0.14, tA:0.42, st:0.28 },
      'III': { pr:160, pA:0.10, rA:0.88, qD:0.20, sD:0.10, tA:0.45, st:0.35 },
      'aVR': { pr:160, pA:0.12, rA:0.28, qD:0.06, sD:0.05, tA:0.08, st:-0.10, flip:true, pFlip:true },
      'aVL': { pr:160, pA:0.06, rA:0.28, qD:0.04, sD:0.05, tA:-0.18, st:-0.22 },
      'aVF': { pr:160, pA:0.13, rA:0.90, qD:0.16, sD:0.10, tA:0.40, st:0.30 },
      'V1':  { pr:160, pA:0.06, rA:0.18, qD:0.04, sD:0.45, tA:-0.10, st:-0.08 },
      'V2':  { pr:160, pA:0.08, rA:0.35, qD:0.04, sD:0.38, tA:-0.05, st:-0.05 },
      'V3':  { pr:160, pA:0.10, rA:0.65, qD:0.05, sD:0.22, tA:0.12, st:0 },
      'V4':  { pr:160, pA:0.12, rA:1.00, qD:0.07, sD:0.14, tA:0.28, st:0.10 },
      'V5':  { pr:160, pA:0.12, rA:1.10, qD:0.06, sD:0.10, tA:0.42, st:0.25 },
      'V6':  { pr:160, pA:0.12, rA:0.90, qD:0.06, sD:0.08, tA:0.38, st:0.22 },
    }
  },
  highLateralSTEMI: {
    title: "High Lateral STEMI — I, aVL (Diagonal Branch)",
    leads: {
      'I':   { pr:160, pA:0.12, rA:0.80, qD:0.06, sD:0.05, tA:0.42, st:0.30 },
      'II':  { pr:160, pA:0.15, rA:0.90, qD:0.08, sD:0.14, tA:0.18, st:-0.12 },
      'III': { pr:160, pA:0.08, rA:0.38, qD:0.04, sD:0.05, tA:0.08, st:-0.18 },
      'aVR': { pr:160, pA:0.12, rA:0.30, qD:0.08, sD:0.05, tA:0.10, st:0, flip:true, pFlip:true },
      'aVL': { pr:160, pA:0.10, rA:0.60, qD:0.06, sD:0.05, tA:0.40, st:0.28 },
      'aVF': { pr:160, pA:0.12, rA:0.65, qD:0.06, sD:0.10, tA:0.12, st:-0.14 },
      'V1':  { pr:160, pA:0.06, rA:0.18, qD:0.04, sD:0.45, tA:-0.10, st:0 },
      'V2':  { pr:160, pA:0.08, rA:0.35, qD:0.04, sD:0.38, tA:-0.05, st:0 },
      'V3':  { pr:160, pA:0.10, rA:0.65, qD:0.05, sD:0.22, tA:0.12, st:0 },
      'V4':  { pr:160, pA:0.12, rA:1.00, qD:0.07, sD:0.14, tA:0.28, st:0 },
      'V5':  { pr:160, pA:0.12, rA:1.10, qD:0.06, sD:0.10, tA:0.32, st:0 },
      'V6':  { pr:160, pA:0.12, rA:0.88, qD:0.06, sD:0.08, tA:0.28, st:0 },
    }
  },
  pericarditis: {
    title: "Acute Pericarditis — Diffuse Saddle ST Elevation",
    leads: {
      'I':   { pr:150, pA:0.12, rA:0.65, qD:0.04, sD:0.06, tA:0.35, st:0.12 },
      'II':  { pr:150, pA:0.15, rA:1.00, qD:0.06, sD:0.14, tA:0.42, st:0.15 },
      'III': { pr:150, pA:0.10, rA:0.42, qD:0.04, sD:0.05, tA:0.28, st:0.10 },
      'aVR': { pr:150, pA:0.12, rA:0.30, qD:0.06, sD:0.05, tA:-0.15, st:-0.14, flip:true, pFlip:true },
      'aVL': { pr:150, pA:0.08, rA:0.35, qD:0.04, sD:0.06, tA:0.28, st:0.08 },
      'aVF': { pr:150, pA:0.13, rA:0.72, qD:0.06, sD:0.10, tA:0.38, st:0.12 },
      'V1':  { pr:150, pA:0.06, rA:0.18, qD:0.04, sD:0.42, tA:-0.08, st:-0.10 },
      'V2':  { pr:150, pA:0.08, rA:0.35, qD:0.04, sD:0.38, tA:0.20, st:0.12 },
      'V3':  { pr:150, pA:0.10, rA:0.65, qD:0.05, sD:0.22, tA:0.32, st:0.14 },
      'V4':  { pr:150, pA:0.12, rA:1.00, qD:0.07, sD:0.14, tA:0.40, st:0.15 },
      'V5':  { pr:150, pA:0.12, rA:1.10, qD:0.06, sD:0.10, tA:0.45, st:0.15 },
      'V6':  { pr:150, pA:0.12, rA:0.90, qD:0.06, sD:0.08, tA:0.42, st:0.14 },
    }
  },
  hyperkalemia: {
    title: "Hyperkalemia — Peaked T Waves",
    leads: {
      'I':   { pr:200, pA:0.06, rA:0.65, qD:0.10, sD:0.10, tA:0.52, st:0, wide:true },
      'II':  { pr:200, pA:0.06, rA:1.00, qD:0.10, sD:0.16, tA:0.68, st:0, wide:true },
      'III': { pr:200, pA:0.04, rA:0.40, qD:0.06, sD:0.06, tA:0.45, st:0, wide:true },
      'aVR': { pr:200, pA:0.05, rA:0.30, qD:0.08, sD:0.06, tA:-0.35, st:0, wide:true, flip:true, pFlip:true },
      'aVL': { pr:200, pA:0.04, rA:0.35, qD:0.08, sD:0.08, tA:0.38, st:0, wide:true },
      'aVF': { pr:200, pA:0.05, rA:0.72, qD:0.08, sD:0.12, tA:0.55, st:0, wide:true },
      'V1':  { pr:200, pA:0.04, rA:0.20, qD:0.06, sD:0.45, tA:0.55, st:0, wide:true },
      'V2':  { pr:200, pA:0.04, rA:0.38, qD:0.06, sD:0.40, tA:0.75, st:0, wide:true },
      'V3':  { pr:200, pA:0.05, rA:0.68, qD:0.08, sD:0.28, tA:0.80, st:0, wide:true },
      'V4':  { pr:200, pA:0.06, rA:1.05, qD:0.09, sD:0.18, tA:0.75, st:0, wide:true },
      'V5':  { pr:200, pA:0.06, rA:1.12, qD:0.08, sD:0.12, tA:0.65, st:0, wide:true },
      'V6':  { pr:200, pA:0.06, rA:0.90, qD:0.08, sD:0.10, tA:0.55, st:0, wide:true },
    }
  },
  svt12: {
    afib: false,
    vtach: false,
    title: "SVT — Narrow Complex Tachycardia",
    leads: {
      'I':   { pr:80, pA:0, noP:true, rA:0.65, qD:0.04, sD:0.06, tA:0.18 },
      'II':  { pr:80, pA:0, noP:true, rA:1.00, qD:0.05, sD:0.12, tA:0.22 },
      'III': { pr:80, pA:0, noP:true, rA:0.40, qD:0.03, sD:0.04, tA:0.12 },
      'aVR': { pr:80, pA:0, noP:true, rA:0.30, qD:0.05, sD:0.04, tA:-0.12, flip:true },
      'aVL': { pr:80, pA:0, noP:true, rA:0.35, qD:0.04, sD:0.05, tA:0.10 },
      'aVF': { pr:80, pA:0, noP:true, rA:0.72, qD:0.04, sD:0.08, tA:0.18 },
      'V1':  { pr:80, pA:0, noP:true, rA:0.18, qD:0.03, sD:0.40, tA:-0.08 },
      'V2':  { pr:80, pA:0, noP:true, rA:0.35, qD:0.03, sD:0.35, tA:-0.05 },
      'V3':  { pr:80, pA:0, noP:true, rA:0.65, qD:0.04, sD:0.20, tA:0.10 },
      'V4':  { pr:80, pA:0, noP:true, rA:1.00, qD:0.05, sD:0.12, tA:0.22 },
      'V5':  { pr:80, pA:0, noP:true, rA:1.10, qD:0.04, sD:0.08, tA:0.24 },
      'V6':  { pr:80, pA:0, noP:true, rA:0.88, qD:0.04, sD:0.06, tA:0.20 },
    }
  },
  atrialFlutter12: {
    flutter: true,
    title: "Atrial Flutter — Sawtooth Pattern",
    leads: {
      'I':   { rA:0.65, sD:0.06, tA:0.18 },
      'II':  { rA:1.00, sD:0.14, tA:0.22 },
      'III': { rA:0.40, sD:0.05, tA:0.12 },
      'aVR': { rA:0.30, flip:true, tA:-0.10 },
      'aVL': { rA:0.35, sD:0.06, tA:0.10 },
      'aVF': { rA:0.70, sD:0.10, tA:0.18 },
      'V1':  { rA:0.18, sD:0.45, tA:-0.08 },
      'V2':  { rA:0.35, sD:0.38, tA:-0.05 },
      'V3':  { rA:0.65, sD:0.22, tA:0.10 },
      'V4':  { rA:1.00, sD:0.14, tA:0.22 },
      'V5':  { rA:1.10, sD:0.10, tA:0.24 },
      'V6':  { rA:0.88, sD:0.08, tA:0.20 },
    }
  },
};

function TwelveLeadSVG({ ecgType, rhythmInterp, twelveLeadFindings, fifteenLeadFindings, hr, isNightShift }) {
  const pattern = pickTwelveLeadPattern(ecgType, rhythmInterp, twelveLeadFindings, fifteenLeadFindings);
  const p = _TL_PATTERNS[pattern] || _TL_PATTERNS.normal;
  const rr = Math.round(60000 / Math.max(30, Math.min(280, hr || 75)));
  const bgC = isNightShift ? '#1a0a0a' : '#fff8f8';
  const heavyC = isNightShift ? '#6a2828' : '#ff9999';
  const waveC = isNightShift ? '#00e87a' : '#111111';
  const labelC = isNightShift ? '#ff6060' : '#c05050';

  function makLeadSVG(pts, w, h) {
    let g = '';
    const gridC = isNightShift ? '#3a1a1a' : '#ffcccc';
    for (let ms = 0; ms <= _TL_TOTAL; ms += 40) {
      const lx = (ms * _TL_PX).toFixed(1); const hv = ms % 200 === 0;
      g += `<line x1="${lx}" y1="0" x2="${lx}" y2="${h}" stroke="${hv ? heavyC : gridC}" stroke-width="${hv ? 0.7 : 0.3}"/>`;
    }
    for (let mv = -3; mv <= 5; mv++) {
      const ly = (_TL_BL - mv * _TL_MV).toFixed(1); if (parseFloat(ly) < -1 || parseFloat(ly) > h + 1) continue;
      const hv = mv % 5 === 0;
      g += `<line x1="0" y1="${ly}" x2="${w}" y2="${ly}" stroke="${hv ? heavyC : gridC}" stroke-width="${hv ? 0.7 : 0.3}"/>`;
    }
    return (
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', display: 'block' }} preserveAspectRatio="none"
        dangerouslySetInnerHTML={{ __html: `<rect width="${w}" height="${h}" fill="${bgC}"/>${g}<path d="${_tlD(pts)}" stroke="${waveC}" stroke-width="1.2" fill="none" stroke-linejoin="round"/>` }}
      />
    );
  }

  function buildPts(lead) {
    const opts = p.leads[lead] || {};
    if (p.afib) return _tlBuildAFib(rr, lead.charCodeAt(0) * 37, opts);
    if (p.vtach) return _tlBuildVTach(rr, opts);
    if (p.rbbb) return _tlBuildRBBBLead(rr, opts);
    if (p.flutter) return _tlBuildFlutter(rr, opts);
    return _tlBuildLead(rr, opts);
  }

  const is15Lead = ecgType === '15-lead';
  const rowA = ['I',   'aVR', 'V1', is15Lead ? 'V4R' : 'V4'];
  const rowB = ['II',  'aVL', 'V2', is15Lead ? 'V8'  : 'V5'];
  const rowC = ['III', 'aVF', 'V3', is15Lead ? 'V9'  : 'V6'];
  const stdRows = [rowA, rowB, rowC];

  function leadCell(lead) {
    return (
      <div key={lead} style={{ backgroundColor: bgC, padding: '2px 4px' }}>
        <div style={{ fontSize: '9px', fontWeight: 700, color: labelC, letterSpacing: '0.04em', marginBottom: '1px', fontFamily: 'monospace' }}>{lead}</div>
        {makLeadSVG(buildPts(lead), _TL_W, _TL_H)}
      </div>
    );
  }

  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr 1fr',
    gap: '2px',
    backgroundColor: heavyC,
    border: `1px solid ${heavyC}`,
    borderRadius: '4px',
    overflow: 'hidden',
    marginBottom: '3px',
  };

  return (
    <div>
      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--vn-muted-text)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>
        {p.title} — {hr} bpm
      </div>

      {stdRows.map((row, ri) => (
        <div key={ri} style={gridStyle}>
          {row.map(lead => leadCell(lead))}
        </div>
      ))}

      {is15Lead && (
        <div style={{ fontSize: '9px', color: labelC, letterSpacing: '0.04em', padding: '2px 0 3px', fontFamily: 'monospace', textAlign: 'right' }}>
          V4R · V8 · V9 — modified 15-lead positions
        </div>
      )}

      <div style={{ fontSize: '9px', color: 'var(--vn-muted-text)', textAlign: 'right', fontFamily: 'monospace', marginTop: '2px' }}>
        25 mm/s · 10 mm/mV · Standard 12-Lead Layout
      </div>
    </div>
  );
}
// ── End ECG SVG Generator ────────────────────────────────────────────────────

const SCENARIO_TYPES = [
  "Medical",
  "Trauma",
  "Cardiac",
  "Respiratory",
  "Environmental",
];

const SEMESTERS = ["2", "3", "4"];
const ENVIRONMENTS = ["Urban", "Rural", "Wilderness", "Industrial", "Home", "Public Space"];
const COMPLEXITIES = ["Simple", "Complex"];
const GENERATION_DEPTHS = ["Quick Draft", "Detailed"];
const SCENARIO_FRICTION_LEVELS = ["Clean", "Pressured"];

const USE_PILL_TOGGLES = false;

// eslint-disable-next-line no-unused-vars
const FIELD_TOOLTIPS = {
  semester: "Training level: 2 = foundational assessment and safe basic care, 3 = directive-aware treatment with medication decisions, 4 = near-graduation complexity with prioritization under pressure",
  type: "Scenario category: Medical, Trauma, Cardiac, Respiratory, or Environmental",
  environment: "Call location affects scene texture, access, collateral, and transport decisions",
  complexity: "Simple = one clear problem done well. Complex = competing cues and ambiguity requiring stronger prioritization.",
  generationDepth: "Quick Draft = lean and fast. Detailed = fuller instructor-grade depth with richer progression, reasoning, and GRS anchors.",
  scenarioFriction: "Clean = operationally straightforward, learning comes from clinical reasoning. Pressured = layered realistic friction that meaningfully affects assessment, packaging, and transport.",
};

const SECTION_GROUPS = {
  "The Call": [
    "scenarioIntro",
    "title",
    "callInformation",
    "sceneArrival",
    "patientDemographics",
    "patientPresentation",
    "incidentNarrative",
    "opqrst",
    "sample",
    "physicalExam",
    "vitalSigns",
    "ecgRhythm",
  ],
  "What Was Happening": [
    "clinicalReasoning",
    "caseProgression",
  ],
  "Expected Management": [
    "expectedTreatment",
    "protocolNotes",
  ],
  "Teaching Points": [
    "teachersPoints",
    "learningObjectives",
    "scenarioRationale",
    "instructorGuidance",
  ],
  "Self-Assessment": [
    "selfReflectionPrompts",
    "grsAnchors",
  ],
};

// eslint-disable-next-line no-unused-vars
const PAUSE_AFTER_GROUP = "What Was Happening";

const TITLE_MAP = {
  scenarioIntro: "Scenario Introduction",
  title: "Scenario Title",
  callInformation: "Call Information",
  patientDemographics: "Patient Demographics",
  patientPresentation: "Patient Presentation",
  incidentNarrative: "Incident History",
  sceneArrival: "Scene Arrival",
  firstImpression: "First Impression",
  initialAssessment: "Initial Assessment",
  historyGathering: "History Gathering",
  sample: "SAMPLE",
  medications: "Medications",
  allergies: "Allergies",
  pastMedicalHistory: "Past Medical History",
  pathophysiology: "Pathophysiology",
  differentialDiagnosis: "Differential Diagnosis",
  secondaryAssessment: "Secondary Assessment",
  additionalAssessments: "Additional Assessments",
  clinicalReasoning: "Integrated Clinical Reasoning",
  grsAnchors: "GRS Anchors",
  selfReflectionPrompts: "Self-Reflective Questions",
  opqrst: "OPQRST",
  physicalExam: "Physical Assessment",
  vitalSigns: "Vital Signs",
  ecgRhythm: "ECG / Rhythm",
  caseProgression: "Case Progression",
  transportPhase: "Transport Phase",
  instructorGuidance: "Instructor Guidance",
  expectedTreatment: "Expected Treatment",
  protocolNotes: "Protocol Notes",
  learningObjectives: "Learning Objectives",
  vocationalLearningOutcomes: "Vocational Learning Outcomes (VLOs)",
  teachersPoints: "Teaching Points",
  directiveSources: "Directive Sources",
  customPrompt: "Custom Prompt",
  scenarioRationale: "Scenario Rationale & Teaching Tips",
};

const ScenarioForm = () => {
  const [scenario, setScenario] = useState(null);
  const [loading, setLoading] = useState(false);
  // Info section visibility: show only before scenario is generated
  const showInfoSection = !scenario && !loading;
  const [formData, setFormData] = useState({
    semester: "3",
    type: "Medical",
    environment: "Urban",
    complexity: "Simple",
    generationDepth: "Quick Draft",
    scenarioFriction: "Clean",
    shiftMode: "Day Shift",
    customPrompt: "",
  });

  const [selectedECGImage, setSelectedECGImage] = useState(null);
  const [birthdayMode, setBirthdayMode] = useState(false);
  const abortControllerRef = useRef(null);
  const [jokeIndex, setJokeIndex] = useState(0);
  const [dotCount, setDotCount] = useState(1);

  const dayLoadingJokes = [
    "Tip: Keep reassessment tight. Vitals can change faster than confidence.",
    "Consulting the medical textbook we definitely didn't just skim...",
    "Diagnosing the problem... it's probably not lupus.",
    "Tip: If something feels off, trust your clinical gut and verify.",
    "Teaching the AI what a stethoscope is.",
    "Arguing with GPT about whether SpO2 of 94% counts as 'fine'.",
    "Tip: Treat the patient, not just the monitor.",
    "Generating vitals. Patient is surprisingly stable for someone made of JSON.",
    "Checking if the patient remembered to take their meds. They didn't.",
    "Tip: Scene management is patient care.",
    "Summoning a paramedic from the void...",
    "Running differential diagnoses. Top guess: anxiety. Second guess: more anxiety.",
    "The AI is currently on its coffee break. Please hold.",
    "Tip: If your differential has one item, you probably need a wider net.",
    "Asking the patient if it hurts when they do that. They said 'only emotionally'.",
    "Calibrating vague abdominal pain to maximum ambiguity.",
    "Tip: Repeat back critical findings to your partner before interventions.",
    "12-lead incoming. Please pretend you remember how to read it.",
    "Patient is alert and oriented x3, which is more than can be said for the dev.",
    "Inventing backstory. The patient definitely did not sign a waiver.",
    "Tip: Good handoffs are concise, structured, and brutally clear.",
    "Consulting the on-call AI. It's also confused.",
    "Assigning teaching cues with unhelpful but confident energy.",
    "Tip: Re-check ABCs after every major treatment step.",
    "Running vitals through the algorithm. It suggests more fluids.",
    "Asking the patient to rate their pain 1-10. They said 11. Classic.",
    "Checking SAMPLE history. The patient's allergies are listed as 'mornings'.",
    "Tip: If the story and presentation do not match, dig deeper.",
    "Placing the patient in the position of comfort. They chose fetal.",
    "Administering oxygen because honestly, when in doubt.",
    "Trying to remember if 'GCS of 15' is good or bad. It's good. Probably.",
    "Tip: Time of onset can be as diagnostic as any test.",
    "Scene safe? The AI said yes but it seemed nervous.",
    "Estimated time of arrival: soon-ish. Confidence interval: wide.",
    "Noting the patient has a pertinent negative attitude toward being assessed.",
    "Tip: When in doubt, verbalize your plan out loud for your partner.",
    "Consulting medical control. They put us on hold with jazz.",
    "The stretcher is ready. The patient is emotionally not.",
    "Tip: Confirm trends, not just single numbers.",
    "Trying to get a blood pressure while the patient argues with the cuff.",
    "Adding dramatic pause before revealing the next vital sign...",
    "Tip: If treatment is not working, reassess before repeating it.",
    "Requesting fire for lift assist. Again.",
    "ECG printed. Interpreter confidence pending.",
    "Tip: Closed-loop communication prevents open-loop chaos.",
    "The AI would like to remind you to bring extra gloves.",
    "Patient denies chest pain, then points directly at chest pain.",
    "Tip: Prioritize threats first, perfection later.",
    "Running scenario realism pass: adding one unhelpful bystander.",
    "Dispatch says routine. The scene says absolutely not.",
    "Tip: A calm tone can lower scene temperature fast.",
    "Checking cap refill and our own life choices.",
    "Transport decision matrix says: do not linger here.",
    "Tip: If findings conflict, collect one more data point.",
    "Reprinting paperwork because the printer sensed urgency.",
    "Patient says they are fine. Family says otherwise.",
    "Tip: Good documentation is patient care that lasts.",
    "Setting up IV supplies. One item immediately vanishes.",
    "Pulse is present, sarcasm stronger.",
    "Tip: Reassess pain after intervention, not just before.",
  ];

  const nightShiftJokes = [
    "Night shift tip: If the story sounds thin at 02:00, ask one more question before you believe it.",
    "Dispatch says routine. The porch light and the silence disagree.",
    "Waking the AI for the 03:00 call. It also wants coffee.",
    "Night shift tip: Locked doors, dark hallways, and sleepy witnesses all slow assessment. Name that early.",
    "Street is empty. The call somehow is not.",
    "Trying to find the unit number in lighting designed by our enemies.",
    "Night shift tip: Reassess after movement. Patients look different once you get them into real light.",
    "Security is on the way, the elevator is not, and the patient is on the top floor.",
    "Checking if this is fatigue, illness, or both. Night calls like to blur the edges.",
    "Night shift tip: Quiet scenes can still be high-acuity scenes. Do not let the calm fool you.",
    "The patient is half awake, the family is fully stressed, and the dog has opinions.",
    "Looking for house numbers like it is a scavenger hunt with liability.",
    "Night shift tip: If the witness says 'they were fine before bed,' pin down an actual timeline.",
    "Building the call while the moon supervises.",
    "The crew is caffeinated enough to chart, not enough to trust vibes alone.",
    "Night shift tip: Reduced staffing changes scene flow. Say out loud what help you will need early.",
  ];

  const [error, setError] = useState("");
  const [collapsedSections, setCollapsedSections] = useState({});
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 900px)").matches : false
  );

  const isNightShift = formData.shiftMode === "Night Shift";
  const nextShiftModeLabel = isNightShift ? "Day Shift" : "Night Shift";
  const isShiftToggleDisabled = Boolean(scenario);
  const shiftToggleTitle = isNightShift
    ? "Switch to Day Shift: brighter theme and daytime call flavor"
    : "Switch to Night Shift: dark theme and overnight call flavor";
  const isFormModified = 
    formData.semester !== "3" ||
    formData.type !== "Medical" ||
    formData.environment !== "Urban" ||
    formData.complexity !== "Simple" ||
    formData.scenarioFriction !== "Clean" ||
    formData.generationDepth !== "Quick Draft" ||
    formData.shiftMode !== "Day Shift" ||
    formData.customPrompt !== "";
  const canReset = scenario || isFormModified;
  const styles = buildStyles(isMobile);

  useEffect(() => {
    if (!loading) return;
    const activeJokes = isNightShift ? nightShiftJokes : dayLoadingJokes;
    setJokeIndex(Math.floor(Math.random() * activeJokes.length));
    const interval = setInterval(() => {
      setJokeIndex((prev) => (prev + 1) % activeJokes.length);
    }, 11000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, isNightShift]);

  useEffect(() => {
    if (!loading) {
      setDotCount(1);
      return;
    }

    const dotsInterval = setInterval(() => {
      setDotCount((prev) => (prev % 3) + 1);
    }, 500);

    return () => clearInterval(dotsInterval);
  }, [loading]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", isNightShift ? "night" : "day");

    return () => {
      document.documentElement.setAttribute("data-theme", "day");
    };
  }, [isNightShift]);

  useEffect(() => {
    const spinnerStyle = document.createElement("style");
    spinnerStyle.innerHTML = `
      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
      .spin {
        animation: spin 1s linear infinite;
      }

      @keyframes loadingMessagePop {
        0% {
          opacity: 0;
          transform: translateY(6px) scale(0.985);
        }
        65% {
          opacity: 1;
          transform: translateY(-1px) scale(1.006);
        }
        100% {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }

      .loading-message-pop {
        animation: loadingMessagePop 480ms ease;
      }

      .a11y-focus:focus-visible {
        outline: 3px solid #0ea5e9;
        outline-offset: 2px;
        box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.25);
      }
    `;
    document.head.appendChild(spinnerStyle);

    return () => {
      document.head.removeChild(spinnerStyle);
    };
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 900px)");
    const onChange = (event) => setIsMobile(event.matches);

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", onChange);
    } else {
      mediaQuery.addListener(onChange);
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener("change", onChange);
      } else {
        mediaQuery.removeListener(onChange);
      }
    };
  }, []);

  useEffect(() => {
    document.body.style.overflowY = "auto";
    document.documentElement.style.overflowY = "auto";

    return () => {
      document.body.style.overflowY = "";
      document.documentElement.style.overflowY = "";
    };
  }, []);


  useEffect(() => {
    const closeCueOnOutsideClick = (event) => {
      const target = event.target;
      if (target instanceof Element && target.closest("[data-cue-toggle='true'], [data-cue-popover='true']")) {
        return;
      }
      };

    document.addEventListener("pointerdown", closeCueOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeCueOnOutsideClick);
  }, []);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key !== "Escape") return;
        setSelectedECGImage(null);
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const handleChange = (e) => {
    const { name, type, checked, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const toggleShiftMode = () => {
    setFormData((prev) => ({
      ...prev,
      shiftMode: prev.shiftMode === "Night Shift" ? "Day Shift" : "Night Shift",
    }));
  };

  const capitalizeFirstLetter = (string) =>
    String(string || "")
      .replace(/[_-]+/g, " ")
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/^./, (ch) => ch.toUpperCase());

  const sanitizePdfText = (value) => {
    const stripNonPrintableAscii = (input) =>
      Array.from(input)
        .filter((char) => {
          const code = char.charCodeAt(0);
          return code === 9 || code === 10 || code === 13 || (code >= 32 && code <= 126);
        })
        .join("");

    return String(value ?? "")
      .replace(/\*\(💡(?:[a-z]+\|)?\s*.+?\s*\)\*/gi, "")
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .split("\n")
      .map((line) => stripNonPrintableAscii(line))
      .join("\n")
      .replace(/\r\n/g, "\n")
      .split("\n")
      .map((line) => line.replace(/\s{2,}/g, " ").trimEnd())
      .join("\n")
      .trim();
  };

  const formatFieldValue = (fieldValue, depth = 0) => {
    if (fieldValue === null || fieldValue === undefined || fieldValue === "") return "";

    const indent = "  ".repeat(depth);

    if (typeof fieldValue === "object" && !Array.isArray(fieldValue)) {
      return Object.entries(fieldValue)
        .map(([key, value]) => {
          if (value === null || value === undefined || value === "") return "";

          if (typeof value === "object") {
            const nested = formatFieldValue(value, depth + 1);
            return nested ? `${indent}${formatLabel(key)}:\n${nested}` : "";
          }
          return `${indent}${formatLabel(key)}: ${sanitizePdfText(value)}`;
        })
        .filter(Boolean)
        .join("\n");
    }

    if (Array.isArray(fieldValue)) {
      return fieldValue
        .map((item) => {
          if (item === null || item === undefined || item === "") return "";
          if (typeof item === "object") {
            const nested = formatFieldValue(item, depth + 1);
            return nested ? `${indent}-\n${nested}` : "";
          }
          return `${indent}- ${sanitizePdfText(item)}`;
        })
        .filter(Boolean)
        .join("\n");
    }

    return `${indent}${sanitizePdfText(fieldValue)}`;
  };

  const formatLabel = (label) => {
    const normalized = String(label || "")
      .replace(/[_-]+/g, " ")
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .replace(/\s+/g, " ")
      .trim();

    const acronyms = new Map([
      ["ecg", "ECG"],
      ["gcs", "GCS"],
      ["bp", "BP"],
      ["hr", "HR"],
      ["rr", "RR"],
      ["spo2", "SpO2"],
      ["opqrst", "OPQRST"],
      ["sample", "SAMPLE"],
      ["iv", "IV"]
    ]);

    return normalized
      .split(" ")
      .map((word) => {
        const lower = word.toLowerCase();
        if (acronyms.has(lower)) return acronyms.get(lower);
        return lower.charAt(0).toUpperCase() + lower.slice(1);
      })
      .join(" ");
  };

  const toggleSection = (section) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleReset = () => {
    setFormData({
      semester: "3",
      type: "Medical",
      environment: "Urban",
      complexity: "Simple",
      generationDepth: "Quick Draft",
      scenarioFriction: "Clean",
      shiftMode: "Day Shift",
        customPrompt: "",
    });
    setScenario(null);
    setSelectedECGImage(null);
    setCollapsedSections({});
    setError("");
  };

  const handleSubmit = async () => {
    if (formData.customPrompt.trim() === "It's my birthday!") {
      setBirthdayMode(true);
      setTimeout(() => setBirthdayMode(false), 7500); // triple the time
      return;
    }

    // Werewolf Easter egg
    if (
      formData.semester === "4" &&
      formData.type === "Environmental" &&
      formData.environment === "Wilderness" &&
      formData.complexity === "Complex" &&
      formData.shiftMode === "Night Shift" &&
      formData.customPrompt.trim().toLowerCase() === "howl"
    ) {
      setScenario({
        title: "Night Shift: Full Moon Lycanthropy in the Wilderness",
        generationMetadata: {
          semester: "4",
          complexity: "Complex",
          callType: "Environmental",
          environment: "Wilderness",
          hasMeds: false,
          vitalSetCount: 3,
          cueDensity: 0
        },
        scenarioIntro: "A foggy night in the deep woods. The full moon is high, and your radio crackles: 'Unusual animal activity, possible medical emergency.' Locals whisper of howls and glowing eyes...",
        callInformation: {
          type: "Environmental",
          location: "Remote forest campsite",
          time: "00:13",
          dispatchNotes: "Camper howling, excessive hair, torn clothing, friends terrified",
          hazardsOrFlags: "Dense forest, full moon, risk of fleas, silver jewelry present",
          crewNotes: "Night shift lycanthropy. Prioritize scene safety, humor, and lunar protocol compliance.",
          environment: "Wilderness",
          ecgInterpretation: "Sinus tachycardia with occasional howls"
        },
        incidentNarrative: "Crew arrives to find a 30-something camper, now suspiciously hairy, howling at the moon and chasing squirrels. Friends report he became 'extra furry' and started quoting Shakespeare in a Transylvanian accent. Patient denies alcohol, but requests a rare steak and a brush.",
        patientPresentation: "Patient is upright, pacing in circles, tail wagging, eyes glowing yellow. Complains of 'sudden urge to chase wildlife and an insatiable hunger for moon pies.'",
        patientDemographics: {
          age: "??? (appears 30s, but lunar-dependent)",
          sex: "Lycanthropic",
          weight: "Varies with lunar cycle",
          appearance: "Extremely hirsute, elongated canines, stylish torn flannel",
          chiefComplaint: "Howling, excessive hair, existential dread"
        },
        sceneArrival: {
          sceneEnergy: "Eerie, foggy, friends hiding in tent, squirrels on high alert"
        },
        firstImpression: {
          initialRedFlags: ["Howling at moon", "Glowing eyes", "Tail present", "Nighttime presentation"]
        },
        initialAssessment: {
          immediatePriorities: ["Scene safety (avoid silver)", "De-escalation with treats", "Assess for fleas", "Monitor for transformation"]
        },
        historyGathering: {
          sceneContextClues: ["Recent full moon", "No prior history of lycanthropy", "Friends report sudden hair growth"]
        },
        secondaryAssessment: {
          evolvingFindings: ["Howling intensifies with moonrise; risk of chasing ambulance"]
        },
        additionalAssessments: ["Check for collar, rabies tag, or silver allergy"],
        transportPhase: {
          handoffConsiderations: "Communicate lunar phase, fur density, and response to belly rubs."
        },
        opqrst: {
          onset: "At moonrise",
          provocation: "Worse with silver, better with beef jerky",
          quality: "Howling, furry, hungry",
          radiation: "Tail, ears, and ego",
          severity: "Severe (by local squirrel report)",
          time: "Acute full moon event"
        },
        sample: {
          signsAndSymptoms: "Howling, fur, glowing eyes, hunger",
          allergies: "Silver, garlic bread",
          medications: "None (prefers herbal remedies)",
          pastMedicalHistory: "No prior transformations",
          lastOralIntake: "Raw steak, possibly a shoe",
          eventsLeadingUp: "Camping, then sudden moonrise and transformation"
        },
        medications: [],
        allergies: ["Silver", "Garlic bread"],
        pastMedicalHistory: [],
        physicalExam: {
          airway: "Patent, occasional howling",
          breathing: "Panting, RR 24",
          circulation: "Tachycardic, strong pulse, BP 140/90",
          neuro: "Alert, oriented to lunar cycle, distractible by tennis balls",
          skin: "Warm, furry, diaphoretic, flea risk"
        },
        vitalSigns: {
          HR: 120,
          RR: 24,
          BP: "140/90",
          SpO2: 99,
          Temp: 38.5,
          GCS: 15,
          Bgl: 5.2,
          ecgInterpretation: "Sinus tachycardia with P-waves occasionally replaced by 'AWOOO'"
        },
        caseProgression: {
          withProperTreatment: "Patient calms with beef jerky, howling subsides, agrees to transport if allowed to stick head out ambulance window.",
          withoutProperTreatment: "Attempts to flee, may bite tires, risk of full pack transformation.",
          withIncorrectTreatment: "If offered silver stethoscope, patient howls and flees into woods."
        },
        expectedTreatment: [
          "Avoid silver instruments",
          "Offer calming words, beef jerky, and a safe space to howl",
          "Monitor until sunrise",
          "Play 'Werewolves of London' if requested"
        ],
        protocolNotes: [
          "No protocol for supernatural transformations. Consult folklore as needed.",
          "Scene safety: Avoid silver, garlic, and full moons on shift bid."
        ],
        teachersPoints: "Lycanthropy requires creative scene management, humor, and a willingness to improvise. Always check the lunar calendar before your shift.",
        clinicalReasoning: "This patient is experiencing acute full-moon-induced lycanthropy. Early application of humor, snacks, and scene safety are critical. Ontario BLS/ALS PCS compliance is recommended, but folklore consultation may be required.",
        scenarioRationale: "Teaches adaptation, improvisation, and the importance of laughter in paramedicine. Also, never underestimate the power of a good treat.",
        learningObjectives: [
          "Recognize supernatural presentations and maintain professionalism",
          "Apply scene safety and creative problem-solving",
          "Communicate effectively with anxious bystanders and woodland creatures"
        ],
        selfReflectionPrompts: [
          "How did you keep the patient and crew safe?",
          "What clues pointed to lycanthropy versus other causes?",
          "How did you manage the scene and bystanders?",
          "What would you do differently if the patient transformed again?"
        ],
        grsAnchors: {
          situationalAwareness: {
            3: [
              "Recognizes howling but underestimates lunar risk.",
              "Misses silver jewelry as a hazard.",
              "Delays beef jerky administration."
            ],
            5: [
              "Identifies lycanthropy and scene risk.",
              "Maintains calm, manages friends, and plans for sunrise.",
              "Balances scene control with clinical care and humor."
            ],
            7: [
              "Anticipates rapid transformation and leads a coordinated snack-based response.",
              "Integrates lunar, physiologic, and social factors.",
              "Maintains high awareness of subtle changes and adjusts care dynamically."
            ]
          },
          historyGathering: {
            3: [
              "Obtains only a partial story from friends (too busy hiding).",
              "Misses timeline and prior full moons.",
              "Relies on patient for answers despite howling."
            ],
            5: [
              "Uses friends to clarify timeline, symptoms, and prior transformations.",
              "Confirms no prior history and identifies sudden onset.",
              "Integrates collateral history into risk assessment."
            ],
            7: [
              "Extracts a concise, high-value timeline despite scene stress.",
              "Uses friend support efficiently to clarify risk and guide care.",
              "Integrates history directly into lycanthropy and transport decisions."
            ]
          },
          patientAssessment: {
            3: [
              "Performs a basic assessment but incompletely trends fur density and risk status.",
              "Misses the significance of tail as a red flag.",
              "Reassessment is inconsistent."
            ],
            5: [
              "Performs structured lycanthropy and risk assessment.",
              "Uses serial reassessment to track improvement or worsening.",
              "Recognizes tail as a warning sign and escalates care."
            ],
            7: [
              "Builds a coherent assessment from lycanthropy, risk, and scene context.",
              "Detects subtle changes early and adjusts plan proactively.",
              "Maintains high-quality reassessment cadence."
            ]
          },
          decisionMaking: {
            3: [
              "Removes friends from scene but delays beef jerky.",
              "Anchors on rabies as cause rather than lycanthropy.",
              "Transport decision is delayed or not adjusted after persistent howling."
            ],
            5: [
              "Keeps scene safe, initiates beef jerky, and plans for sunrise.",
              "Plans rapid transport and keeps friends informed.",
              "Adjusts care plan based on reassessment."
            ],
            7: [
              "Executes a decisive, well-sequenced plan prioritizing snacks, safety, and transport.",
              "Anticipates escalation and prepares for escalation before instability occurs.",
              "Leads team and friends in a coordinated, high-quality response."
            ]
          },
          communication: {
            3: [
              "Provides basic updates but does not clearly explain urgency to friends.",
              "Role allocation during management is inconsistent.",
              "Handoff omits key lunar and trend details."
            ],
            5: [
              "Communicates clearly with friends about lycanthropy, beef jerky, and transport plan.",
              "Keeps friends informed and calm.",
              "Delivers organized handoff with timeline, lycanthropy, and response."
            ],
            7: [
              "Uses calm, directive communication to coordinate care in a stressful night setting.",
              "Maintains closed-loop communication across all phases.",
              "Provides a concise, high-value handoff for lycanthropy management."
            ]
          }
        },
        customPrompt: "Howl"
      });
      setError("");
        setSelectedECGImage(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    setScenario(null);
    setSelectedECGImage(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const baseURL = process.env.REACT_APP_API_BASE_URL || "http://localhost:10000";
    const payload = {
      ...formData,
      includeTeachingCues: false,
    };

    try {
      const response = await axios.post(`${baseURL}/api/generate-scenario`, payload, { signal: controller.signal });
      const generated = response.data;

      if (generated.ecgInterpretation && generated.vitalSigns && !generated.vitalSigns.ecgInterpretation) {
        generated.vitalSigns.ecgInterpretation = generated.ecgInterpretation;
      }

      setScenario(generated);
    } catch (err) {
      if (axios.isCancel(err) || err?.name === "CanceledError" || err?.code === "ERR_CANCELED") {
        // User cancelled - silently dismiss
      } else {
        const message =
          err?.response?.data?.details ||
          err?.response?.data?.error ||
          err?.message ||
          "Scenario generation failed. Please check backend server.";
        setError(message);
      }
    } finally {
      abortControllerRef.current = null;
      setLoading(false);
    }
  };

  const exportToPDF = () => {
    if (!scenario) return;

    const doc = new jsPDF({ unit: "mm", format: "a4" });

    const palette = {
      ink: [31, 41, 51],
      inkSoft: [51, 65, 85],
      orange: [242, 140, 40],
      orangeDeep: [201, 111, 22],
      teal: [40, 124, 122],
      tealDeep: [31, 101, 100],
      paper: [247, 243, 234],
      cardBg: [255, 253, 249],
      warmAccent: [255, 247, 234],
      neutralText: [75, 93, 106],
      mutedText: [100, 112, 125],
      line: [222, 214, 200],
      linesoft: [240, 236, 228],
    };

    const pageHeight = doc.internal.pageSize.getHeight();
    const pageWidth = doc.internal.pageSize.getWidth();
    const marginX = 18;
    const marginY = 22;
    const textColumnX = marginX + 4;
    const maxLineWidth = pageWidth - marginX - textColumnX;
    const bodySize = 9.8;
    const bodyLH = 5.6;
    const footerY = pageHeight - 11;
    let y = marginY;

    const documentTitle = sanitizePdfText(scenario.title || "Untitled Scenario") || "Untitled Scenario";
    const exportedAt = new Date().toLocaleString();
    const safeFileName = sanitizePdfText(documentTitle)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "scenario";

    // Keys to exclude from PDF entirely
    const excludedKeys = new Set([
      "title",
      "ecgRhythm",
      "ecgFindings",
      "vocationalLearningOutcomes",
      "generationMetadata",
      "customPrompt",
      "directiveSources",
      "firstImpression",
      "initialAssessment",
      "historyGathering",
      "secondaryAssessment",
      "additionalAssessments",
      "transportPhase",
      "medications",
      "allergies",
      "pastMedicalHistory",
    ]);

    // Phase group order matching SECTION_GROUPS
    const phaseOrder = [
      // The Call
      "scenarioIntro",
      "callInformation",
      "sceneArrival",
      "patientDemographics",
      "patientPresentation",
      "incidentNarrative",
      "opqrst",
      "sample",
      "physicalExam",
      "vitalSigns",
      // What Was Happening
      "clinicalReasoning",
      "caseProgression",
      "scenarioRationale",
      // Expected Management
      "expectedTreatment",
      "protocolNotes",
      // Teaching Points
      "teachersPoints",
      "learningObjectives",
      "instructorGuidance",
      // Self-Assessment
      "selfReflectionPrompts",
      "grsAnchors",
    ];

    // Phase group labels for dividers
    const phaseGroupMap = {
      scenarioIntro: "The Call",
      callInformation: "The Call",
      sceneArrival: "The Call",
      patientDemographics: "The Call",
      patientPresentation: "The Call",
      incidentNarrative: "The Call",
      opqrst: "The Call",
      sample: "The Call",
      physicalExam: "The Call",
      vitalSigns: "The Call",
      clinicalReasoning: "What Was Happening",
      caseProgression: "What Was Happening",
      scenarioRationale: "What Was Happening",
      expectedTreatment: "Expected Management",
      protocolNotes: "Expected Management",
      teachersPoints: "Teaching Points",
      learningObjectives: "Teaching Points",
      instructorGuidance: "Teaching Points",
      selfReflectionPrompts: "Self-Assessment",
      grsAnchors: "Self-Assessment",
    };

    // Build merged sceneArrival + firstImpression content
    const buildSceneArrivalContent = () => {
      const parts = [];
      if (scenario.sceneArrival) parts.push(formatFieldValue(scenario.sceneArrival));
      if (scenario.firstImpression) {
        parts.push("First Impression:");
        parts.push(formatFieldValue(scenario.firstImpression));
      }
      return parts.filter(Boolean).join("\n");
    };

    // Build ordered section entries
    const orderedKeys = [...new Set([...phaseOrder, ...Object.keys(scenario)])];
    const sectionEntries = orderedKeys
      .filter((key) => {
        if (excludedKeys.has(key)) return false;
        if (!(key in scenario)) return false;
        return true;
      })
      .map((key) => {
        const rawValue = key === "sceneArrival"
          ? buildSceneArrivalContent()
          : formatFieldValue(scenario[key]);
        if (!rawValue) return null;
        return {
          key,
          label: TITLE_MAP[key] || capitalizeFirstLetter(key),
          formattedValue: rawValue,
          phase: phaseGroupMap[key] || null,
        };
      })
      .filter(Boolean);

    const needsNewPage = (h) => {
      if (y + h > footerY - 4) {
        doc.addPage();
        y = marginY;
        drawContentHeader();
        return true;
      }
      return false;
    };

    const drawCoverBackground = () => {
      doc.setFillColor(...palette.paper);
      doc.rect(0, 0, pageWidth, pageHeight, "F");
      // Subtle warm gradient strip at top
      doc.setFillColor(242, 140, 40);
      doc.rect(0, 0, pageWidth, 3, "F");
    };

    const drawContentHeader = () => {
      doc.setFillColor(...palette.ink);
      doc.rect(0, 0, pageWidth, 15, "F");
      doc.setFillColor(...palette.orange);
      doc.rect(0, 0, 3.5, 15, "F");

      doc.setFont(undefined, "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(244, 250, 252);
      doc.text("VitalNotes Scenario Generator", textColumnX, 9.5);

      doc.setFont(undefined, "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(190, 218, 224);
      doc.text("Ontario PCP simulation scenario", textColumnX, 13.2);

      doc.setDrawColor(...palette.line);
      doc.setLineWidth(0.18);
      doc.line(0, 15, pageWidth, 15);
    };

    const drawPageFooter = (pageNum, total) => {
      doc.setFont(undefined, "normal");
      doc.setFontSize(7.8);
      doc.setTextColor(...palette.mutedText);
      doc.setDrawColor(...palette.line);
      doc.setLineWidth(0.18);
      doc.line(marginX, footerY, pageWidth - marginX, footerY);
      doc.text(documentTitle, marginX, footerY + 4.2);
      doc.text(`Page ${pageNum} of ${total}`, pageWidth - marginX, footerY + 4.2, { align: "right" });
    };

    const drawPhaseDivider = (label) => {
      needsNewPage(12);
      y += 5;
      doc.setFillColor(...palette.warmAccent);
      doc.roundedRect(marginX - 2, y - 5, pageWidth - marginX * 2 + 4, 8, 2, 2, "F");
      doc.setFillColor(...palette.orange);
      doc.rect(marginX - 2, y - 5, 3, 8, "F");
      doc.setFont(undefined, "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(...palette.orangeDeep);
      doc.text(label.toUpperCase(), textColumnX, y);
      y += 6;
      doc.setDrawColor(...palette.line);
      doc.setLineWidth(0.15);
      doc.line(textColumnX, y, pageWidth - marginX, y);
      y += 4;
    };

    const drawSectionHeading = (label) => {
      needsNewPage(14);
      y += 3;
      doc.setFillColor(255, 253, 249);
      doc.roundedRect(marginX - 1.5, y - 4.5, pageWidth - marginX * 2 + 3, 8, 1.8, 1.8, "F");
      doc.setFillColor(...palette.orange);
      doc.rect(marginX - 1.5, y - 4.5, 2.5, 8, "F");
      doc.setFont(undefined, "bold");
      doc.setFontSize(11);
      doc.setTextColor(...palette.ink);
      doc.text(label, textColumnX, y);
      y += 2;
      doc.setDrawColor(...palette.line);
      doc.setLineWidth(0.2);
      doc.line(textColumnX, y, pageWidth - marginX, y);
      y += 5;
    };

    // -- Cover page ----------------------------------------------------------
    drawCoverBackground();
    drawContentHeader();

    y = 26;
    doc.setFont(undefined, "bold");
    doc.setFontSize(22);
    doc.setTextColor(...palette.ink);
    const titleWrapped = doc.splitTextToSize(documentTitle, maxLineWidth);
    doc.text(titleWrapped, textColumnX, y);
    y += titleWrapped.length * 9 + 4;

    // Orange accent line under title
    doc.setDrawColor(...palette.orange);
    doc.setLineWidth(1.2);
    doc.line(textColumnX, y, textColumnX + 40, y);
    doc.setLineWidth(0.2);
    doc.setDrawColor(...palette.line);
    y += 6;

    // Meta card
    const metaFields = [
      ["Shift", sanitizePdfText(formData.shiftMode)],
      ["Semester", sanitizePdfText(formData.semester)],
      ["Call Type", sanitizePdfText(scenario?.callInformation?.type || formData.type)],
      ["Environment", sanitizePdfText(formData.environment)],
      ["Complexity", sanitizePdfText(formData.complexity)],
      ["Generation Depth", sanitizePdfText(formData.generationDepth)],
    ];
    const visibleMetaFields = metaFields.filter(([, val]) => Boolean(val));
    const metaRowHeight = 6.5;
    const metaPaddingTop = 4.5;
    const metaPaddingBottom = 3.5;
    const metaCardY = y - 3;
    const metaCardHeight = metaPaddingTop + metaPaddingBottom + visibleMetaFields.length * metaRowHeight;
    const metaLabelX = textColumnX;
    const metaValueX = textColumnX + 38;

    doc.setFillColor(...palette.warmAccent);
    doc.roundedRect(marginX - 2, metaCardY, pageWidth - marginX * 2 + 4, metaCardHeight, 3, 3, "F");
    doc.setDrawColor(...palette.line);
    doc.setLineWidth(0.15);
    doc.roundedRect(marginX - 2, metaCardY, pageWidth - marginX * 2 + 4, metaCardHeight, 3, 3, "S");

    let metaY = metaCardY + metaPaddingTop;
    visibleMetaFields.forEach(([label, val], idx) => {
      doc.setFont(undefined, "bold");
      doc.setFontSize(9);
      doc.setTextColor(...palette.tealDeep);
      doc.text(`${label}:`, metaLabelX, metaY);
      doc.setFont(undefined, "normal");
      doc.setTextColor(...palette.neutralText);
      doc.text(val, metaValueX, metaY);
      if (idx < visibleMetaFields.length - 1) {
        doc.setDrawColor(...palette.linesoft);
        doc.setLineWidth(0.1);
        doc.line(metaLabelX, metaY + 2, pageWidth - marginX - 2, metaY + 2);
      }
      metaY += metaRowHeight;
    });

    y = metaCardY + metaCardHeight + 5;
    doc.setDrawColor(...palette.line);
    doc.setLineWidth(0.15);
    doc.line(textColumnX, y, pageWidth - marginX, y);
    y += 5;

    doc.setFont(undefined, "normal");
    doc.setFontSize(8);
    doc.setTextColor(...palette.mutedText);
    doc.text(`Generated: ${exportedAt}`, textColumnX, y);
    y += 10;

    // -- Sections -------------------------------------------------------------
    let lastPhase = null;

    sectionEntries.forEach((entry) => {
      // Draw phase divider when group changes
      if (entry.phase && entry.phase !== lastPhase) {
        drawPhaseDivider(entry.phase);
        lastPhase = entry.phase;
      }

      drawSectionHeading(entry.label);

      const rawLines = String(entry.formattedValue).split("\n");
      rawLines.forEach((rawLine) => {
        const expanded = rawLine.replace(/\t/g, "  ");
        const trimmed = expanded.trim();
        if (!trimmed) {
          y += 2;
          return;
        }

        const isBullet = trimmed.startsWith("- ");
        const isLabelLine = /^[A-Z][^:]{1,35}:\s*$/.test(trimmed);
        const sanitizedLine = sanitizePdfText(isBullet ? trimmed.slice(2) : trimmed);
        const shouldBulletize = !isLabelLine;
        const displayText = shouldBulletize ? `–  ${sanitizedLine}` : sanitizedLine;
        const indent = shouldBulletize ? 4 : 0;
        const textX = textColumnX + indent;
        const textWidth = maxLineWidth - indent;

        doc.setFont(undefined, isLabelLine ? "bold" : "normal");
        doc.setFontSize(bodySize);
        doc.setTextColor(...palette.neutralText);

        const wrapped = doc.splitTextToSize(displayText, textWidth);
        wrapped.forEach((line) => {
          needsNewPage(bodyLH);
          doc.text(line, textX, y);
          y += bodyLH;
        });
      });

      y += 2;
    });

    // -- Footer on every page -------------------------------------------------
    const totalPages = doc.getNumberOfPages();
    for (let p = 1; p <= totalPages; p += 1) {
      doc.setPage(p);
      drawPageFooter(p, totalPages);
    }

    doc.save(`${safeFileName}.pdf`);
  };

  const renderSafeContent = (data, parentKey = "root") => {
    if (typeof data === "string") {
      const textWithoutCues = data
        .replace(/\*\(💡(?:[a-z]+\|)?\s*.+?\s*\)\*/gi, "")
        .replace(/\s{2,}/g, " ")
        .trim();

      return <span>{textWithoutCues}</span>;
    }

    if (Array.isArray(data)) {
  return (
    <ul style={{ paddingLeft: "1rem", marginTop: "0.5rem" }}>
      {data.map((item, index) => {
        let parsed = item;
        if (typeof item === "string" && item.trimStart().startsWith("{")) {
          try { parsed = JSON.parse(item); } catch (_) {}
        }
        return <li key={index}>{renderSafeContent(parsed, `${parentKey}-${index}`)}</li>;
      })}
    </ul>
  );
}

    if (parentKey === "grsAnchors" && data && typeof data === "object" && !Array.isArray(data)) {
      const domainLabels = {
        situationalAwareness: "Situational Awareness",
        patientAssessment: "Patient Assessment",
        historyGathering: "History Gathering",
        decisionMaking: "Decision Making",
        proceduralSkill: "Procedural Skill",
        resourceUtilization: "Resource Utilization",
        communication: "Communication",
      };
      const scoreLabels = { "3": "Score 3 — Unsafe to Borderline", "5": "Score 5 — Competent", "7": "Score 7 — Exceptional" };
      const scoreColors = {
        "3": { bg: "transparent", border: "var(--vn-border)", label: "var(--vn-muted-text)" },
        "5": { bg: "transparent", border: "var(--vn-border)", label: "var(--vn-muted-text)" },
        "7": { bg: "transparent", border: "var(--vn-border)", label: "var(--vn-accent-text)" },
      };
      return (
        <div>
          {Object.entries(data).map(([domain, scores]) => (
            <div key={domain} style={{ marginBottom: "1.25rem" }}>
              <div style={{
                fontSize: "0.95rem",
                fontWeight: 800,
                color: "var(--vn-ink)",
                borderLeft: "4px solid var(--vn-teal)",
                paddingLeft: "0.6rem",
                marginBottom: "0.6rem",
                fontFamily: "var(--vn-font-body)",
              }}>
                {domainLabels[domain] || domain}
              </div>
              {["3", "5", "7"].map((score) => {
                const bullets = Array.isArray(scores[score]) ? scores[score] : [];
                if (!bullets.length) return null;
                const colors = scoreColors[score] || scoreColors["5"];
                return (
                  <div key={score} style={{
                    backgroundColor: colors.bg,
                    border: `1px solid ${colors.border}`,
                    borderRadius: "8px",
                    padding: "0.6rem 0.8rem",
                    marginBottom: "0.4rem",
                  }}>
                    <div style={{
                      fontSize: "0.72rem",
                      fontWeight: 800,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: colors.label,
                      marginBottom: "0.35rem",
                    }}>
                      {scoreLabels[score]}
                    </div>
                    <ul style={{ margin: 0, paddingLeft: "1.2rem" }}>
                      {bullets.map((bullet, i) => (
                        <li key={i} style={{
                          fontSize: "0.88rem",
                          color: "var(--vn-ink)",
                          marginBottom: "0.2rem",
                          lineHeight: "1.5",
                        }}>
                          {bullet}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      );
    }

    if (typeof data === "object" && data !== null) {
      return (
        <ul style={{ paddingLeft: "1rem", marginTop: "0.5rem" }}>
          {Object.entries(data).map(([key, value], index) => {
            const contextKey = `${parentKey}-${key}`;

            if (
              key === "ecgInterpretation" &&
              (parentKey === "firstSet" ||
               parentKey === "secondSet" ||
               parentKey === "additionalSets" ||
               String(parentKey).toLowerCase().includes("set"))
            ) {
              return null;
            }

            if (key === "ecgInterpretation") {
              const interpretation = typeof value === "string" ? value : "";
              const rawECG = interpretation.replace(/[\u0080-\uFFFF]/g, '').trim();
              // eslint-disable-next-line no-unused-vars
              const ecgImageUrl = !!rawECG && rawECG.length > 3;

              const labelPrefix = parentKey?.toLowerCase().includes("second")
                ? "Second Set"
                : parentKey?.toLowerCase().includes("first")
                  ? "First Set"
                  : "";

              return (
                <li key={index} style={{ listStyleType: "circle", paddingLeft: "0.05rem" }}>
                  <strong>
                    {labelPrefix ? `${labelPrefix} ECG Interpretation` : "ECG Interpretation"}:
                  </strong>{" "}
                  {rawECG ? (
                    <button
                      type="button"
                      className="a11y-focus"
                      aria-label="Open ECG image"
                      title="Open ECG image"
                      style={{
                        cursor: "pointer",
                        textDecoration: "underline",
                        color: "var(--vn-teal)",
                        marginLeft: "6px",
                        marginRight: "6px",
                        background: "transparent",
                        border: "none",
                        padding: isMobile ? "0.2rem 0.35rem" : "0.1rem 0.25rem",
                        borderRadius: "6px",
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedECGImage({ rhythm: rawECG, hr: parseECGHR(data.hr) });
                      }}
                    >
                      View Strip
                    </button>
     ) : null}
                  {rawECG}
                </li>
              );
            }

            if (key === "additionalSets" && Array.isArray(value)) {
              return value.map((setItem, setIndex) => (
                <li key={`additionalSet-${setIndex}`}>
                  <strong>Additional Set {setIndex + 1}{setItem?.context ? ` - ${setItem.context}` : ""}:</strong>
                  {renderSafeContent(
                    Object.fromEntries(Object.entries(setItem).filter(([k]) => k !== "context")),
                    `${contextKey}-${setIndex}`
                  )}
                </li>
              ));
            }

            return (
              <li key={index}>
                <strong>{formatLabel(key)}:</strong> {renderSafeContent(value, contextKey)}
              </li>
            );
          })}
        </ul>
      );
    }

    return <span>{String(data)}</span>;
  };

  const renderPillGroup = (label, options, currentValue, onChange) => {
    if (!USE_PILL_TOGGLES) {
      return (
        <div style={styles.fieldRow}>
          <label style={styles.pillLabel}>{label}</label>
          <select
            style={styles.select}
            value={currentValue}
            onChange={(e) => onChange(e.target.value)}
          >
            {options.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>
      );
    }
    return (
      <div style={styles.fieldRow}>
        <span style={styles.pillLabel}>{label}</span>
        <div style={styles.pillGroup}>
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              style={currentValue === opt ? styles.pillOptionActive : styles.pillOption}
              onClick={() => onChange(opt)}
              disabled={loading}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>
    );
  };

  const renderSection = (title, content) => {
    if (title === "ecgRhythm") {
      const vitalSigns = scenario.vitalSigns;
      if (!vitalSigns) return null;

      const sets = [
        { label: vitalSigns.firstSet?.context || "Initial Assessment",
          ecg: vitalSigns.firstSet?.ecgInterpretation,
          hr: vitalSigns.firstSet?.hr },
        { label: vitalSigns.secondSet?.context || "Reassessment",
          ecg: vitalSigns.secondSet?.ecgInterpretation,
          hr: vitalSigns.secondSet?.hr },
        ...(Array.isArray(vitalSigns.additionalSets)
          ? vitalSigns.additionalSets.map((s, i) => ({
              label: s.context || `Additional Set ${i + 1}`,
              ecg: s.ecgInterpretation,
              hr: s.hr,
            }))
          : []),
      ].filter((s) => s.ecg && s.ecg.trim());

      if (!sets.length) return null;

      const cleanEcg = (val) =>
        val ? val.replace(/[^\x20-\x7E]/g, "").trim() : "";

      return (
        <div style={{ ...styles.card }} key="ecgRhythm">
          <h3 className="scenario-section-h2">ECG / Rhythm</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            {sets.map((s, i) => {
              const clean = cleanEcg(s.ecg);
              const hasImage = !!clean && clean.length > 2;
              return (
                <div key={i} style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "0.75rem",
                  padding: "0.5rem 0.6rem",
                  borderRadius: "8px",
                  border: "1px solid var(--vn-border)",
                  backgroundColor: "var(--vn-card-bg)",
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: "0.74rem",
                      fontWeight: 700,
                      color: "var(--vn-muted-text)",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      marginBottom: "0.2rem",
                    }}>
                      {s.label}
                    </div>
                    <div style={{
                      fontSize: "0.95rem",
                      fontWeight: 600,
                      color: "var(--vn-ink)",
                    }}>
                      {clean}
                    </div>
                  </div>
                  {hasImage && (
                    <button
                      type="button"
                      onClick={() => setSelectedECGImage({ rhythm: clean, hr: parseECGHR(s.hr) })}
                      style={{
                        cursor: "pointer",
                        color: "var(--vn-teal)",
                        background: "transparent",
                        border: "none",
                        fontSize: "1.1rem",
                        padding: "0.1rem 0.25rem",
                        borderRadius: "6px",
                        flexShrink: 0,
                      }}
                      title={`View ${clean} tracing`}
                      aria-label={`View ECG for ${clean}`}
                    >
                      View Strip
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {scenario.ecgFindings && (scenario.ecgFindings.rhythmInterpretation ||
            scenario.ecgFindings.twelveLeadFindings ||
            scenario.ecgFindings.fifteenLeadFindings) && (
            <div style={{ marginTop: "0.85rem", borderTop: "1px solid var(--vn-border)", paddingTop: "0.85rem" }}>

              {scenario.ecgFindings.rhythmInterpretation && (
                <div style={{ marginBottom: "0.65rem" }}>
                  <div style={{
                    fontSize: "0.72rem", fontWeight: 700,
                    color: "var(--vn-muted-text)", textTransform: "uppercase",
                    letterSpacing: "0.06em", marginBottom: "0.25rem",
                  }}>
                    Rhythm Interpretation
                  </div>
                  <div style={{ fontSize: "0.9rem", color: "var(--vn-ink)", lineHeight: "1.6" }}>
                    {scenario.ecgFindings.rhythmInterpretation}
                  </div>
                </div>
              )}

              {(scenario.ecgFindings.twelveLeadFindings || scenario.ecgFindings.ecgType === '12-lead') && (
                <div style={{ marginBottom: "0.65rem" }}>
                  <div style={{
                    fontSize: "0.72rem", fontWeight: 700,
                    color: "var(--vn-muted-text)", textTransform: "uppercase",
                    letterSpacing: "0.06em", marginBottom: "0.25rem",
                  }}>
                    12-Lead Findings
                    <button
                      type="button"
                      style={{
                        marginLeft: "0.5rem", cursor: "pointer",
                        color: "var(--vn-teal)", background: "transparent",
                        border: "1px solid var(--vn-teal)", borderRadius: "4px",
                        fontSize: "0.68rem", padding: "0.1rem 0.4rem",
                        fontWeight: 700, verticalAlign: "middle",
                      }}
                      title="View 12-Lead ECG"
                      onClick={() => setSelectedECGImage({
                        type: '12lead',
                        ecgType: scenario.ecgFindings.ecgType,
                        rhythmInterp: scenario.vitalSigns?.firstSet?.ecgInterpretation || '',
                        twelveLeadFindings: scenario.ecgFindings.twelveLeadFindings,
                        fifteenLeadFindings: scenario.ecgFindings.fifteenLeadFindings || '',
                        hr: parseECGHR(scenario.vitalSigns?.firstSet?.hr),
                      })}
                    >
                      View Strip
                    </button>
                  </div>
                  <div style={{ fontSize: "0.9rem", color: "var(--vn-ink)", lineHeight: "1.6" }}>
                    {scenario.ecgFindings.twelveLeadFindings}
                  </div>
                </div>
              )}

              {scenario.ecgFindings.fifteenLeadFindings && (
                <div style={{ marginBottom: "0.65rem" }}>
                  <div style={{
                    fontSize: "0.72rem", fontWeight: 700,
                    color: "var(--vn-muted-text)", textTransform: "uppercase",
                    letterSpacing: "0.06em", marginBottom: "0.25rem",
                  }}>
                    15-Lead / Right-Sided Findings
                    <button
                      type="button"
                      style={{
                        marginLeft: "0.5rem", cursor: "pointer",
                        color: "var(--vn-teal)", background: "transparent",
                        border: "1px solid var(--vn-teal)", borderRadius: "4px",
                        fontSize: "0.68rem", padding: "0.1rem 0.4rem",
                        fontWeight: 700, verticalAlign: "middle",
                      }}
                      title="View 15-Lead ECG"
                      onClick={() => setSelectedECGImage({
                        type: '15lead',
                        ecgType: '15-lead',
                        rhythmInterp: scenario.vitalSigns?.firstSet?.ecgInterpretation || '',
                        twelveLeadFindings: scenario.ecgFindings.twelveLeadFindings || '',
                        fifteenLeadFindings: scenario.ecgFindings.fifteenLeadFindings,
                        hr: parseECGHR(scenario.vitalSigns?.firstSet?.hr),
                      })}
                    >
                      View Strip
                    </button>
                  </div>
                  <div style={{ fontSize: "0.9rem", color: "var(--vn-ink)", lineHeight: "1.6" }}>
                    {scenario.ecgFindings.fifteenLeadFindings}
                  </div>
                </div>
              )}

              {scenario.ecgFindings.ecgClinicalNote && (
                <div style={{
                  fontSize: "0.85rem", color: "var(--vn-muted-text)",
                  fontStyle: "italic", lineHeight: "1.6",
                  borderLeft: "3px solid var(--vn-teal)",
                  paddingLeft: "0.6rem", marginTop: "0.3rem",
                }}>
                  {scenario.ecgFindings.ecgClinicalNote}
                </div>
              )}
            </div>
          )}
        </div>
      );
    }

    if (title === "sceneArrival") {
      const sceneData = scenario.sceneArrival;
      const firstImpressionData = scenario.firstImpression;
      return (
        <div style={styles.card} key="sceneArrival">
          <h3 className="scenario-section-h2">Scene &amp; First Impression</h3>
          {sceneData && renderSafeContent(sceneData, "sceneArrival")}
          {firstImpressionData && (
            <div style={{ marginTop: "0.75rem", borderTop: "1px solid var(--vn-border)", paddingTop: "0.75rem" }}>
              <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--vn-muted-text)",
                textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.4rem" }}>
                First Impression
              </div>
              {renderSafeContent(firstImpressionData, "firstImpression")}
            </div>
          )}
        </div>
      );
    }

    const isProtocolNote = title === "protocolNotes";
    const isInstructorGuidance = title === "instructorGuidance";

    const highlightStyle = isProtocolNote
      ? {
          backgroundColor: "var(--vn-protocol-card-bg)",
          borderLeft: "5px solid var(--vn-protocol-card-border)",
          padding: "1rem",
          borderRadius: "8px",
          marginBottom: "1rem",
        }
      : isInstructorGuidance
      ? {
          backgroundColor: "var(--vn-accent-card-bg)",
          borderLeft: "5px solid var(--vn-teal)",
          padding: "1rem",
          borderRadius: "8px",
          marginBottom: "1rem",
        }
      : {};

    return (
      <div style={{ ...styles.card, ...highlightStyle }} key={title}>
        <h3 className="scenario-section-h2">{TITLE_MAP[title] || formatLabel(title)}</h3>
        {renderSafeContent(content, title)}
      </div>
    );
  };

  return (
    <div style={styles.container}>
      {birthdayMode && (
        <>
          <Confetti />
          <FlashOverlay onEnd={() => setBirthdayMode(false)} />
          <div style={{position:'fixed',top:0,left:0,width:'100vw',height:'100vh',zIndex:30001,display:'flex',alignItems:'center',justifyContent:'center',pointerEvents:'none'}}>
            <div style={{fontSize:'3rem',fontWeight:'bold',color:'#d72660',textShadow:'2px 2px 8px #fff, 0 0 20px #d72660',background:'rgba(255,255,255,0.85)',padding:'2rem 3rem',borderRadius:'2rem',boxShadow:'0 0 40px #d72660'}}>🎉 Happy Birthday! 🎉</div>
          </div>
        </>
      )}
      <div style={styles.headerBar}>
        <div style={styles.headerActionWrap}>
          <button
            type="button"
            onClick={toggleShiftMode}
            style={{
              ...styles.shiftToggle,
              opacity: isShiftToggleDisabled ? 0.55 : 1,
              cursor: isShiftToggleDisabled ? "not-allowed" : "pointer",
            }}
            className="a11y-focus"
            title={isShiftToggleDisabled ? "Shift is locked for the current scenario. Generate again to change it." : shiftToggleTitle}
            aria-label={isShiftToggleDisabled ? "Shift locked for current scenario" : shiftToggleTitle}
            disabled={isShiftToggleDisabled}
          >
            {isNightShift ? <FaSun aria-hidden="true" /> : <FaMoon aria-hidden="true" />}
            <span>{nextShiftModeLabel}</span>
          </button>
          <button
            type="button"
            onClick={handleReset}
            style={{
              ...styles.toggle,
              opacity: canReset ? 1 : 0.6,
              cursor: canReset ? "pointer" : "not-allowed"
            }}
            className="a11y-focus"
            disabled={!canReset}
            title="Reset all form fields and clear the current scenario"
            aria-label="Reset all fields"
          >
            <FaUndoAlt /> Reset
          </button>
          <button
            onClick={exportToPDF}
            style={{
              ...styles.toggle,
              opacity: scenario ? 1 : 0.6,
              cursor: scenario ? "pointer" : "not-allowed"
            }}
            className="a11y-focus"
            disabled={!scenario}
            title={scenario ? "Export current scenario to PDF" : "Generate a scenario first to enable export"}
          >
            <FaFilePdf /> Export
          </button>
        </div>
      </div>

      <div style={styles.mainLayout}>
        <div style={styles.leftPanel}>
          <div style={styles.formBox}>
            <button onClick={handleSubmit} disabled={loading} style={styles.button} className="a11y-focus">
              {loading ? <FaSpinner className="spin" /> : "Generate Scenario"}
            </button>

            {renderPillGroup("Semester", SEMESTERS, formData.semester, (val) => setFormData(prev => ({ ...prev, semester: val })))}
            {renderPillGroup("Type", SCENARIO_TYPES, formData.type, (val) => setFormData(prev => ({ ...prev, type: val })))}
            {renderPillGroup("Environment", ENVIRONMENTS, formData.environment, (val) => setFormData(prev => ({ ...prev, environment: val })))}
            {renderPillGroup("Complexity", COMPLEXITIES, formData.complexity, (val) => setFormData(prev => ({ ...prev, complexity: val })))}
            {renderPillGroup("Scenario Friction", SCENARIO_FRICTION_LEVELS, formData.scenarioFriction, (val) => setFormData(prev => ({ ...prev, scenarioFriction: val })))}
            {renderPillGroup("Generation Depth", GENERATION_DEPTHS, formData.generationDepth, (val) => setFormData(prev => ({ ...prev, generationDepth: val })))}


            <div style={styles.fieldRow}>
              <label htmlFor="customPrompt">Instructor Prompt (Optional)</label>
              <textarea
                id="customPrompt"
                name="customPrompt"
                value={formData.customPrompt}
                onChange={handleChange}
                placeholder="e.g. 'Make this a sports injury in a teen with subtle signs of head trauma.'"
                rows={3}
                maxLength={320}
                style={styles.textarea}
                className="a11y-focus"
              />
              <small style={styles.helperText}>
                Optional theme/focus. Keep it specific (setting, patient profile, or teaching emphasis). {formData.customPrompt.length}/320
              </small>
            </div>

            {error && <p style={styles.error}>{error}</p>}
          </div>
        </div>

        <div style={styles.rightPanel}>
          {showInfoSection && (
            <section className="info-section" style={{
              background: 'var(--vn-sky, #dff0f5)',
              border: '1px solid var(--vn-border, #c7d9df)',
              borderRadius: '1rem',
              padding: '1.5rem 2rem',
              marginBottom: '2rem',
              width: '88%',
              maxWidth: '1800px',
              marginLeft: 'auto',
              marginRight: 'auto',
              boxShadow: '0 2px 12px rgba(18,48,71,0.06)'
            }}>
              <h2 style={{marginTop: 0, color: 'var(--vn-orange, #f28c28)'}}>Who this is for</h2>
              <p style={{marginBottom: '1.2rem'}}>Paramedic students and instructors who want scenarios that think. Each call is built around realistic clinical reasoning, Ontario scope, and the kind of ambiguity that actually shows up on a truck.</p>
              <h2 style={{marginTop: 0, color: 'var(--vn-orange, #f28c28)'}}>How to use</h2>
              <p style={{marginBottom: '0.75rem'}}>Set your parameters and hit Generate. Here's what each option does:</p>
              <ul style={{paddingLeft: '1.2em', margin: '0 0 1.2rem 0'}}>
                <li style={{marginBottom: '0.5rem'}}><b>Semester</b> — controls clinical expectations. Semester 2 stays BLS-focused. Semester 3 opens directive-aware treatment. Semester 4 expects integrated reasoning under pressure.</li>
                <li style={{marginBottom: '0.5rem'}}><b>Type</b> — the main call category. Medical, Trauma, Cardiac, Respiratory, or Environmental.</li>
                <li style={{marginBottom: '0.5rem'}}><b>Environment</b> — shapes scene texture, access, and transport decisions. Urban calls feel different from rural ones.</li>
                <li style={{marginBottom: '0.5rem'}}><b>Complexity</b> — Simple means one clear problem done well. Complex means competing cues, ambiguity, and harder prioritization.</li>
                <li style={{marginBottom: '0.5rem'}}><b>Scenario Friction</b> — Clean keeps the scene operationally straightforward so the learning stays clinical. Pressured layers realistic scene problems that change how you assess, package, and move.</li>
                <li style={{marginBottom: '0.5rem'}}><b>Generation Depth</b> — Quick Draft is lean and fast. Detailed adds fuller progression, richer clinical reasoning, and more specific GRS anchors.</li>
              </ul>
              <p style={{marginBottom: '0.5rem'}}>The <b>Instructor Prompt</b> field is optional. Use it to push the scenario in a specific direction — a patient profile, a clinical twist, a teaching focus, or a setting detail. The more specific you are, the better the result.</p>
              <p style={{margin: 0}}>Use <b>Night Shift</b> to switch to a darker reading mode with overnight call flavour. Use <b>Export</b> to download the scenario as a PDF once it's generated.</p>
            </section>
          )}
          {scenario && (
            <>
            <div style={styles.outputBox}>
              {scenario.customPrompt && (
                <div
                  style={{
                    backgroundColor: "var(--vn-accent-card-bg)",
                    borderLeft: "6px solid var(--vn-accent-card-border)",
                    padding: "1rem",
                    borderRadius: "10px",
                    marginBottom: "1rem",
                  }}
                >
                  <strong>📌 Instructor Prompt:</strong>
                  <p style={{ marginTop: "0.5rem" }}>{scenario.customPrompt}</p>
                </div>
              )}

              {Object.entries(SECTION_GROUPS).map(([groupName, keys]) => (
                <div key={groupName}>
                  {groupName === "What Was Happening" && (
                    <div className="scenario-pause-card" style={{ marginTop: "1.25rem" }}>
                      <span className="scenario-pause-label">Pause Before Reading On</span>
                      <p>
                        Stop here. Work through the call in your head or with a partner.
                        What is your working impression? What would you do next and why?
                        Write it down or say it out loud before reading on.
                      </p>
                    </div>
                  )}

                  <div
                    className="scenario-phase-header"
                    style={{
                      backgroundColor: "var(--vn-card-bg)",
                      border: "1px solid var(--vn-border)",
                      borderRadius: "12px",
                      padding: "0.6rem 0.9rem",
                      marginTop: "1.25rem",
                      marginBottom: "0.5rem",
                      boxShadow: "var(--vn-panel-shadow)",
                    }}
                  >
                    <h2 style={{ margin: 0 }}>
                      <button
                        type="button"
                        className="scenario-phase-heading-btn a11y-focus"
                        onClick={() => toggleSection(groupName)}
                        aria-expanded={!collapsedSections[groupName]}
                        aria-label={`${collapsedSections[groupName] ? "Expand" : "Collapse"} ${groupName}`}
                      >
                        <span aria-hidden="true" style={styles.sectionHeadingIcon}>
                          {collapsedSections[groupName] ? "▶" : "▼"}
                        </span>
                        <span className="scenario-phase-title">{groupName}</span>
                      </button>
                    </h2>
                  </div>

                  {!collapsedSections[groupName] && groupName === "Teaching Points" && scenario.teachersPoints && (
                    <div
                      style={{
                        backgroundColor: "var(--vn-accent-card-bg)",
                        color: "var(--vn-ink)",
                        padding: "1rem",
                        borderRadius: "12px",
                        border: "1px solid var(--vn-accent-card-border)",
                        marginBottom: "1rem",
                      }}
                    >
                      <h3
                        className="scenario-section-h2"
                        style={{ marginBottom: "0.5rem" }}
                      >
                        Teaching Points
                      </h3>
                      <div style={{ fontStyle: "italic" }}>
                        {renderSafeContent(scenario.teachersPoints, "teachersPoints")}
                      </div>
                    </div>
                  )}

                  {!collapsedSections[groupName] &&
                    keys
                      .filter((key) => key !== "teachersPoints")
                      .map((key) => {
                        if (key === "ecgRhythm") {
                          return scenario ? renderSection("ecgRhythm", true) : null;
                        }
                        return scenario[key] && renderSection(key, scenario[key]);
                      })}
                </div>
              ))}
            </div>
            </>
          )}
        </div>
      </div>

      {loading && (
        <div style={styles.loadingOverlay}>
          <div style={styles.loadingBox}>
            <FaSpinner className="spin" style={styles.loadingSpinner} />
            <div style={styles.loadingTitle}>
              Generating Scenario<span style={{ display: "inline-block", minWidth: "1.7rem", textAlign: "left" }}>{".".repeat(dotCount)}</span>
            </div>
            <div style={styles.loadingSubtext}>This will take a minute...<br />Or several...</div>
            <div style={{ ...styles.loadingSubtext, marginTop: "0.4rem", fontSize: "0.8rem", color: "var(--vn-loading-muted)", textAlign: "center" }}>
              The AI is building your scenario, vitals, and teaching cues.<br />
              Complex cases may take a little longer.
            </div>
            <div style={{
              marginTop: "1.2rem",
              minHeight: "2.5rem",
              fontSize: "0.78rem",
              color: "var(--vn-loading-muted)",
              fontStyle: "italic",
              textAlign: "center",
              maxWidth: "300px",
              lineHeight: 1.35,
            }}>
              <div key={jokeIndex} className="loading-message-pop">
                {(isNightShift ? nightShiftJokes : dayLoadingJokes)[jokeIndex]}
              </div>
            </div>
            <button
              onClick={handleCancel}
              style={styles.cancelButton}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {selectedECGImage && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            backgroundColor: "rgba(0, 0, 0, 0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 20000,
          }}
          onClick={() => setSelectedECGImage(null)}
        >
          <div
            style={{
              position: "relative",
              background: "var(--vn-modal-bg)",
              padding: "1rem",
              borderRadius: "8px",
              maxWidth: "90vw",
              maxHeight: "90vh",
              overflow: "auto",
              boxShadow: "0 8px 16px rgba(0,0,0,0.3)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {selectedECGImage && selectedECGImage.rhythm ? (
              <RhythmStripSVG rhythm={selectedECGImage.rhythm} hr={selectedECGImage.hr} isNightShift={isNightShift} />
            ) : selectedECGImage && (selectedECGImage.type === '12lead' || selectedECGImage.type === '15lead') ? (
              <TwelveLeadSVG
                ecgType={selectedECGImage.ecgType}
                rhythmInterp={selectedECGImage.rhythmInterp}
                twelveLeadFindings={selectedECGImage.twelveLeadFindings}
                fifteenLeadFindings={selectedECGImage.fifteenLeadFindings}
                hr={selectedECGImage.hr}
                isNightShift={isNightShift}
              />
            ) : null}
            <button
              onClick={() => setSelectedECGImage(null)}
              className="a11y-focus"
              style={styles.modalCloseButton}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const buildStyles = (isMobile) => ({
  container: {
    padding: isMobile ? "0.62rem 0" : "0.28rem 0 1rem",
    backgroundColor: "transparent",
    color: "var(--vn-ink)",
    fontFamily: "var(--vn-font-body)",
    fontSize: "14px",
    minHeight: "100vh",
    height: "auto",
    overflow: "visible",
    boxSizing: "border-box",
    lineHeight: "1.5",
    maxWidth: "1320px",
    margin: "0 auto",
  },
  loadingOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    width: "100vw",
    height: "100vh",
    backgroundColor: "var(--vn-loading-overlay)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 30000,
    overflow: "hidden",
  },

  loadingBox: {
    backgroundColor: "var(--vn-loading-box-bg)",
    padding: "1.5rem 2rem",
    borderRadius: "14px",
    boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "0.75rem",
    minWidth: "260px",
  },

  loadingSpinner: {
    fontSize: "1.75rem",
    color: "var(--vn-teal)",
  },

  loadingTitle: {
    fontSize: "1.05rem",
    fontWeight: "bold",
    color: "var(--vn-ink)",
  },

  loadingSubtext: {
    fontSize: "0.9rem",
    color: "var(--vn-muted-text)",
    textAlign: "center",
  },
  headerBar: {
    position: isMobile ? "static" : "sticky",
    top: 0,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "0.7rem",
    flexWrap: "nowrap",
    marginBottom: isMobile ? "0.85rem" : "0.75rem",
    background: "linear-gradient(122deg, var(--vn-header-start) 0%, var(--vn-header-mid) 52%, var(--vn-header-end) 100%)",
    padding: isMobile ? "0.7rem 0.85rem" : "0.78rem 1rem",
    borderRadius: "14px",
    boxShadow: "var(--vn-panel-shadow)",
    zIndex: 1000,
    border: "1px solid var(--vn-header-border)",
    borderLeft: "6px solid var(--vn-orange)",
    overflowX: "auto",
    overflowY: "hidden",
  },

  heading: {
    fontSize: isMobile ? "1.1rem" : "1.4rem",
    fontWeight: 800,
    margin: 0,
    color: "var(--vn-header-text)",
    letterSpacing: "0.01em",
    position: "relative",
    zIndex: 1,
    flex: "1 1 auto",
    minWidth: 0,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },

  headerActionWrap: {
    position: "relative",
    zIndex: 1,
    display: "flex",
    gap: "0.6rem",
    flexWrap: "nowrap",
    justifyContent: "flex-end",
    flex: "0 0 auto",
    minWidth: 0,
    overflowX: "auto",
    overflowY: "hidden",
  },

  shiftToggle: {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.45rem",
    padding: "0.5rem 0.78rem",
    borderRadius: "999px",
    border: "1px solid var(--vn-header-pill-border)",
    cursor: "pointer",
    background: "var(--vn-header-pill-bg)",
    color: "var(--vn-header-pill-text)",
    fontSize: "0.9rem",
    fontWeight: 700,
    boxShadow: "var(--vn-header-pill-shadow)",
    flexShrink: 0,
    whiteSpace: "nowrap",
  },

  toggle: {
    padding: "0.5rem 0.78rem",
    borderRadius: "999px",
    border: "1px solid var(--vn-export-border)",
    cursor: "pointer",
    background: "linear-gradient(135deg, var(--vn-orange), var(--vn-export-end))",
    color: "var(--vn-export-text)",
    fontSize: "0.9rem",
    fontWeight: 700,
    boxShadow: "var(--vn-export-shadow)",
    flexShrink: 0,
    whiteSpace: "nowrap",
  },

  mainLayout: {
    display: "grid",
    gridTemplateColumns: isMobile ? "1fr" : "320px 1fr",
    gap: isMobile ? "0.78rem" : "1rem",
    alignItems: "start",
    height: "auto",
    overflow: "visible",
  },

  leftPanel: {
    position: isMobile ? "static" : "sticky",
    top: isMobile ? "auto" : "74px",
    height: "fit-content",
  },

  rightPanel: {
    minWidth: 0,
  },

  formBox: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: "0.85rem",
    background: "linear-gradient(180deg, var(--vn-form-top) 0%, var(--vn-form-bottom) 100%)",
    padding: "1.25rem",
    borderRadius: "14px",
    marginBottom: isMobile ? "0.5rem" : "1rem",
    boxShadow: "var(--vn-panel-shadow)",
    border: "1px solid var(--vn-panel-border)",
    backdropFilter: "blur(2px)",
    borderLeft: "4px solid rgba(242, 140, 40, 0.7)",
  },

  fieldRow: {
    display: "flex",
    flexDirection: "column",
    gap: "0.35rem",
  },

  select: {
    padding: "0.45rem",
    borderRadius: "8px",
    border: "1px solid var(--vn-input-border)",
    backgroundColor: "var(--vn-input-bg)",
    color: "var(--vn-ink)",
  },

  textarea: {
    padding: "0.5rem",
    borderRadius: "8px",
    border: "1px solid var(--vn-input-border)",
    backgroundColor: "var(--vn-input-bg)",
    color: "var(--vn-ink)",
    resize: "vertical",
  },

  helperText: {
    color: "var(--vn-muted-text)",
    fontSize: "0.8rem",
    marginTop: "0.2rem",
  },

  button: {
    padding: "0.85rem",
    fontSize: "1rem",
    fontWeight: "bold",
    borderRadius: "10px",
    border: "none",
    background: "linear-gradient(135deg, var(--vn-button-start), var(--vn-button-end))",
    color: "var(--vn-button-text)",
    cursor: "pointer",
    boxShadow: "var(--vn-button-shadow)",
  },

  pillGroup: {
    display: "flex",
    flexWrap: "wrap",
    gap: "0.4rem",
  },

  pillOption: {
    padding: "0.3rem 0.75rem",
    borderRadius: "999px",
    border: "1px solid var(--vn-input-border)",
    background: "var(--vn-input-bg)",
    color: "var(--vn-ink)",
    fontSize: "0.85rem",
    cursor: "pointer",
    fontWeight: 500,
  },

  pillOptionActive: {
    padding: "0.3rem 0.75rem",
    borderRadius: "999px",
    border: "1px solid var(--vn-orange)",
    background: "var(--vn-orange)",
    color: "#fff",
    fontSize: "0.85rem",
    cursor: "pointer",
    fontWeight: 700,
  },

  pillLabel: {
    fontSize: "0.85rem",
    color: "var(--vn-muted-text)",
    fontWeight: 600,
  },

  outputBox: {
    maxHeight: "none",
    overflowY: "visible",
    background: "linear-gradient(180deg, var(--vn-output-top) 0%, var(--vn-output-bottom) 100%)",
    padding: isMobile ? "1rem" : "1.5rem",
    borderRadius: "14px",
    boxShadow: "var(--vn-panel-shadow)",
    border: "1px solid var(--vn-panel-border)",
  },

  card: {
    backgroundColor: "var(--vn-card-bg)",
    padding: "1rem",
    borderRadius: "10px",
    marginBottom: "1rem",
    border: "1px solid var(--vn-card-border)",
  },

  error: {
    color: "var(--vn-error-text)",
    fontWeight: "bold",
    marginTop: "0.5rem",
  },

  loading: {
    color: "var(--vn-ink)",
    fontWeight: "bold",
    marginTop: "0.5rem",
  },

  sectionHeading: {
    fontSize: isMobile ? "1rem" : "1.15rem",
    marginTop: "0.5rem",
    marginBottom: "0.35rem",
  },

  sectionHeadingWrap: {
    marginTop: "0.5rem",
    marginBottom: "0.35rem",
  },

  sectionHeadingIcon: {
    display: "inline-flex",
    minWidth: "1.1rem",
    justifyContent: "center",
  },

  cancelButton: {
    marginTop: "0.8rem",
    padding: "0.4rem 1.2rem",
    background: "transparent",
    border: "1px solid var(--vn-input-border)",
    borderRadius: "6px",
    color: "var(--vn-muted-text)",
    cursor: "pointer",
    fontSize: "0.85rem",
  },

  modalCloseButton: {
    marginTop: "0.75rem",
    padding: "0.5rem 1rem",
    backgroundColor: "var(--vn-button-start)",
    color: "var(--vn-button-text)",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
  },
});

export default ScenarioForm;
