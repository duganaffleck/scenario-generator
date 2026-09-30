import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import jsPDF from "jspdf";
import { FaSpinner, FaFilePdf, FaFileMedical, FaClipboardList, FaUserGraduate, FaMoon, FaSun, FaUndoAlt, FaLink, FaHeartbeat, FaBroadcastTower, FaRandom } from "react-icons/fa";
import VariantDialog from "../variant/VariantDialog";
import { bandFor, newbornSpo2Floor, parseAge, sbpFloor } from "../../utils/ageBands";
import LiveRun from "../live/LiveRun";
import RadioDispatch from "../dispatch/RadioDispatch";
import { ACR_FORM_VERSION, downloadScenarioAcr, errorMessage } from "../acr/acrApi";
import { openRunSheet } from "../runsheet/runSheet";
import { RhythmStripSVG, TwelveLeadSVG } from "../ecg/EcgViews";
import { drawRhythmStrip, drawTwelveLead } from "../ecg/ecgPdf";
import { showToast } from "../toast/Toast";
import { buildShareLink, canShareLinks, clearSharedHash, hasSharedScenario, readSharedScenario } from "../../utils/shareLink";


// Vitals in the order the Practice ACR's vitals columns run (Pulse, Resp, BP, Temp, reading, SpO2, EtCO2, GCS).
const VITAL_COLUMNS = [
  { key: "hr", label: "HR", pdf: "HR" },
  { key: "rr", label: "RR", pdf: "RR" },
  { key: "bp", label: "BP", pdf: "BP" },
  { key: "temp", label: "Temp", pdf: "Temp" },
  { key: "bgl", label: "BGL", pdf: "BGL" },
  { key: "spo2", label: "SpO₂", pdf: "SpO2" },
  { key: "etco2", label: "EtCO₂", pdf: "EtCO2" },
  { key: "gcs", label: "GCS", pdf: "GCS" },
];
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

// ── ECG ─────────────────────────────────────────────────────────────────────
// Drawing lives in components/ecg (engine, patterns, views). parseECGHR stays here for the call sites.
function parseECGHR(hrStr) {
  if (!hrStr) return 75;
  const n = parseInt(String(hrStr).replace(/[^0-9]/g, ''));
  return isNaN(n) || n < 20 || n > 300 ? 75 : n;
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
  semester: "Training level: 2 = assessment and safe BLS care, no medications, 3 = directive-aware treatment with medication decisions, 4 = near-graduation complexity with prioritization under pressure",
  type: "Scenario category: Medical, Trauma, Cardiac, Respiratory, or Environmental",
  environment: "Call location affects scene texture, access, collateral, and transport decisions",
  complexity: "Simple = one clear problem done well. Complex = competing cues and ambiguity requiring stronger prioritization.",
  generationDepth: "Quick Draft = lean and fast, one-line GRS anchors. Detailed = fuller progression and reasoning, GRS anchors of two or three sentences.",
  scenarioFriction: "Clean = operationally straightforward, learning comes from clinical reasoning. Pressured = layered realistic friction that meaningfully affects assessment, packaging, and transport.",
};

const SECTION_GROUPS = {
  "The Call": [
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
    "scenarioIntro",
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
  scenarioIntro: "Scenario Summary",
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

// Student mode folds everything after The Call until the student has made their decisions.
const STUDENT_LOCKED_GROUPS = ["What Was Happening", "Expected Management", "Teaching Points", "Self-Assessment"];
const STUDENT_MODE_KEY = "vn.studentMode";
const RECENT_KEY = "vn.recentScenarios";
const RECENT_MAX = 10;

const isBlankValue = (v) =>
  v === undefined || v === null || (typeof v === "string" && v.trim() === "") ||
  (Array.isArray(v) && v.every(isBlankValue)) ||
  (typeof v === "object" && !Array.isArray(v) && Object.values(v).every(isBlankValue));

// Browser storage can be blocked (private windows, strict settings). Nothing here depends on it working.
const readStore = (key, fallback) => {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch (e) {
    return fallback;
  }
};
const writeStore = (key, value) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    return false;
  }
};

const groupId = (name) => "group-" + name.toLowerCase().replace(/[^a-z]+/g, "-");

const API_BASE = process.env.REACT_APP_API_BASE_URL || "http://localhost:10000";
const DEFAULT_FORM = {
  semester: "3",
  type: "Medical",
  environment: "Urban",
  complexity: "Simple",
  generationDepth: "Quick Draft",
  scenarioFriction: "Clean",
  shiftMode: "Day Shift",
  customPrompt: "",
};
// The last-used options come back next visit (not the instructor prompt). Unknown values fall back to defaults.
const LAST_FORM_KEY = "vn.lastForm";
const FORM_CHOICES = {
  semester: SEMESTERS, type: SCENARIO_TYPES, environment: ENVIRONMENTS, complexity: COMPLEXITIES,
  generationDepth: GENERATION_DEPTHS, scenarioFriction: SCENARIO_FRICTION_LEVELS, shiftMode: ["Day Shift", "Night Shift"],
};
const pickChoices = (source) => Object.fromEntries(
  Object.entries(FORM_CHOICES)
    .filter(([k, allowed]) => source && allowed.includes(source[k]))
    .map(([k]) => [k, source[k]])
);
// A link can open the form already set up, e.g. from a VitalNotes chapter:
// ?type=Medical&complexity=Complex&focus=Give+a+believable+first+story...
// Unknown values are ignored, focus fills the Instructor Prompt (320 characters at most), and the query is
// cleared from the address bar so a reload doesn't keep forcing it.
let linkedForm = null; // read once: React may call the initial-state function twice in development
const readLinkedForm = () => {
  if (linkedForm) return linkedForm;
  linkedForm = {};
  if (typeof window === "undefined" || !window.location.search) return linkedForm;
  const q = new URLSearchParams(window.location.search);
  const raw = Object.fromEntries(Object.keys(FORM_CHOICES).map((k) => [k, q.get(k)]));
  const linked = pickChoices(raw);
  const focus = (q.get("focus") || "").trim().slice(0, 320);
  if (focus) linked.customPrompt = focus;
  if (Object.keys(linked).length) window.history.replaceState(null, "", window.location.pathname + window.location.hash);
  linkedForm = linked;
  return linkedForm;
};
const loadInitialForm = () => ({ ...DEFAULT_FORM, ...pickChoices(readStore(LAST_FORM_KEY, {})), ...readLinkedForm() });
const formatElapsed = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;

