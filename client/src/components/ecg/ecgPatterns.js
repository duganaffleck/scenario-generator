// 12-lead and 15-lead patterns. Each lead is a set of amplitudes (mV) and timings (ms) that the ECG engine
// turns into a waveform: pr, pA (P), qD (Q depth), rA (R), sD (S depth), st (ST shift), tA (T),
// flip (invert QRS-ST-T, used for aVR), pFlip, wide (bundle-branch width), notch (notched broad R),
// stSlope ('down' for downsloping depression), and for RBBB rsrPattern/sA/rPrime/sLate.
// The pattern sets the shape of each lead; the patient's rhythm sets the timing.

export const _TL_PATTERNS = {
  lvhStrain: {
    title: 'Left Ventricular Hypertrophy with Strain (not STEMI)',
    leads: {
      'I':   { pr:160, pA:0.12, rA:1.25, qD:0.06, sD:0.05, tA:-0.20, st:-0.08 },
      'II':  { pr:160, pA:0.15, rA:0.85, qD:0.06, sD:0.18, tA:0.10, st:-0.03 },
      'III': { pr:160, pA:0.08, rA:0.25, qD:0.04, sD:0.45, tA:0.10, st:0 },
      'aVR': { pr:160, pA:0.12, rA:0.30, qD:0.08, sD:0.05, tA:0.10, st:0, flip:true, pFlip:true },
      'aVL': { pr:160, pA:0.08, rA:1.30, qD:0.06, sD:0.05, tA:-0.22, st:-0.10 },
      'aVF': { pr:160, pA:0.13, rA:0.45, qD:0.06, sD:0.30, tA:0.10, st:0 },
      'V1':  { pr:160, pA:0.06, rA:0.12, qD:0.02, sD:1.10, tA:0.18, st:0.10 },
      'V2':  { pr:160, pA:0.08, rA:0.20, qD:0.02, sD:1.15, tA:0.22, st:0.12 },
      'V3':  { pr:160, pA:0.10, rA:0.45, qD:0.04, sD:0.80, tA:0.18, st:0.06 },
      'V4':  { pr:160, pA:0.12, rA:1.60, qD:0.06, sD:0.25, tA:0.05, st:-0.04 },
      'V5':  { pr:160, pA:0.12, rA:2.30, qD:0.06, sD:0.10, tA:-0.28, st:-0.14 },
      'V6':  { pr:160, pA:0.12, rA:2.00, qD:0.06, sD:0.06, tA:-0.25, st:-0.12 },
    }
  },
  // Acute right heart strain (large PE): S1 Q3 T3, rightward axis, T wave inversion V1 to V3.
  rightHeartStrain: {
    title: 'Right Heart Strain (S1 Q3 T3)',
    leads: {
      'I':   { pr:160, pA:0.12, rA:0.35, qD:0.02, sD:0.40, tA:0.14, st:0 },
      'II':  { pr:160, pA:0.18, rA:0.90, qD:0.04, sD:0.10, tA:0.14, st:0 },
      'III': { pr:160, pA:0.12, rA:0.70, qD:0.22, sD:0.04, tA:-0.18, st:0 },
      'aVR': { pr:160, pA:0.12, rA:0.30, qD:0.08, sD:0.05, tA:0.08, st:0, flip:true, pFlip:true },
      'aVL': { pr:160, pA:0.06, rA:0.15, qD:0.02, sD:0.35, tA:0.10, st:0 },
      'aVF': { pr:160, pA:0.15, rA:0.85, qD:0.10, sD:0.06, tA:-0.08, st:0 },
      'V1':  { pr:160, pA:0.08, rA:0.35, qD:0.02, sD:0.30, tA:-0.25, st:0 },
      'V2':  { pr:160, pA:0.10, rA:0.40, qD:0.02, sD:0.45, tA:-0.28, st:0 },
      'V3':  { pr:160, pA:0.10, rA:0.60, qD:0.04, sD:0.30, tA:-0.18, st:0 },
      'V4':  { pr:160, pA:0.12, rA:0.90, qD:0.06, sD:0.18, tA:0.08, st:0 },
      'V5':  { pr:160, pA:0.12, rA:1.00, qD:0.06, sD:0.12, tA:0.18, st:0 },
      'V6':  { pr:160, pA:0.12, rA:0.85, qD:0.06, sD:0.10, tA:0.18, st:0 },
    }
  },
  stDepression: {
    title: 'Ischemic ST Depression (no STEMI)',
    leads: {
      'I':   { pr:160, pA:0.12, rA:0.70, qD:0.05, sD:0.06, tA:0.08, st:-0.12, stSlope:'down' },
      'II':  { pr:160, pA:0.15, rA:1.00, qD:0.06, sD:0.12, tA:0.10, st:-0.18, stSlope:'down' },
      'III': { pr:160, pA:0.08, rA:0.45, qD:0.04, sD:0.06, tA:0.06, st:-0.10, stSlope:'down' },
      'aVR': { pr:160, pA:0.12, rA:0.30, qD:0.08, sD:0.05, tA:0.10, st:-0.14, flip:true, pFlip:true },
      'aVL': { pr:160, pA:0.08, rA:0.40, qD:0.05, sD:0.06, tA:0.10, st:-0.05 },
      'aVF': { pr:160, pA:0.13, rA:0.75, qD:0.06, sD:0.10, tA:0.08, st:-0.15, stSlope:'down' },
      'V1':  { pr:160, pA:0.06, rA:0.18, qD:0.04, sD:0.45, tA:-0.05, st:0.02 },
      'V2':  { pr:160, pA:0.08, rA:0.35, qD:0.04, sD:0.38, tA:0.10, st:-0.05 },
      'V3':  { pr:160, pA:0.10, rA:0.65, qD:0.05, sD:0.22, tA:0.10, st:-0.14, stSlope:'down' },
      'V4':  { pr:160, pA:0.12, rA:1.00, qD:0.07, sD:0.14, tA:0.08, st:-0.22, stSlope:'down' },
      'V5':  { pr:160, pA:0.12, rA:1.10, qD:0.06, sD:0.10, tA:0.06, st:-0.24, stSlope:'down' },
      'V6':  { pr:160, pA:0.12, rA:0.88, qD:0.06, sD:0.08, tA:0.06, st:-0.20, stSlope:'down' },
    }
  },
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
    title: 'Inferior STEMI: ST Elevation II, III, aVF',
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
    title: 'Anterior STEMI: ST Elevation V1-V4',
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
    title: 'Lateral STEMI: ST Elevation I, aVL, V5-V6',
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
      'I':   { pr:160, pA:0.12, rA:1.00, qD:0.00, sD:0.00, tA:-0.24, st:-0.08, wide:true, notch:true },
      'II':  { pr:160, pA:0.15, rA:0.70, qD:0.00, sD:0.05, tA:-0.14, st:-0.05, wide:true },
      'III': { pr:160, pA:0.06, rA:0.15, qD:0.00, sD:0.45, tA:0.16, st:0.06, wide:true },
      'aVR': { pr:160, pA:0.12, rA:0.05, qD:0.00, sD:0.65, tA:0.22, st:0.08, wide:true, pFlip:true },
      'aVL': { pr:160, pA:0.08, rA:0.95, qD:0.00, sD:0.00, tA:-0.22, st:-0.08, wide:true, notch:true },
      'aVF': { pr:160, pA:0.10, rA:0.25, qD:0.00, sD:0.35, tA:0.10, st:0.04, wide:true },
      'V1':  { pr:160, pA:0.06, rA:0.08, qD:0.00, sD:1.15, tA:0.34, st:0.18, wide:true },
      'V2':  { pr:160, pA:0.08, rA:0.10, qD:0.00, sD:1.25, tA:0.40, st:0.22, wide:true },
      'V3':  { pr:160, pA:0.08, rA:0.20, qD:0.00, sD:0.95, tA:0.30, st:0.14, wide:true },
      'V4':  { pr:160, pA:0.10, rA:0.55, qD:0.00, sD:0.50, tA:0.06, st:0.02, wide:true },
      'V5':  { pr:160, pA:0.12, rA:1.10, qD:0.00, sD:0.05, tA:-0.22, st:-0.08, wide:true, notch:true },
      'V6':  { pr:160, pA:0.12, rA:1.00, qD:0.00, sD:0.00, tA:-0.22, st:-0.08, wide:true, notch:true },
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
    title: 'Atrial Fibrillation: 12-Lead',
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
    title: 'Ventricular Tachycardia: 12-Lead',
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
    title: 'Inferior + RV STEMI: Modified 15-Lead',
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
    title: 'Posterior STEMI: Modified 15-Lead',
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
    title: "Wellens Syndrome: LAD T-Wave Warning",
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
    title: "De Winter Pattern: STEMI Equivalent (LAD)",
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
    title: "Inferolateral STEMI: II, III, aVF, V5, V6",
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
    title: "High Lateral STEMI: I, aVL (Diagonal Branch)",
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
    title: "Acute Pericarditis: Diffuse Saddle ST Elevation",
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
    title: "Hyperkalemia: Peaked T Waves",
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
    title: "SVT: Narrow Complex Tachycardia",
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
    title: "Atrial Flutter: Sawtooth Pattern",
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
  firstDegreeAVBlock: {
    title: 'First Degree AV Block: Prolonged PR',
    leads: {
      'I':   { pr:240, pA:0.12, rA:0.65, qD:0.06, sD:0.06, tA:0.22, st:0 },
      'II':  { pr:240, pA:0.15, rA:1.00, qD:0.08, sD:0.14, tA:0.30, st:0 },
      'III': { pr:240, pA:0.08, rA:0.40, qD:0.04, sD:0.05, tA:0.15, st:0 },
      'aVR': { pr:240, pA:0.12, rA:0.30, qD:0.08, sD:0.05, tA:-0.12, st:0, flip:true, pFlip:true },
      'aVL': { pr:240, pA:0.08, rA:0.35, qD:0.06, sD:0.06, tA:0.12, st:0 },
      'aVF': { pr:240, pA:0.13, rA:0.72, qD:0.06, sD:0.10, tA:0.25, st:0 },
      'V1':  { pr:240, pA:0.06, rA:0.18, qD:0.04, sD:0.42, tA:-0.08, st:0 },
      'V2':  { pr:240, pA:0.08, rA:0.35, qD:0.04, sD:0.38, tA:-0.05, st:0 },
      'V3':  { pr:240, pA:0.10, rA:0.65, qD:0.05, sD:0.22, tA:0.12, st:0 },
      'V4':  { pr:240, pA:0.12, rA:1.00, qD:0.07, sD:0.14, tA:0.30, st:0 },
      'V5':  { pr:240, pA:0.12, rA:1.10, qD:0.06, sD:0.10, tA:0.32, st:0 },
      'V6':  { pr:240, pA:0.12, rA:0.88, qD:0.06, sD:0.08, tA:0.28, st:0 },
    }
  },
  secondDegreeTypeI: {
    title: 'Second Degree AV Block Type I: Wenckebach',
    wenckebach: true,
    leads: {
      'I':   { pr:160, pA:0.12, rA:0.65, qD:0.06, sD:0.06, tA:0.22, st:0 },
      'II':  { pr:160, pA:0.15, rA:1.00, qD:0.08, sD:0.14, tA:0.30, st:0 },
      'III': { pr:160, pA:0.08, rA:0.40, qD:0.04, sD:0.05, tA:0.15, st:0 },
      'aVR': { pr:160, pA:0.12, rA:0.30, qD:0.08, sD:0.05, tA:-0.12, st:0, flip:true, pFlip:true },
      'aVL': { pr:160, pA:0.08, rA:0.35, qD:0.06, sD:0.06, tA:0.12, st:0 },
      'aVF': { pr:160, pA:0.13, rA:0.72, qD:0.06, sD:0.10, tA:0.25, st:0 },
      'V1':  { pr:160, pA:0.06, rA:0.18, qD:0.04, sD:0.42, tA:-0.08, st:0 },
      'V2':  { pr:160, pA:0.08, rA:0.35, qD:0.04, sD:0.38, tA:-0.05, st:0 },
      'V3':  { pr:160, pA:0.10, rA:0.65, qD:0.05, sD:0.22, tA:0.12, st:0 },
      'V4':  { pr:160, pA:0.12, rA:1.00, qD:0.07, sD:0.14, tA:0.30, st:0 },
      'V5':  { pr:160, pA:0.12, rA:1.10, qD:0.06, sD:0.10, tA:0.32, st:0 },
      'V6':  { pr:160, pA:0.12, rA:0.88, qD:0.06, sD:0.08, tA:0.28, st:0 },
    }
  },
  secondDegreeTypeII: {
    title: 'Second Degree AV Block Type II: Mobitz II',
    mobitzII: true,
    leads: {
      'I':   { pr:180, pA:0.12, rA:0.65, qD:0.10, sD:0.08, tA:0.22, st:0 },
      'II':  { pr:180, pA:0.15, rA:1.00, qD:0.12, sD:0.16, tA:0.28, st:0 },
      'III': { pr:180, pA:0.08, rA:0.40, qD:0.08, sD:0.06, tA:0.14, st:0 },
      'aVR': { pr:180, pA:0.12, rA:0.30, qD:0.10, sD:0.05, tA:-0.12, st:0, flip:true, pFlip:true },
      'aVL': { pr:180, pA:0.08, rA:0.35, qD:0.08, sD:0.06, tA:0.12, st:0 },
      'aVF': { pr:180, pA:0.13, rA:0.72, qD:0.10, sD:0.10, tA:0.22, st:0 },
      'V1':  { pr:180, pA:0.06, rA:0.18, qD:0.06, sD:0.48, tA:-0.08, st:0 },
      'V2':  { pr:180, pA:0.08, rA:0.35, qD:0.06, sD:0.42, tA:-0.05, st:0 },
      'V3':  { pr:180, pA:0.10, rA:0.65, qD:0.08, sD:0.28, tA:0.10, st:0 },
      'V4':  { pr:180, pA:0.12, rA:1.00, qD:0.10, sD:0.18, tA:0.26, st:0 },
      'V5':  { pr:180, pA:0.12, rA:1.10, qD:0.08, sD:0.12, tA:0.28, st:0 },
      'V6':  { pr:180, pA:0.12, rA:0.88, qD:0.08, sD:0.10, tA:0.25, st:0 },
    }
  },
  thirdDegreeAVBlock: {
    title: 'Third Degree AV Block: Complete Heart Block',
    completeBlock: true,
    leads: {
      'I':   { pr:160, pA:0.12, rA:0.55, qD:0.10, sD:0.08, tA:0.18, st:0 },
      'II':  { pr:160, pA:0.14, rA:0.85, qD:0.14, sD:0.16, tA:0.22, st:0 },
      'III': { pr:160, pA:0.08, rA:0.38, qD:0.08, sD:0.06, tA:0.12, st:0 },
      'aVR': { pr:160, pA:0.12, rA:0.28, qD:0.10, sD:0.05, tA:-0.10, st:0, flip:true, pFlip:true },
      'aVL': { pr:160, pA:0.08, rA:0.32, qD:0.08, sD:0.06, tA:0.10, st:0 },
      'aVF': { pr:160, pA:0.12, rA:0.68, qD:0.10, sD:0.10, tA:0.20, st:0 },
      'V1':  { pr:160, pA:0.06, rA:0.16, qD:0.06, sD:0.50, tA:-0.08, st:0 },
      'V2':  { pr:160, pA:0.08, rA:0.30, qD:0.06, sD:0.44, tA:-0.05, st:0 },
      'V3':  { pr:160, pA:0.10, rA:0.58, qD:0.08, sD:0.28, tA:0.10, st:0 },
      'V4':  { pr:160, pA:0.12, rA:0.90, qD:0.10, sD:0.18, tA:0.22, st:0 },
      'V5':  { pr:160, pA:0.12, rA:1.00, qD:0.08, sD:0.12, tA:0.24, st:0 },
      'V6':  { pr:160, pA:0.12, rA:0.80, qD:0.08, sD:0.10, tA:0.22, st:0 },
    }
  },
};