const ScenarioForm = () => {
  const [scenario, setScenario] = useState(null);
  const [monitorOpen, setMonitorOpen] = useState(false);
  const [dispatchOpen, setDispatchOpen] = useState(false);
  const [variantOpen, setVariantOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  // Info section visibility: show only before scenario is generated
  const showInfoSection = !scenario && !loading;
  const [formData, setFormData] = useState(loadInitialForm);
  const [elapsed, setElapsed] = useState(0);
  const sessionCalls = useRef(0);
  const qWordSeen = useRef(false);

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
    "Checking if the stretcher is actually clean this time.",
    "Calling dispatch to confirm the address exists.",
    "Partner is still in Tim Hortons. Generating without them.",
    "Scene size-up complete. No obvious hazards. Probably.",
    "Waiting for the elevator. Always the elevator.",
    "BGL check initiated. Machine says LO. Generating backup plan.",
    "Family member insisting it is probably just gas.",
    "Oxygen ordered. Titrating to clinical appropriateness.",
    "Patient rating pain 11 out of 10. Recalibrating scale.",
    "Radio traffic acknowledged. Ignoring most of it.",
    "Confirming the patient's medication list is not actually a novel.",
    "Gloves on. Bag open. Patient already talking to someone else.",
    "Tip: If the patient is talking, their airway is open. Start there.",
    "Cross-checking allergies. Penicillin, shellfish, and direct questions.",
    "Generating a patient who will describe their symptoms in chronological order. Just kidding.",
    "Tip: The first set of vitals is a baseline, not a verdict.",
    "Nasal cannula applied. Patient immediately removes it.",
    "Scene control established. Family not yet informed.",
    "Tip: Transport urgency is a clinical decision, not a feeling.",
    "Partner is getting the monitor. Estimated arrival: unknown.",
    "Running final realism check. Added one locked door and a dog.",
    "Tip: If you are not sure what is wrong, say so and keep looking.",
    "The call was dispatched as a lift assist. It is not a lift assist.",
    "Loading GRS anchors. Please reflect honestly.",
    "Tip: A thorough scene survey takes fifteen seconds. Use them.",
    "Patient is cooperative, which statistically means something is about to change.",
    "Generating documentation the patient will never read but definitely matters.",
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
    "Night shift tip: If the witness says they were fine before bed, pin down an actual timeline.",
    "Building the call while the moon supervises.",
    "The crew is caffeinated enough to chart, not enough to trust vibes alone.",
    "Night shift tip: Reduced staffing changes scene flow. Say out loud what help you will need early.",
    "It is 04:00 and the patient is more alert than anyone on scene.",
    "Generating a call that starts simple and earns its complexity slowly.",
    "Night shift tip: Fatigue affects assessment speed. Slow down on your secondary survey.",
    "The scene is calm. The ECG is not.",
    "Dispatch gave four words. The scene requires considerably more.",
    "Night shift tip: When the family is asleep and cannot give history, the medications speak for them.",
    "Something about this call feels off. That feeling is data.",
    "Night shift tip: If you are running the third call in a row, name your fatigue before it names you.",
    "The address was right. The apartment number was optimistic.",
    "Coffee count: irrelevant. Call count: ongoing.",
    "Night shift tip: A patient who looks comfortable in extremis is one of the harder calls you will run.",
    "Generating the call that separates the tired from the trained.",
    "The night does not care about your paperwork backlog.",
    "Night shift tip: Trust your hands. They wake up before your brain does.",
  ];

  const [error, setError] = useState("");
  const [acrBusy, setAcrBusy] = useState(false);
  const [studentMode, setStudentMode] = useState(() => readStore(STUDENT_MODE_KEY, true) !== false);
  const [recent, setRecent] = useState(() => {
    const saved = readStore(RECENT_KEY, []);
    return Array.isArray(saved) ? saved : [];
  });
  const outputRef = useRef(null);
  const [collapsedSections, setCollapsedSections] = useState({});
  // Student mode shows the vitals one set at a time: the arrival set first, the next when they press for it.
  const [setsShown, setsShownSet] = useState(1);
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 900px)").matches : false
  );

  const isNightShift = formData.shiftMode === "Night Shift";
  const nextShiftModeLabel = isNightShift ? "Day Shift" : "Night Shift";
  const isShiftToggleDisabled = Boolean(scenario);
  const shiftToggleTitle = isNightShift
    ? "Switch to Day Shift: brighter theme and daytime call flavor"
    : "Switch to Night Shift: dark theme and overnight call flavor";
  const isFormModified = Object.keys(DEFAULT_FORM).some((k) => formData[k] !== DEFAULT_FORM[k]);
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

  // Only the page root scrolls. If body also gets an overflow value it becomes its own scroll box,
  // and nothing pinned with position: sticky (header, scenario bar, form) stays put.


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
        .map((item, idx) => {
          if (item === null || item === undefined || item === "") return "";
          if (typeof item === "object") {
            const nested = formatFieldValue(item, depth + 1);
            return nested ? `${idx > 0 ? "\n" : ""}${nested}` : "";
          }
          return `${indent}- ${sanitizePdfText(item)}`;
        })
        .filter(Boolean)
        .join("\n");
    }

    return `${indent}${sanitizePdfText(fieldValue)}`;
  };

  const formatLabel = (label) => {
    const special = {
      headNeck: "Head/Neck", backPelvis: "Back/Pelvis", instructorPriorities: "Watch For",
      "3": "Score 3 (unsafe to borderline)", "5": "Score 5 (competent)", "7": "Score 7 (exceptional)",
    };
    if (special[label]) return special[label];
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
      ["etco2", "EtCO2"],
      ["bgl", "BGL"],
      ["opqrst", "OPQRST"],
      ["sample", "SAMPLE"],
      ["iv", "IV"]
    ]);

    const small = new Set(["and", "or", "of", "to", "the", "in", "on", "with", "for"]);
    return normalized
      .split(" ")
      .map((word, i) => {
        const lower = word.toLowerCase();
        if (acronyms.has(lower)) return acronyms.get(lower);
        if (i > 0 && small.has(lower)) return lower;
        return lower.charAt(0).toUpperCase() + lower.slice(1);
      })
      .join(" ");
  };

  useEffect(() => {
    writeStore(STUDENT_MODE_KEY, studentMode);
  }, [studentMode]);

  useEffect(() => {
    writeStore(LAST_FORM_KEY, pickChoices(formData));
  }, [formData]);

  // Elapsed time while generating, so the wait is honest.
  useEffect(() => {
    if (!loading) { setElapsed(0); return undefined; }
    const started = Date.now();
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(t);
  }, [loading]);

  // Wake the server when the page opens. On Render's free plan it sleeps when idle, and waking it now
  // means it is usually ready by the time someone presses Generate. One request per page visit, nothing scheduled.
  useEffect(() => {
    fetch(`${API_BASE}/`, { mode: "no-cors", cache: "no-store" }).catch(() => {});
  }, []);

  // Open a shared scenario link (#s=...), on load or when one is pasted into the address bar.
  useEffect(() => {
    const openShared = async () => {
      if (!hasSharedScenario()) return;
      try {
        const shared = await readSharedScenario();
        setFormData((prev) => ({ ...prev, ...pickChoices(shared.formData) }));
        setSelectedECGImage(null);
        setError("");
        setScenario(shared.scenario);
        showToast("Shared scenario opened.");
      } catch (e) {
        setError(e.message);
      }
    };
    openShared();
    window.addEventListener("hashchange", openShared);
    return () => window.removeEventListener("hashchange", openShared);
  }, []);

  // Easter egg: the Q word.
  useEffect(() => {
    if (!qWordSeen.current && /\bquiet\b/i.test(formData.customPrompt)) {
      qWordSeen.current = true;
      showToast("You said the Q word. The tones are already dropping.");
    }
  }, [formData.customPrompt]);

  // A new (or reopened) scenario starts folded after The Call in student mode, fully open otherwise.
  useEffect(() => {
    if (!scenario) return;
    setCollapsedSections(studentMode ? Object.fromEntries(STUDENT_LOCKED_GROUPS.map((g) => [g, true])) : {});
    setsShownSet(1);
  }, [scenario, studentMode]);

  // Bring the new scenario into view (on a phone it's below the whole form).
  useEffect(() => {
    if (scenario && outputRef.current) outputRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [scenario]);

  const saveRecent = (generated, usedForm) => {
    const entry = {
      id: Date.now().toString(36),
      savedAt: new Date().toISOString(),
      title: generated.title || "Untitled scenario",
      formData: usedForm,
      scenario: generated,
    };
    setRecent((prev) => {
      let next = [entry, ...prev].slice(0, RECENT_MAX);
      while (next.length && !writeStore(RECENT_KEY, next)) next = next.slice(0, -1);
      return next;
    });
  };

  const restoreRecent = (entry) => {
    if (loading || !entry || !entry.scenario) return;
    setFormData((prev) => ({ ...prev, ...(entry.formData || {}) }));
    setSelectedECGImage(null);
    setError("");
    setScenario(entry.scenario);
  };

  const clearRecent = () => {
    setRecent([]);
    writeStore(RECENT_KEY, []);
  };

  const shareScenario = async () => {
    if (!scenario) return;
    if (!canShareLinks()) {
      setError("This browser can't make scenario links. Try a current version of Chrome, Edge, Firefox or Safari, or share the PDF.");
      return;
    }
    const link = await buildShareLink(scenario, formData);
    try {
      await navigator.clipboard.writeText(link);
      showToast("Link copied. Anyone who opens it gets this scenario, and new visitors start in student mode.", 6000);
    } catch (e) {
      window.prompt("Copy this link:", link);
    }
  };

  const showRunSheet = () => {
    if (!scenario) return;
    if (!openRunSheet(scenario, formData)) setError("Your browser blocked the run sheet. Allow pop-ups for this site and try again.");
  };

  const jumpTo = (groupName) => {
    setCollapsedSections((prev) => ({ ...prev, [groupName]: false }));
    const el = document.getElementById(groupId(groupName));
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
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
    clearSharedHash();
    setFormData({ ...DEFAULT_FORM });
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

    await requestScenario({ ...formData, includeTeachingCues: false }, { ...formData });
  };

  // One trip to the generator. savedForm is what Recent remembers as the settings for this scenario.
  const requestScenario = async (payload, savedForm) => {
    setLoading(true);
    setError("");
    setScenario(null);
    setSelectedECGImage(null);
    clearSharedHash();

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const baseURL = API_BASE;

    try {
      const response = await axios.post(`${baseURL}/api/generate-scenario`, payload, { signal: controller.signal });
      const generated = response.data;

      if (generated.ecgInterpretation && generated.vitalSigns && !generated.vitalSigns.ecgInterpretation) {
        generated.vitalSigns.ecgInterpretation = generated.ecgInterpretation;
      }

      setScenario(generated);
      saveRecent(generated, savedForm);
      sessionCalls.current += 1;
      if (new Date().getHours() === 3) showToast("0300. Of course it's a call.");
      else if (sessionCalls.current === 10) showToast("Ten calls this session. Eat something. Drink some water. Then run another.", 6000);
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

  // Case variant: the same semester, call type and complexity as the scenario on screen, a new patient, and the
  // decision the instructor chose to keep.
  const makeVariant = ({ variantOf, pressured }) => {
    if (!scenario) return;
    setVariantOpen(false);
    const meta = scenario.generationMetadata || {};
    const pickOr = (value, allowed, fallback) => (allowed.includes(String(value)) ? String(value) : fallback);
    const base = {
      ...formData,
      semester: pickOr(meta.semester, SEMESTERS, formData.semester),
      type: pickOr(meta.callType, SCENARIO_TYPES, formData.type),
      complexity: pickOr(meta.complexity, COMPLEXITIES, formData.complexity),
      environment: pickOr(meta.environment, ENVIRONMENTS, formData.environment),
      scenarioFriction: pressured ? "Pressured" : "Clean",
      customPrompt: String(scenario.customPrompt || "").slice(0, 320),
    };
    setFormData(base);
    requestScenario({ ...base, includeTeachingCues: false, variantOf }, base);
  };

  // Practice ACR pre-filled with this scenario's dispatch details. The scenario rides inside it (encrypted),
  // so when a student uploads their chart to ACR Review, the review knows which call it was.
  const downloadPracticeAcr = async () => {
    if (!scenario || acrBusy) return;
    setAcrBusy(true);
    setError("");
    try {
      const { formVersion } = await downloadScenarioAcr(scenario);
      if (formVersion === ACR_FORM_VERSION) showToast(`Practice ACR v${formVersion} downloaded. Open it in Adobe Acrobat Reader.`);
      else setError(`The server sent an older Practice ACR${formVersion ? ` (v${formVersion})` : ""}, not v${ACR_FORM_VERSION}: the backend on Render is running an older build and needs redeploying. Until then, use the blank v${ACR_FORM_VERSION} form on ACR Review.`);
    } catch (err) {
      setError(await errorMessage(err, "Couldn't build the practice ACR. Try again in a minute."));
    } finally {
      setAcrBusy(false);
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
      "variantOf",
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
      "scenarioIntro",
      "teachersPoints",
      "learningObjectives",
      "instructorGuidance",
      // Self-Assessment
      "selfReflectionPrompts",
      "grsAnchors",
    ];

    // Phase group labels for dividers
    const phaseGroupMap = {
      scenarioIntro: "Teaching Points",
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

    // Build ECG summary text for PDF
    const buildECGSummaryText = () => {
      const lines = [];
      const vs = scenario.vitalSigns || {};
      const ecg = scenario.ecgFindings || {};
      const sets = [
        { label: 'First Set', data: vs.firstSet },
        { label: 'Second Set', data: vs.secondSet },
        ...(Array.isArray(vs.additionalSets) ? vs.additionalSets.map((s, i) => ({ label: `Additional Set ${i + 1}`, data: s })) : []),
      ];
      sets.forEach(({ label, data }) => {
        if (data && data.ecgInterpretation) {
          const hr = data.hr ? `, HR ${String(data.hr).split(',')[0].trim()}` : '';
          lines.push(`${label}: ${data.ecgInterpretation}${hr}`);
        }
      });
      if (ecg.ecgType) lines.push(`ECG Type: ${ecg.ecgType}`);
      const patternLabels = {
        inferiorSTEMI: 'Inferior STEMI', anteriorSTEMI: 'Anterior STEMI', lateralSTEMI: 'Lateral STEMI',
        inferolateralSTEMI: 'Inferolateral STEMI', highLateralSTEMI: 'High Lateral STEMI',
        lbbb: 'Left Bundle Branch Block', rbbb: 'Right Bundle Branch Block',
        afib12: 'Atrial Fibrillation', vtach12: 'Ventricular Tachycardia', inferiorRV: 'Inferior + RV STEMI',
        posterior: 'Posterior STEMI', wellens: 'Wellens Syndrome', deWinter: 'De Winter Pattern',
        pericarditis: 'Pericarditis', hyperkalemia: 'Hyperkalemia', svt12: 'SVT',
        atrialFlutter12: 'Atrial Flutter', firstDegreeAVBlock: 'First Degree AV Block', lvhStrain: 'LVH with Strain', rightHeartStrain: 'Right Heart Strain', stDepression: 'Ischemic ST Depression',
        secondDegreeTypeI: 'Second Degree AV Block Type I', secondDegreeTypeII: 'Second Degree AV Block Type II',
        thirdDegreeAVBlock: 'Third Degree AV Block',
      };
      if (ecg.patternKey && ecg.patternKey !== 'normal') lines.push(`12-Lead Pattern: ${patternLabels[ecg.patternKey] || ecg.patternKey}`);
      if (ecg.rhythmInterpretation) lines.push(`Rhythm: ${ecg.rhythmInterpretation}`);
      if (ecg.twelveLeadFindings) lines.push(`12-Lead Findings: ${ecg.twelveLeadFindings}`);
      if (ecg.fifteenLeadFindings) lines.push(`15-Lead Findings: ${ecg.fifteenLeadFindings}`);
      if (ecg.ecgClinicalNote) lines.push(`Clinical Note: ${ecg.ecgClinicalNote}`);
      return lines.join('\n');
    };

    const ecgSummaryText = buildECGSummaryText();

    // Vitals as one line per set, in ACR column order, to match the page and the run sheet.
    const buildVitalsText = () => {
      const vs = scenario.vitalSigns || {};
      const sets = [vs.firstSet, vs.secondSet, ...(Array.isArray(vs.additionalSets) ? vs.additionalSets : [])]
        .filter((d) => d && VITAL_COLUMNS.some((c) => d[c.key]));
      return sets.map((d, i) => {
        const stage = d.context || (i === 0 ? "Initial Assessment" : i === 1 ? "Reassessment" : `Additional Set ${i - 1}`);
        // Two short lines (HR to BGL, then SpO2 to GCS) so a value never wraps away from its label.
        const line = (cols) => cols.filter((c) => d[c.key]).map((c) => `${c.pdf} ${sanitizePdfText(d[c.key])}`).join("  |  ");
        const lines = [line(VITAL_COLUMNS.slice(0, 5)), line(VITAL_COLUMNS.slice(5))].filter(Boolean);
        return [sanitizePdfText(stage), ...lines.map((l) => `  ${l}`)].join("\n");
      }).join("\n");
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
          : key === "vitalSigns"
            ? buildVitalsText()
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

    // Inject ECG summary after vitalSigns
    if (ecgSummaryText) {
      const vsIndex = sectionEntries.findIndex(e => e.key === 'vitalSigns');
      const ecgEntry = {
        key: 'ecgSummary',
        label: 'ECG / Rhythm',
        formattedValue: ecgSummaryText,
        phase: 'The Call',
      };
      if (vsIndex >= 0) {
        sectionEntries.splice(vsIndex + 1, 0, ecgEntry);
      } else {
        sectionEntries.push(ecgEntry);
      }
    }

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
      // Read the size per page: the 12-lead page is landscape.
      const w = doc.internal.pageSize.getWidth();
      const fy = doc.internal.pageSize.getHeight() - 11;
      doc.setFont(undefined, "normal");
      doc.setFontSize(7.8);
      doc.setTextColor(...palette.mutedText);
      doc.setDrawColor(...palette.line);
      doc.setLineWidth(0.18);
      doc.line(marginX, fy, w - marginX, fy);
      doc.text(documentTitle, marginX, fy + 4.2);
      doc.text(`Page ${pageNum} of ${total}`, w - marginX, fy + 4.2, { align: "right" });
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

        // Indent comes from the nesting in formatFieldValue (two spaces per level).
        const level = Math.min(3, Math.floor((expanded.length - expanded.trimStart().length) / 2));
        const isBullet = trimmed.startsWith("- ");
        const isLabelLine = !isBullet && /^[A-Z0-9][^:]{0,45}:\s*$/.test(trimmed);
        const sanitizedLine = sanitizePdfText(isBullet ? trimmed.slice(2) : trimmed);
        const displayText = isBullet ? `–  ${sanitizedLine}` : sanitizedLine;
        const indent = level * 4 + (isBullet ? 4 : 0);
        const textX = textColumnX + indent;
        const textWidth = maxLineWidth - indent;
        const setBodyStyle = () => {
          doc.setFont(undefined, isLabelLine ? "bold" : "normal");
          doc.setFontSize(bodySize);
          doc.setTextColor(...palette.neutralText);
        };

        setBodyStyle();
        const wrapped = doc.splitTextToSize(displayText, textWidth);
        wrapped.forEach((line) => {
          // A page break draws the header in its own small, pale style; put the body style back.
          if (needsNewPage(bodyLH)) setBodyStyle();
          doc.text(line, textX, y);
          y += bodyLH;
        });
      });

      // The rhythm strips print right under the ECG summary, one per rhythm the call goes through.
      if (entry.key === "ecgSummary") {
        const vs = scenario.vitalSigns || {};
        const sets = [vs.firstSet, vs.secondSet, ...(Array.isArray(vs.additionalSets) ? vs.additionalSets : [])].filter((s) => s && s.ecgInterpretation);
        const seen = new Set();
        sets.filter((s) => !seen.has(s.ecgInterpretation) && seen.add(s.ecgInterpretation)).slice(0, 3).forEach((s) => {
          needsNewPage(42);
          const hr = parseECGHR(s.hr);
          const flat = /fibrillation$|asystole/i.test(s.ecgInterpretation) && !/atrial/i.test(s.ecgInterpretation);
          const caption = ["Lead II", s.context || "", s.ecgInterpretation, flat ? "" : `${hr} bpm`].map((part) => sanitizePdfText(part).trim()).filter(Boolean).join("  ·  ");
          y += drawRhythmStrip(doc, { x: marginX + (pageWidth - 2 * marginX - 150) / 2, y, rhythm: s.ecgInterpretation, hr, patternKey: scenario.ecgFindings?.patternKey || "", caption });
        });
        const type = scenario.ecgFindings?.ecgType;
        if (type === "12-lead" || type === "15-lead") {
          needsNewPage(6);
          doc.setFont(undefined, "italic");
          doc.setFontSize(8.5);
          doc.setTextColor(...palette.mutedText);
          doc.text(`The full ${type === "15-lead" ? "15" : "12"}-lead printout is on the last page, landscape, at true scale.`, marginX + 12, y + 3);
          y += 6;
        }
      }

      y += 2;
    });

    // -- 12-lead on its own landscape page, at true scale -----------------------
    const ecg = scenario.ecgFindings || {};
    if (ecg.ecgType === "12-lead" || ecg.ecgType === "15-lead") {
      doc.addPage("a4", "landscape");
      const lw = doc.internal.pageSize.getWidth();
      doc.setFillColor(...palette.ink);
      doc.rect(0, 0, lw, 15, "F");
      doc.setFillColor(...palette.orange);
      doc.rect(0, 0, 3.5, 15, "F");
      doc.setFont(undefined, "bold");
      doc.setFontSize(10);
      doc.setTextColor(255, 255, 255);
      doc.text(`${ecg.ecgType === "15-lead" ? "15" : "12"}-Lead ECG`, 14, 9.5);
      doc.setFont(undefined, "normal");
      doc.setFontSize(8.5);
      doc.text(documentTitle, lw - 14, 9.5, { align: "right" });
      const ly = 22 + drawTwelveLead(doc, {
        x: (lw - 250) / 2, y: 22, ecgType: ecg.ecgType,
        rhythmInterp: scenario.vitalSigns?.firstSet?.ecgInterpretation || "",
        twelveLeadFindings: ecg.twelveLeadFindings || "", fifteenLeadFindings: ecg.fifteenLeadFindings || "",
        hr: parseECGHR(scenario.vitalSigns?.firstSet?.hr), patternKey: ecg.patternKey || "",
      });
      if (ecg.twelveLeadFindings) {
        doc.setFont(undefined, "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(...palette.neutralText);
        doc.text(doc.splitTextToSize(sanitizePdfText(ecg.twelveLeadFindings), 250).slice(0, 4), (lw - 250) / 2, ly + 5);
      }
    }

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
      const scoreLabels = { "3": "Score 3: Unsafe to borderline", "5": "Score 5: Competent", "7": "Score 7: Exceptional" };
      const scoreColors = {
        "3": { bg: "transparent", border: "var(--vn-border)", label: "var(--vn-muted-text)" },
        "5": { bg: "transparent", border: "var(--vn-border)", label: "var(--vn-muted-text)" },
        "7": { bg: "transparent", border: "var(--vn-border)", label: "var(--vn-accent-text)" },
      };
      // Each domain folds on its own, so an instructor can open just the one they're scoring while the call runs.
      const setAll = (e, open) => {
        const wrap = e.currentTarget.closest(".grs-wrap");
        if (wrap) wrap.querySelectorAll("details.grs-domain").forEach((d) => { d.open = open; });
      };
      return (
        <div className="grs-wrap">
          <div className="grs-toolbar">
            <button type="button" className="sbar-btn a11y-focus" onClick={(e) => setAll(e, true)}>Open all</button>
            <button type="button" className="sbar-btn a11y-focus" onClick={(e) => setAll(e, false)}>Close all</button>
          </div>
          {Object.entries(data)
            .filter(([, scores]) => scores && ["3", "5", "7"].some((sc) => Array.isArray(scores[sc]) && scores[sc].length))
            .map(([domain, scores]) => (
            <details key={domain} className="grs-domain">
              <summary>
                {domainLabels[domain] || domain}
                <span className="grs-scores">3 · 5 · 7</span>
              </summary>
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
            </details>
          ))}
        </div>
      );
    }

    if (typeof data === "object" && data !== null) {
      return (
        <ul style={{ paddingLeft: "1rem", marginTop: "0.5rem" }}>
          {Object.entries(data).filter(([, value]) => !isBlankValue(value)).map(([key, value], index) => {
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

  // Short option sets as a row of buttons: every choice and the current one visible at a glance.
  const renderChoice = (label, name, options, currentValue) => (
    <div style={styles.fieldRow}>
      <span className="choice-label" id={`choice-${name}`}>{label}</span>
      <div className="choice-group" role="radiogroup" aria-labelledby={`choice-${name}`}>
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            role="radio"
            aria-checked={currentValue === opt}
            className="choice-btn a11y-focus"
            onClick={() => setFormData((prev) => ({ ...prev, [name]: opt }))}
            disabled={loading}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );

  const renderPillGroup = (label, options, currentValue, onChange) => {
    if (!USE_PILL_TOGGLES) {
      return (
        <div style={styles.fieldRow}>
          <label style={styles.pillLabel} htmlFor={`select-${label.toLowerCase().replace(/\s+/g, "-")}`}>{label}</label>
          <select
            id={`select-${label.toLowerCase().replace(/\s+/g, "-")}`}
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

  const getVitalColor = (key, rawVal) => {
    const str = String(rawVal || '');
    const num = parseFloat(str.replace(/[^0-9.]/g, ''));
    if (isNaN(num)) return 'var(--vn-ink)';
    const red = 'var(--vn-error-text)';
    const amber = '#c97a1a';
    const normal = 'var(--vn-ink)';
    // Children are coloured against their own age's ranges (a newborn at 140 is normal). Adults keep the ranges below.
    const ageText = scenario && scenario.patientDemographics && scenario.patientDemographics.age;
    const band = bandFor(ageText);
    if (band.key !== 'adult' && ['hr', 'rr', 'bp', 'spo2'].includes(key)) {
      if (key === 'hr') {
        const [low, high] = band.hr;
        if (num < (band.hrLowRed || low - 10) || num > high + 20) return red;
        if (num < low || num > high) return amber;
        return normal;
      }
      if (key === 'rr') {
        const [low, high] = band.rr;
        if (num < low - 6 || num > high + 10) return red;
        if (num < low || num > high) return amber;
        return normal;
      }
      if (key === 'bp') {
        const sys = parseFloat(str.split('/')[0]);
        if (isNaN(sys)) return normal;
        const floor = sbpFloor(ageText);
        if (sys < floor) return red;
        if (sys < floor + 10) return amber;
        return normal;
      }
      const age = parseAge(ageText);
      const nb = band.key === 'newborn' && age && age.minutes !== null ? newbornSpo2Floor(age.minutes) : null;
      if (nb !== null) return num < nb ? red : normal;
    }
    switch (key) {
      case 'hr':
        if (num < 50 || num > 120) return red;
        if (num < 60 || num > 100) return amber;
        return normal;
      case 'rr':
        if (num < 10 || num > 29) return red;
        if (num < 12 || num > 24) return amber;
        return normal;
      case 'bp': {
        const sys = parseFloat(str.split('/')[0]);
        if (isNaN(sys)) return normal;
        if (sys < 90 || sys > 179) return red;
        if (sys < 100 || sys > 139) return amber;
        return normal;
      }
      case 'spo2': {
        const pct = parseFloat(str.replace('%',''));
        if (isNaN(pct)) return normal;
        if (pct < 88) return red;
        if (pct < 92) return amber;
        return normal;
      }
      case 'etco2': {
        const val = parseFloat(str);
        if (isNaN(val)) return normal;
        if (val < 20 || val > 55) return red;
        if (val < 30 || val > 45) return amber;
        return normal;
      }
      case 'gcs': {
        const g = parseFloat(str);
        if (isNaN(g)) return normal;
        if (g < 9) return red;
        if (g < 14) return amber;
        return normal;
      }
      case 'bgl': {
        const b = parseFloat(str);
        if (isNaN(b)) return normal;
        // In the first days of life a glucose from 2.6 up is expected while the baby transitions: amber, not red.
        if (band.key === 'newborn' && b >= 2.6 && b < 4.0) return amber;
        if (b < 4.0 || b > 20) return red;
        if (b < 5.0 || b > 11) return amber;
        return normal;
      }
      case 'temp': {
        const t = parseFloat(str);
        if (isNaN(t)) return normal;
        if (t < 32 || t > 40) return red;
        if (t < 35 || t > 38.5) return amber;
        return normal;
      }
      default:
        return normal;
    }
  };

  const renderSection = (title, content) => {
    if (title === "vitalSigns") {
      const vs = scenario.vitalSigns;
      if (!vs) return null;
      const sets = [
        { label: vs.firstSet?.context || "Initial Assessment", data: vs.firstSet },
        { label: vs.secondSet?.context || "Reassessment", data: vs.secondSet },
        ...(Array.isArray(vs.additionalSets)
          ? vs.additionalSets.map((s, i) => ({ label: s.context || `Additional Set ${i + 1}`, data: s }))
          : []),
      ].filter(s => s.data && Object.values(s.data).some(Boolean));
      if (!sets.length) return null;
      // Student mode: only the sets reached so far. Later sets (and their labels, which name the care given)
      // stay hidden until the student asks for the next one.
      const staged = studentMode;
      const shownSets = staged ? sets.slice(0, setsShown) : sets;
      const hiddenCount = sets.length - shownSets.length;
      // A row per set and the vitals across, in the order the ACR vitals columns run, so what a student
      // reads here is what they write on the chart. The run sheet and the PDF use the same order.
      const cols = VITAL_COLUMNS.filter((f) => shownSets.some((set) => set.data?.[f.key]));
      return (
        <div style={{ ...styles.card }} key="vitalSigns">
          <h3 className="scenario-section-h2">Vital Signs</h3>
          <div className="vitals-scroll">
            <table className="vitals-table">
              <thead>
                <tr>
                  <th scope="col">Stage</th>
                  {cols.map((f) => <th scope="col" key={f.key}>{f.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {shownSets.map((set, si) => (
                  <tr key={si}>
                    <th scope="row">{set.label}</th>
                    {cols.map((f) => {
                      const val = set.data?.[f.key];
                      // "118, regular, strong": the number reads first, the description sits under it.
                      const [reading, ...detail] = String(val ?? "").split(/,\s*/);
                      return (
                        <td key={f.key} style={val ? { color: getVitalColor(f.key, val) } : undefined}>
                          {val ? reading : <span className="vitals-empty" aria-label="not recorded">·</span>}
                          {val && detail.length > 0 && <span className="vitals-detail">{detail.join(", ")}</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {staged && hiddenCount > 0 && (
            <div className="vitals-stage">
              <span>{hiddenCount === 1 ? "One more set" : `${hiddenCount} more sets`} later in the call.</span>
              <button type="button" className="sbar-btn a11y-focus" onClick={() => setsShownSet((n) => n + 1)}>
                Show the next set
              </button>
            </div>
          )}
        </div>
      );
    }
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
      ].slice(0, studentMode ? setsShown : undefined).filter((s) => s.ecg && s.ecg.trim());

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
                        patternKey: scenario.ecgFindings.patternKey || '',
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
                        patternKey: scenario.ecgFindings.patternKey || '',
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
            onClick={() => setStudentMode((v) => !v)}
            style={styles.shiftToggle}
            className="a11y-focus"
            aria-pressed={studentMode}
            title={studentMode
              ? "Student mode is on: the answers stay folded until you've made your decisions. Click for instructor mode."
              : "Instructor mode: everything is open. Click for student mode."}
          >
            <FaUserGraduate aria-hidden="true" />
            <span>{studentMode ? "Student mode" : "Instructor mode"}</span>
          </button>
        </div>
      </div>

      <div style={styles.mainLayout}>
        <div style={styles.leftPanel}>
          <div style={styles.formBox}>
            <button onClick={handleSubmit} disabled={loading} style={styles.button} className="a11y-focus">
              {loading ? <FaSpinner className="spin" /> : "Generate Scenario"}
            </button>

            {renderChoice("Semester", "semester", SEMESTERS, formData.semester)}
            {renderPillGroup("Type", SCENARIO_TYPES, formData.type, (val) => setFormData(prev => ({ ...prev, type: val })))}
            {renderPillGroup("Environment", ENVIRONMENTS, formData.environment, (val) => setFormData(prev => ({ ...prev, environment: val })))}
            {renderChoice("Complexity", "complexity", COMPLEXITIES, formData.complexity)}
            {renderChoice("Scenario Friction", "scenarioFriction", SCENARIO_FRICTION_LEVELS, formData.scenarioFriction)}
            {renderChoice("Generation Depth", "generationDepth", GENERATION_DEPTHS, formData.generationDepth)}


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
            {canReset && (
              <button type="button" className="form-reset a11y-focus" onClick={handleReset} disabled={loading}
                title="Put every option back to the default and clear the current scenario">
                <FaUndoAlt aria-hidden="true" /> Start over
              </button>
            )}
          </div>

          {recent.length > 0 && (
            <details className="side-card">
              <summary className="side-card-title">Recent scenarios ({recent.length})</summary>
              <p className="side-note">Kept on this device only.</p>
              {recent.map((r) => (
                <button key={r.id} type="button" className="side-link a11y-focus" onClick={() => restoreRecent(r)} disabled={loading}>
                  <span className="side-link-title">{r.title}</span>
                  <span className="side-note">
                    {[r.formData && r.formData.semester && `Sem ${r.formData.semester}`, r.formData && r.formData.type,
                      new Date(r.savedAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })]
                      .filter(Boolean).join(" · ")}
                  </span>
                </button>
              ))}
              <button type="button" className="side-clear a11y-focus" onClick={clearRecent}>Clear the list</button>
            </details>
          )}
        </div>

        <div style={styles.rightPanel}>
          {showInfoSection && (
            <section className="landing" aria-labelledby="landing-lead">
              <div className="landing-intro">
                <p className="landing-eyebrow">Ontario PCP · ALS PCS v5.4</p>
                <h2 id="landing-lead" className="landing-lead">Simulation scenarios for lab and self-practice.</h2>
                <p className="landing-sub">Every call stays inside PCP scope, the patient responds to what you do, and the GRS anchors are written for that call.</p>
              </div>

              <h3 className="landing-h">How it works</h3>
              <ol className="landing-steps">
                <li className="landing-step">
                  <span className="landing-step-num" aria-hidden="true">1</span>
                  <h4>Build the call</h4>
                  <p>Pick the options and press Generate Scenario.</p>
                </li>
                <li className="landing-step">
                  <span className="landing-step-num" aria-hidden="true">2</span>
                  <h4>Run it first</h4>
                  <p>Student mode keeps the answers folded until you press <i>I've made my decisions.</i></p>
                </li>
                <li className="landing-step">
                  <span className="landing-step-num" aria-hidden="true">3</span>
                  <h4>Chart it</h4>
                  <p>Download a Practice ACR with the dispatch filled in. Chart in Acrobat Reader and press Check my ACR.</p>
                </li>
                <li className="landing-step">
                  <span className="landing-step-num" aria-hidden="true">4</span>
                  <h4>Get feedback</h4>
                  <p>Upload it on <a href="#acr-review">ACR Review</a>. It knows the scenario and asks about anything that doesn't match.</p>
                </li>
              </ol>

              <h3 className="landing-h">What's in a scenario</h3>
              <dl className="landing-parts">
                <div><dt>The Call</dt><dd>Dispatch and priority colour, the scene, the patient, history, exam and vital signs. A 12-lead when the call needs one.</dd></div>
                <div><dt>What Was Happening</dt><dd>The clinical reasoning, and how the patient responds to good care, delayed care and the wrong care.</dd></div>
                <div><dt>Expected Management</dt><dd>What the crew should do, and the directive reasons behind it.</dd></div>
                <div><dt>Teaching Points</dt><dd>A summary of the case, the debrief points, learning objectives, and what the instructor should watch for.</dd></div>
                <div><dt>Self-Assessment</dt><dd>Reflection questions and GRS anchors for all seven domains.</dd></div>
              </dl>

              <div className="landing-ref">
                <details className="landing-acc">
                  <summary>The options</summary>
                  <dl className="landing-parts landing-parts-compact">
                    <div><dt>Semester</dt><dd>2 is assessment and BLS care, no medications. 3 adds directive-based treatment and medication decisions. 4 expects integrated reasoning and prioritizing under pressure.</dd></div>
                    <div><dt>Type</dt><dd>Medical, Trauma, Cardiac, Respiratory or Environmental.</dd></div>
                    <div><dt>Environment</dt><dd>Where the call happens. It changes access, scene and transport.</dd></div>
                    <div><dt>Complexity</dt><dd>Simple is one clear problem done well. Complex adds competing findings, gaps in the history and harder priorities.</dd></div>
                    <div><dt>Scenario Friction</dt><dd>Clean keeps the scene simple. Pressured adds scene problems that change how you assess, package and move.</dd></div>
                    <div><dt>Generation Depth</dt><dd>Quick Draft is faster, with one-line GRS anchors. Detailed gives fuller progression and reasoning, and anchors of two or three sentences.</dd></div>
                    <div><dt>Instructor Prompt</dt><dd>Optional. Steer the call with a patient, a twist or a teaching focus. Specific works better than general.</dd></div>
                  </dl>
                </details>
                <details className="landing-acc">
                  <summary>The buttons</summary>
                  <dl className="landing-parts landing-parts-compact">
                    <div><dt>Night Shift</dt><dd>Dark mode, and calls set overnight.</dd></div>
                    <div><dt>Student / Instructor mode</dt><dd>Student mode folds the answers until you've made your decisions. Instructor mode opens everything.</dd></div>
                    <div><dt>Start over</dt><dd>Under the form. Puts the options back to the defaults and clears the scenario. Your last options are otherwise remembered on this device.</dd></div>
                    <div><dt>Scenario bar</dt><dd>Stays at the top while you read: Export (PDF), Run sheet (a printable page for lab), Practice ACR, Share link, and a tab for each section.</dd></div>
                    <div><dt>Share link</dt><dd>Copies a link to the scenario. Anyone who opens it gets the same call; new visitors start in student mode.</dd></div>
                    <div><dt>Dispatch</dt><dd>Plays the call over the radio, once. Students write down what they caught, then check it against the transcript.</dd></div>
                    <div><dt>Monitor screen</dt><dd>Run the call in lab with a patient monitor. Pop it out onto a TV, or show it beside your controls. Press the vitals set that matches what the crew did.</dd></div>
                    <div><dt>Make a variant</dt><dd>A new case that keeps the decision this one tests, with a different patient, setting and story. Add a distractor or a later cue to make it harder.</dd></div>
                    <div><dt>Recent scenarios</dt><dd>Your last ten, in the side panel, kept on this device only.</dd></div>
                  </dl>
                </details>
              </div>

              <p className="landing-note">Scenarios are written by AI to the PCP directives in the Ontario ALS PCS v5.4, and auxiliary directives are labelled. Check doses and directive details against the current Ontario BLS and ALS PCS before you teach from them.</p>
            </section>
          )}
          {scenario && (
            <>
            <div ref={outputRef} style={{ ...styles.outputBox, scrollMarginTop: isMobile ? "12px" : "90px" }}>
              {monitorOpen && <LiveRun scenario={scenario} studentMode={studentMode} onClose={() => setMonitorOpen(false)} />}
              {dispatchOpen && <RadioDispatch scenario={scenario} environment={formData.environment} onClose={() => setDispatchOpen(false)} />}
              {variantOpen && (
                <VariantDialog
                  scenario={scenario}
                  pressuredNow={formData.scenarioFriction === "Pressured"}
                  onMake={makeVariant}
                  onClose={() => setVariantOpen(false)}
                />
              )}
              <div className="scenario-bar">
                <div className="scenario-bar-top">
                  <h2 className="scenario-output-title">{scenario.title || "Scenario"}</h2>
                  <div className="scenario-bar-actions">
                    <button type="button" className="sbar-btn a11y-focus" onClick={exportToPDF} title="The whole scenario as a PDF">
                      <FaFilePdf aria-hidden="true" /> Export
                    </button>
                    <button type="button" className="sbar-btn a11y-focus" onClick={showRunSheet} title="A printable page for running this call in lab">
                      <FaClipboardList aria-hidden="true" /> Run sheet
                    </button>
                    <button type="button" className="sbar-btn a11y-focus" onClick={downloadPracticeAcr} disabled={acrBusy}
                      title="An ACR with this call's dispatch details filled in, for ACR Review">
                      {acrBusy ? <FaSpinner className="spin" aria-hidden="true" /> : <FaFileMedical aria-hidden="true" />} Practice ACR
                    </button>
                    <button type="button" className="sbar-btn a11y-focus" onClick={shareScenario} title="Copy a link to this scenario">
                      <FaLink aria-hidden="true" /> Share link
                    </button>
                    <button type="button" className="sbar-btn a11y-focus" onClick={() => setDispatchOpen(true)} title="Hear the dispatch over the radio and write down what you catch">
                      <FaBroadcastTower aria-hidden="true" /> Dispatch
                    </button>
                    <button type="button" className="sbar-btn a11y-focus" onClick={() => setMonitorOpen(true)} title="Run this call in lab with a live patient monitor">
                      <FaHeartbeat aria-hidden="true" /> Monitor screen
                    </button>
                    <button type="button" className="sbar-btn a11y-focus" onClick={() => setVariantOpen(true)} disabled={loading}
                      title="A new case that tests the same decision with a different patient">
                      <FaRandom aria-hidden="true" /> Make a variant
                    </button>
                  </div>
                </div>
                <nav className="scenario-tabs" aria-label="Scenario sections">
                  {Object.keys(SECTION_GROUPS).map((g) => (
                    <button key={g} type="button" className="scenario-tab a11y-focus" onClick={() => jumpTo(g)}>
                      {g}{studentMode && collapsedSections[g] ? <span className="scenario-tab-note"> · folded</span> : null}
                    </button>
                  ))}
                </nav>
              </div>
              {scenario.variantOf && scenario.variantOf.target && (
                <div className="cv-banner">
                  <strong>Variant{scenario.variantOf.title ? ` of ${scenario.variantOf.title}` : ""}</strong>
                  <p>Keeps the decision: {scenario.variantOf.target}</p>
                </div>
              )}
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
                <div key={groupName} id={groupId(groupName)} className="scenario-group">
                  {groupName === "What Was Happening" && (
                    <div className="scenario-pause-card" style={{ marginTop: "1.25rem" }}>
                      <span className="scenario-pause-label">Pause Before Reading On</span>
                      <p>
                        Stop here. Work through the call in your head or with a partner.
                        What is your working impression? What would you do next and why?
                        Write it down or say it out loud before reading on.
                      </p>
                      {studentMode && STUDENT_LOCKED_GROUPS.some((g) => collapsedSections[g]) && (
                        <button type="button" className="scenario-reveal-btn a11y-focus" onClick={() => setCollapsedSections({})}>
                          I've made my decisions. Show the rest.
                        </button>
                      )}
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
            <div className="loading-elapsed" aria-live="off">{formatElapsed(elapsed)}</div>
            <div style={{ ...styles.loadingSubtext, marginTop: "0.2rem", fontSize: "0.85rem", color: "var(--vn-loading-muted)", textAlign: "center" }}>
              A Quick Draft usually takes under a minute. Detailed and Complex can take two to three.
              {elapsed >= 60 && (
                <><br />Still going? The first scenario after a quiet spell is slower while the server wakes up.</>
              )}
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
              width: selectedECGImage?.rhythm ? "min(92vw, 860px)" : "min(94vw, 920px)",
              maxWidth: "92vw",
              maxHeight: "90vh",
              overflow: "auto",
              boxShadow: "0 8px 16px rgba(0,0,0,0.3)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {selectedECGImage && selectedECGImage.rhythm ? (
              <RhythmStripSVG rhythm={selectedECGImage.rhythm} hr={selectedECGImage.hr} isNightShift={isNightShift} patternKey={scenario?.ecgFindings?.patternKey || ""} />
            ) : selectedECGImage && (selectedECGImage.type === '12lead' || selectedECGImage.type === '15lead') ? (
              <TwelveLeadSVG
                ecgType={selectedECGImage.ecgType}
                rhythmInterp={selectedECGImage.rhythmInterp}
                twelveLeadFindings={selectedECGImage.twelveLeadFindings}
                fifteenLeadFindings={selectedECGImage.fifteenLeadFindings}
                hr={selectedECGImage.hr}
                isNightShift={isNightShift}
                patternKey={selectedECGImage.patternKey || ''}
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
    flexWrap: isMobile ? "wrap" : "nowrap",
    justifyContent: isMobile ? "flex-start" : "flex-end",
    flex: isMobile ? "1 1 auto" : "0 0 auto",
    minWidth: 0,
    overflowX: isMobile ? "visible" : "auto",
    overflowY: isMobile ? "visible" : "hidden",
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