export function pickTwelveLeadPattern(ecgType, rhythmInterp, twelveLeadFindings, fifteenLeadFindings, patternKey) {
  const VALID_PATTERNS = ['normal','lvhStrain','rightHeartStrain','stDepression','inferiorSTEMI','anteriorSTEMI','lateralSTEMI','lbbb','rbbb','afib12','vtach12','inferiorRV','posterior','wellens','deWinter','inferolateralSTEMI','highLateralSTEMI','pericarditis','hyperkalemia','svt12','atrialFlutter12','firstDegreeAVBlock','secondDegreeTypeI','secondDegreeTypeII','thirdDegreeAVBlock'];
  if (patternKey && VALID_PATTERNS.includes(patternKey)) return patternKey;
  const txt = ((twelveLeadFindings || '') + ' ' + (rhythmInterp || '')).toLowerCase().replace(/\s*-\s*/g, ' ');
  if (ecgType === '15-lead' || (fifteenLeadFindings && fifteenLeadFindings.trim().length > 10 && (fifteenLeadFindings.toLowerCase().includes('elevation') || fifteenLeadFindings.toLowerCase().includes('involvement') || fifteenLeadFindings.toLowerCase().includes('stemi') || fifteenLeadFindings.toLowerCase().includes('posterior')))) {
    if (txt.includes('posterior')) return 'posterior';
    return 'inferiorRV';
  }
  const lvh = txt.includes('left ventricular hypertrophy') || /\blvh\b/.test(txt);
  const stemiClaimed = /\bstemi\b/.test(txt) && !/(no|not|without|does not meet|doesn't meet)[^.]{0,30}\bstemi\b/.test(txt);
  if (lvh && !stemiClaimed) return 'lvhStrain';
  // Before the Wellens check: right heart strain also inverts T waves in V1 to V3.
  if (txt.includes('s1q3t3') || txt.includes('s1 q3 t3') || txt.includes('right heart strain') || txt.includes('right ventricular strain')) return 'rightHeartStrain';
  if (txt.includes('wellens') || txt.includes('lad warning') || txt.includes('biphasic t') || txt.includes('deep symmetric t') || txt.includes('symmetric t wave inversion') || txt.includes('deep t wave inversion') || ((txt.includes('t wave inversion') || txt.includes('t-wave inversion')) && (txt.includes('v2') || txt.includes('v3')))) return 'wellens';
  if (txt.includes('de winter') || txt.includes('winter t') || txt.includes('upsloping st depression') || txt.includes('upward sloping st depression')) return 'deWinter';
  if (txt.includes('pericarditis') || txt.includes('saddle') || txt.includes('pr depression')) return 'pericarditis';
  if (txt.includes('hyperkal') || txt.includes('tented t') || txt.includes('peaked narrow') || (txt.includes('peaked t') && (txt.includes('potassium') || txt.includes('dialysis') || txt.includes('renal') || txt.includes('flattened p') || txt.includes('widened qrs'))) || (txt.includes('widened qrs') && txt.includes('flattened p') && txt.includes('peaked'))) return 'hyperkalemia';
  if (txt.includes('high lateral') || (txt.includes('diagonal') && txt.includes('stemi')) || (txt.includes('avl') && (txt.includes('elevation in i') || txt.includes('in i and avl') || txt.includes('leads i and avl') || txt.includes('i, avl')))) return 'highLateralSTEMI';
  if (txt.includes('inferolateral') && !txt.includes('high lateral') && !(txt.includes('reciprocal') && txt.includes('inferior') && !txt.includes('inferior elevation') && !txt.includes('elevation in ii') && !txt.includes('elevation in iii') && !txt.includes('elevation in avf'))) return 'inferolateralSTEMI';
  if (txt.includes('left bundle') || txt.includes('lbbb') || (txt.includes('bundle branch block') && !txt.includes('right bundle') && !txt.includes('rbbb')) || (txt.includes('broad') && txt.includes('notched r') && (txt.includes('v5') || txt.includes('v6'))) || (txt.includes('rs complex') && txt.includes('v1') && txt.includes('lateral'))) return 'lbbb';
  if (txt.includes('right bundle') || txt.includes('rbbb') || (txt.includes('rsr') || txt.includes('r prime') || txt.includes('rsrʼ'))) return 'rbbb';
  if (txt.includes('anterior') && (txt.includes('stemi') || txt.includes('elevation') || txt.includes('v1') || txt.includes('v2') || txt.includes('v3') || txt.includes('v4'))) return 'anteriorSTEMI';
  if (txt.includes('lateral') && (txt.includes('stemi') || txt.includes('elevation')) && !txt.includes('inferolateral')) return 'lateralSTEMI';
  if (txt.includes('inferior') && (txt.includes('stemi') || txt.includes('elevation')) && !txt.includes('lateral') && !txt.includes('inferolateral')) return 'inferiorSTEMI';
  if (txt.includes('flutter')) return 'atrialFlutter12';
  if (txt.includes('fibrillation') || txt.includes('afib') || txt.includes('a-fib')) return 'afib12';
  if (txt.includes('supraventricular') || txt.includes('svt')) return 'svt12';
  if (txt.includes('ventricular tach') || txt.includes('vtach') || txt.includes('v-tach')) return 'vtach12';
  if (txt.includes('third degree') || txt.includes('complete heart block') || txt.includes('complete av block') || txt.includes('atrioventricular dissociation')) return 'thirdDegreeAVBlock';
  if (txt.includes('second degree type ii') || txt.includes('mobitz ii') || txt.includes('mobitz type ii') || txt.includes('mobitz 2') || txt.includes('type ii block')) return 'secondDegreeTypeII';
  if (txt.includes('second degree type i') || txt.includes('mobitz i') || txt.includes('mobitz type i') || txt.includes('wenckebach') || txt.includes('mobitz 1')) return 'secondDegreeTypeI';
  if (txt.includes('first degree') || txt.includes('prolonged pr') || txt.includes('pr prolongation') || txt.includes('pr interval prolongation')) return 'firstDegreeAVBlock';
  const depression = txt.includes('st depression') || txt.includes('st segment depression') || txt.includes('subendocardial');
  if (depression && !stemiClaimed) return 'stDepression';
  return 'normal';
}
