import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import jsPDF from "jspdf";
import { FaSpinner, FaFilePdf, FaLightbulb, FaMoon, FaSun, FaUndoAlt } from "react-icons/fa";

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

const SCENARIO_TYPES = [
  "Medical",
  "Trauma",
  "Cardiac",
  "Respiratory",
  "Environmental",
];

const SEMESTERS = ["2", "3", "4"];
const ENVIRONMENTS = ["Urban", "Rural", "Wilderness", "Industrial", "Home", "Public Space"];
const COMPLEXITIES = ["Simple", "Moderate", "Complex"];

const FIELD_TOOLTIPS = {
  semester: "Training level: 2 = foundational skills, 3 = intermediate assessment/treatment, 4 = advanced decision-making with rare/complex presentations",
  type: "Scenario category: Medical (illness), Trauma (injury), Cardiac (heart/rhythm), Respiratory (breathing), Environmental (exposure/environmental illness)",
  environment: "Call location: Urban (city), Rural (countryside), Wilderness (remote outdoor), Industrial (worksite), Home (residence), Public Space (crowd areas, venues)",
  complexity: "Case difficulty: Simple (straightforward presentation), Moderate (typical multi-system or subtle findings), Complex (rare presentations or multiple competing diagnoses)",
};

const SECTION_GROUPS = {
  "Scene Info": ["scenarioIntro", "title", "callInformation", "incidentNarrative"],
  "Patient Info": ["patientDemographics", "patientPresentation", "opqrst", "sample"],
  Assessment: ["physicalExam", "vitalSigns"],
  "Clinical Reasoning": [
    "caseProgression",
    "differentialDiagnosis",
    "expectedTreatment",
    "protocolNotes",
    "scenarioRationale",
    "clinicalReasoning",
  ],
  Education: [
    "learningObjectives",
    "selfReflectionPrompts",
    "grsAnchors",
  ],
};

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
  caseProgression: "Case Progression",
  transportPhase: "Transport Phase",
  expectedTreatment: "Expected Treatment",
  protocolNotes: "Protocol Notes",
  learningObjectives: "Learning Objectives",
  teachersPoints: "Teaching Points",
  directiveSources: "Directive Sources",
  customPrompt: "Custom Prompt",
  scenarioRationale: "Scenario Rationale & Teaching Tips",
};

const cuePhaseLabelMap = {
  arrival: "Arrival",
  history: "History",
  assessment: "Assessment",
  treatment: "Treatment",
  protocol: "Protocol",
  progression: "Progression",
  transport: "Transport",
  reasoning: "Reasoning",
};

const UI_TEACHING_CUES_ENABLED = false;

function getCuePopoverPlacement(cueTag, cueIndex, isMobile) {
  if (isMobile) {
    return {
      top: "1.8rem",
      bottom: "auto",
      left: 0,
      right: "auto",
    };
  }

  const opening = {
    transport: { top: "auto", bottom: "1.9rem", left: 0, right: "auto" },
    progression: { top: "auto", bottom: "1.9rem", left: 0, right: "auto" },
    protocol: { top: "auto", bottom: "1.9rem", left: 0, right: "auto" },
    reasoning: { top: "1.9rem", bottom: "auto", left: "auto", right: 0 },
  };

  if (opening[cueTag]) return opening[cueTag];

  return cueIndex % 2 === 0
    ? { top: "1.8rem", bottom: "auto", left: 0, right: "auto" }
    : { top: "auto", bottom: "1.9rem", left: 0, right: "auto" };
}

const ScenarioForm = () => {
  const [scenario, setScenario] = useState(null);
  const [loading, setLoading] = useState(false);
  // Info section visibility: show only before scenario is generated
  const showInfoSection = !scenario && !loading;
  const [formData, setFormData] = useState({
    semester: "3",
    type: "Medical",
    environment: "Urban",
    complexity: "Moderate",
    shiftMode: "Day Shift",
    includeTeachingCues: UI_TEACHING_CUES_ENABLED,
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
    "Asking the patient to rate their pain 1–10. They said 11. Classic.",
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
  const [selectedCue, setSelectedCue] = useState(null);
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
    formData.complexity !== "Moderate" ||
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
      setSelectedCue(null);
    };

    document.addEventListener("pointerdown", closeCueOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeCueOnOutsideClick);
  }, []);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key !== "Escape") return;
      setSelectedCue(null);
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
    const cueRegex = /\*\(💡(?:[a-z]+\|)?\s*(.+?)\s*\)\*/gi;
    const stripNonPrintableAscii = (input) =>
      Array.from(input)
        .filter((char) => {
          const code = char.charCodeAt(0);
          return code === 9 || code === 10 || code === 13 || (code >= 32 && code <= 126);
        })
        .join("");

    return String(value ?? "")
      .replace(cueRegex, UI_TEACHING_CUES_ENABLED ? "Teaching cue: $1" : "")
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
      complexity: "Moderate",
      shiftMode: "Day Shift",
      includeTeachingCues: UI_TEACHING_CUES_ENABLED,
      customPrompt: "",
    });
    setScenario(null);
    setSelectedECGImage(null);
    setSelectedCue(null);
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
      setSelectedCue(null);
      setSelectedECGImage(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    setScenario(null);
    setSelectedCue(null);
    setSelectedECGImage(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const baseURL = process.env.REACT_APP_API_BASE_URL || "http://localhost:10000";
    const payload = {
      ...formData,
      includeTeachingCues: UI_TEACHING_CUES_ENABLED ? formData.includeTeachingCues : false,
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
        // User cancelled — silently dismiss
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
      ink: [18, 48, 71],
      teal: [13, 139, 139],
      tealDeep: [10, 110, 114],
      orange: [242, 140, 40],
      paper: [247, 244, 238],
      softBlue: [223, 240, 245],
      neutralText: [40, 58, 76],
      mutedText: [95, 116, 133],
      line: [193, 214, 220],
    };
    const pageHeight = doc.internal.pageSize.getHeight();
    const pageWidth = doc.internal.pageSize.getWidth();
    const marginX = 20;
    const marginY = 20;
    const textColumnX = marginX + 5;
    const maxLineWidth = pageWidth - marginX - textColumnX;
    const bodySize = 10;
    const bodyLH = 5.8;
    const footerY = pageHeight - 12;
    let y = marginY;

    const documentTitle = sanitizePdfText(scenario.title || "Untitled Scenario") || "Untitled Scenario";
    const exportedAt = new Date().toLocaleString();

    const safeFileName = sanitizePdfText(documentTitle)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "scenario";

    const preferredOrder = [
      "scenarioIntro",
      "title",
      "callInformation",
      "patientDemographics",
      "patientPresentation",
      "incidentNarrative",
      "sceneArrival",
      "firstImpression",
      "initialAssessment",
      "historyGathering",
      "opqrst",
      "sample",
      "medications",
      "allergies",
      "pastMedicalHistory",
      "physicalExam",
      "secondaryAssessment",
      "additionalAssessments",
      "vitalSigns",
      "caseProgression",
      "transportPhase",
      "expectedTreatment",
      "protocolNotes",
      "learningObjectives",
      "selfReflectionPrompts",
      "grsAnchors",
      "teachersPoints",
      "scenarioRationale",
      "clinicalReasoning",
      "directiveSources",
      "customPrompt"
    ];

    const orderedKeys = [...new Set([...preferredOrder, ...Object.keys(scenario)])];
    const sectionEntries = orderedKeys
      .filter((key) => key in scenario)
      .map((key) => {
        const formattedValue = formatFieldValue(scenario[key]);
        if (!formattedValue) return null;
        return { key, label: TITLE_MAP[key] || capitalizeFirstLetter(key), formattedValue };
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
      doc.setFillColor(249, 253, 255);
      doc.rect(0, 0, pageWidth, pageHeight, "F");
    };

    const drawContentHeader = () => {
      const headerBarWidth = 3;
      doc.setFillColor(...palette.ink);
      doc.rect(0, 0, pageWidth, 16, "F");
      doc.setFillColor(...palette.orange);
      doc.rect(0, 0, headerBarWidth, 16, "F");
      doc.setFont(undefined, "bold");
      doc.setFontSize(8.8);
      doc.setTextColor(244, 252, 255);
      doc.text("VitalNotes Scenario Generator", textColumnX, 10.2);

      doc.setFont(undefined, "normal");
      doc.setFontSize(7.8);
      doc.setTextColor(206, 230, 238);
      doc.text("Protocol-aligned simulation scenario", textColumnX, 14.1);

      doc.setDrawColor(...palette.line);
      doc.setLineWidth(0.2);
      doc.line(0, 16, pageWidth, 16);
    };

    const drawPageFooter = (pageNum, total) => {
      doc.setFont(undefined, "normal");
      doc.setFontSize(8);
      doc.setTextColor(...palette.mutedText);
      doc.setDrawColor(...palette.line);
      doc.setLineWidth(0.2);
      doc.line(marginX, footerY, pageWidth - marginX, footerY);
      doc.text(documentTitle, marginX, footerY + 4.5);
      doc.text(`Page ${pageNum} of ${total}`, pageWidth - marginX, footerY + 4.5, { align: "right" });
    };

    // ── Cover page ──────────────────────────────────────────────────────────
    drawCoverBackground();
    drawContentHeader();

    y = 30;
    doc.setFont(undefined, "bold");
    doc.setFontSize(20);
    doc.setTextColor(...palette.ink);
    const titleWrapped = doc.splitTextToSize(documentTitle, maxLineWidth);
    doc.text(titleWrapped, textColumnX, y);
    y += titleWrapped.length * 8.4 + 5;

    doc.setDrawColor(...palette.line);
    doc.setLineWidth(0.3);
    doc.line(textColumnX, y, pageWidth - marginX, y);
    y += 7;

    const metaFields = [
      ["Shift", sanitizePdfText(formData.shiftMode)],
      ["Semester", sanitizePdfText(formData.semester)],
      ["Call Type", sanitizePdfText(scenario?.callInformation?.type || formData.type)],
      ["Environment", sanitizePdfText(formData.environment)],
      ["Complexity", sanitizePdfText(formData.complexity)],
    ];
    const visibleMetaFields = metaFields.filter(([, val]) => Boolean(val));
    const metaRowHeight = 6.7;
    const metaPaddingTop = 4.8;
    const metaPaddingBottom = 3.8;
    const metaCardY = y - 3.5;
    const metaCardHeight = metaPaddingTop + metaPaddingBottom + (visibleMetaFields.length * metaRowHeight);
    const metaLabelX = textColumnX;
    const metaValueX = textColumnX + 36;

    doc.setFillColor(...palette.softBlue);
    doc.roundedRect(marginX - 2, metaCardY, pageWidth - marginX * 2 + 4, metaCardHeight, 3, 3, "F");
    doc.setDrawColor(...palette.line);
    doc.roundedRect(marginX - 2, metaCardY, pageWidth - marginX * 2 + 4, metaCardHeight, 3, 3, "S");

    let metaY = metaCardY + metaPaddingTop;
    visibleMetaFields.forEach(([label, val], idx) => {
      doc.setFont(undefined, "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(...palette.tealDeep);
      doc.text(`${label}:`, metaLabelX, metaY);
      doc.setFont(undefined, "normal");
      doc.setTextColor(...palette.neutralText);
      doc.text(val, metaValueX, metaY);

      if (idx < visibleMetaFields.length - 1) {
        doc.setDrawColor(210, 226, 233);
        doc.setLineWidth(0.12);
        doc.line(metaLabelX, metaY + 2.2, pageWidth - marginX - 2, metaY + 2.2);
      }

      metaY += metaRowHeight;
    });

    y = metaCardY + metaCardHeight + 5;
    doc.setDrawColor(...palette.line);
    doc.setLineWidth(0.2);
    doc.line(textColumnX, y, pageWidth - marginX, y);
    y += 6;

    doc.setFont(undefined, "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...palette.mutedText);
    doc.text(`Generated: ${exportedAt}`, textColumnX, y);
    y += 10;

    // ── Sections ─────────────────────────────────────────────────────────────
    sectionEntries.forEach((entry) => {
      const sectionBarWidth = 2.2;
      const sectionTextX = textColumnX;
      // Section heading
      needsNewPage(16);
      y += 4;

      doc.setFillColor(...palette.softBlue);
      doc.roundedRect(marginX - 1.5, y - 5.5, pageWidth - marginX * 2 + 3, 8.5, 2.2, 2.2, "F");
      doc.setFillColor(...palette.orange);
      doc.rect(marginX - 1.5, y - 5.5, sectionBarWidth, 8.5, "F");

      doc.setFont(undefined, "bold");
      doc.setFontSize(12);
      doc.setTextColor(...palette.ink);
      doc.text(entry.label, sectionTextX, y);
      y += 2.5;
      doc.setDrawColor(...palette.line);
      doc.setLineWidth(0.25);
      doc.line(textColumnX, y, pageWidth - marginX, y);
      y += 5;

      // Body content
      const rawLines = String(entry.formattedValue).split("\n");
      rawLines.forEach((rawLine) => {
        const expanded = rawLine.replace(/\t/g, "  ");
        const trimmed = expanded.trim();
        if (!trimmed) {
          y += 2.5;
          return;
        }

        const isBullet = trimmed.startsWith("- ");
        const isLabelLine = /^[A-Z][^:]{1,35}:\s*$/.test(trimmed);
        const sanitizedLine = sanitizePdfText(isBullet ? trimmed.slice(2) : trimmed);

        // Keep pure label lines as headings; render all other content as point-form lines.
        const shouldBulletize = !isLabelLine;
        const displayText = shouldBulletize ? `- ${sanitizedLine}` : sanitizedLine;
        const indent = shouldBulletize ? 3.5 : 0;
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
    });

    // ── Footer on every page ─────────────────────────────────────────────────
    const totalPages = doc.getNumberOfPages();
    for (let p = 1; p <= totalPages; p += 1) {
      doc.setPage(p);
      drawPageFooter(p, totalPages);
    }

    doc.save(`${safeFileName}.pdf`);
  };

  const renderSafeContent = (data, parentKey = "root") => {
    if (typeof data === "string") {
      if (!UI_TEACHING_CUES_ENABLED) {
        const textWithoutCues = data
          .replace(/\*\(💡(?:[a-z]+\|)?\s*.+?\s*\)\*/gi, "")
          .replace(/\s{2,}/g, " ")
          .trim();

        return <span>{textWithoutCues}</span>;
      }

      const parts = [];
      const cueRegex = /\*\(💡(?:([a-z]+)\|)?\s*(.+?)\s*\)\*/gi;
      let lastIndex = 0;
      let match;
      let localCueIndex = 0;

      while ((match = cueRegex.exec(data)) !== null) {
        const matchStart = match.index;
        const matchEnd = cueRegex.lastIndex;
        const cueTag = String(match[1] || "").toLowerCase();
        const cueText = match[2];
        const cueIndex = localCueIndex++;
        const id = `cue-${parentKey}-${cueTag || "general"}-${matchStart}-${cueIndex}`;
        const placement = getCuePopoverPlacement(cueTag, cueIndex, isMobile);
        const phaseLabel = cuePhaseLabelMap[cueTag] || "Teaching Cue";

        if (matchStart > lastIndex) {
          parts.push(<span key={`text-${id}`}>{data.slice(lastIndex, matchStart)}</span>);
        }

        parts.push(
          <span key={`cue-${id}`} style={{ position: "relative", display: "inline-block" }}>
            <button
              type="button"
              className="a11y-focus"
              aria-label={selectedCue === id ? "Hide teaching cue" : "Show teaching cue"}
              aria-pressed={selectedCue === id}
              title={selectedCue === id ? "Hide teaching cue" : "Show teaching cue"}
              data-cue-toggle="true"
              style={{
                cursor: "pointer",
                marginLeft: "4px",
                color: selectedCue === id ? "#facc15" : "#eab308",
                verticalAlign: "middle",
                background: "transparent",
                border: "none",
                padding: isMobile ? "0.35rem" : "0.2rem",
                minWidth: isMobile ? "36px" : "28px",
                minHeight: isMobile ? "36px" : "28px",
                borderRadius: "6px",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedCue((prev) => (prev === id ? null : id));
              }}
            >
              <FaLightbulb aria-hidden="true" />
            </button>
            {selectedCue === id && (
              <div
                data-cue-popover="true"
                style={{
                  position: "absolute",
                  background: "var(--vn-cue-popover-bg)",
                  color: "var(--vn-cue-popover-text)",
                  border: "1px solid var(--vn-cue-popover-border)",
                  padding: "0.5rem 0.75rem",
                  borderRadius: "8px",
                  zIndex: 10000,
                  top: placement.top,
                  bottom: placement.bottom,
                  left: placement.left,
                  right: placement.right,
                  minWidth: isMobile ? "180px" : "240px",
                  maxWidth: isMobile ? "90vw" : "420px",
                  whiteSpace: "normal",
                  boxShadow: "0 10px 22px rgba(0,0,0,0.28)",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div
                  style={{
                    fontSize: "0.72rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    color: "var(--vn-cue-popover-label)",
                    marginBottom: "0.35rem",
                    fontWeight: 700,
                  }}
                >
                  {phaseLabel}
                </div>
                {cueText}
              </div>
            )}
          </span>
        );

        parts.push(<span key={`cue-spacer-${id}`}> </span>);
        lastIndex = matchEnd;
      }

      if (lastIndex < data.length) {
        parts.push(<span key={`text-end-${parentKey}`}>{data.slice(lastIndex)}</span>);
      }

      return <span>{parts}</span>;
    }

    if (Array.isArray(data)) {
      return (
        <ul style={{ paddingLeft: "1rem", marginTop: "0.5rem" }}>
          {data.map((item, index) => (
            <li key={index}>{renderSafeContent(item, `${parentKey}-${index}`)}</li>
          ))}
        </ul>
      );
    }

    if (typeof data === "object" && data !== null) {
      return (
        <ul style={{ paddingLeft: "1rem", marginTop: "0.5rem" }}>
          {Object.entries(data).map(([key, value], index) => {
            const contextKey = `${parentKey}-${key}`;

            if (key === "ecgInterpretation") {
              const interpretation = typeof value === "string" ? value : "";
              const rawECG = interpretation.trim();
              const ecgImageUrl = ecgImageMap[rawECG] || null;

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
                  {ecgImageUrl ? (
                    <button
                      type="button"
                      className="a11y-focus"
                      aria-label="Open ECG image"
                      title="Open ECG image"
                      style={{
                        cursor: "pointer",
                        textDecoration: "underline",
                        color: "#0ea5e9",
                        marginLeft: "6px",
                        marginRight: "6px",
                        background: "transparent",
                        border: "none",
                        padding: isMobile ? "0.2rem 0.35rem" : "0.1rem 0.25rem",
                        borderRadius: "6px",
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedECGImage(ecgImageUrl);
                      }}
                    >
                      📈
                    </button>
                  ) : (
                    "📈"
                  )}
                  {interpretation}
                </li>
              );
            }

            if (key === "additionalSets" && Array.isArray(value)) {
              return value.map((setItem, setIndex) => (
                <li key={`additionalSet-${setIndex}`}>
                  <strong>Additional Set {setIndex + 1}{setItem?.context ? ` — ${setItem.context}` : ""}:</strong>
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

  const renderSection = (title, content) => {
    const isTeachingCue = typeof content === "string" && content.includes("💡");
    const isProtocolNote = title === "protocolNotes";

    const highlightStyle = isTeachingCue
      ? {
          backgroundColor: "var(--vn-info-card-bg)",
          borderLeft: "5px solid var(--vn-info-card-border)",
          padding: "1rem",
          borderRadius: "8px",
          marginBottom: "1rem",
        }
      : isProtocolNote
        ? {
            backgroundColor: "var(--vn-protocol-card-bg)",
            borderLeft: "5px solid var(--vn-protocol-card-border)",
            padding: "1rem",
            borderRadius: "8px",
            marginBottom: "1rem",
          }
        : {};

    return (
      <div style={{ ...styles.card, ...highlightStyle }} key={title}>
        <h3 style={styles.cardTitle}>{TITLE_MAP[title] || formatLabel(title)}</h3>
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
        <h1 style={styles.heading}>Scenario Generator 1.0</h1>
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

            {["semester", "type", "environment", "complexity"].map((field) => (
              <div key={field} style={styles.fieldRow}>
                <label title={FIELD_TOOLTIPS[field]} style={{ cursor: "help" }}>
                  {capitalizeFirstLetter(field)}:
                </label>
                <select
                  name={field}
                  value={formData[field]}
                  onChange={handleChange}
                  style={styles.select}
                  className="a11y-focus"
                  title={FIELD_TOOLTIPS[field]}
                >
                  {(field === "semester"
                    ? SEMESTERS
                    : field === "type"
                      ? SCENARIO_TYPES
                      : field === "environment"
                        ? ENVIRONMENTS
                        : COMPLEXITIES
                  ).map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
            ))}

            {UI_TEACHING_CUES_ENABLED && (
              <div style={styles.fieldRow}>
                <label>
                  <input
                    type="checkbox"
                    name="includeTeachingCues"
                    checked={formData.includeTeachingCues}
                    onChange={handleChange}
                    style={{ marginRight: "0.5rem" }}
                    className="a11y-focus"
                  />
                  Include 💡 Teaching Cues
                </label>
              </div>
            )}

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
              <h2 style={{marginTop: 0, color: 'var(--vn-teal-deep, #0a6e72)'}}>Who this is for</h2>
              <p style={{marginBottom: '1.2rem'}}>Paramedic educators, simulation facilitators, and learners seeking high-fidelity, protocol-aligned scenario practice with built-in teaching cues.</p>
              <h2 style={{marginTop: 0, color: 'var(--vn-orange, #f28c28)'}}>How to use</h2>
              <ol style={{paddingLeft: '1.2em', margin: 0}}>
                <li>
                  <b>Set scenario parameters:</b>
                  <ul style={{marginTop: '0.5em', marginBottom: '0.5em'}}>
                    <li><b>Semester:</b> Select the learner level. Lower semesters (2) generate foundational cases; higher semesters (4) create advanced, complex scenarios.</li>
                    <li><b>Type:</b> Choose the main scenario category (Medical, Trauma, Cardiac, Respiratory, Environmental) to focus the case content.</li>
                    <li><b>Environment:</b> Pick the setting (Urban, Rural, Wilderness, Industrial, Home, Public Space) to shape the context and available resources.</li>
                    <li><b>Complexity:</b> Adjust the case difficulty. Simple = straightforward, Moderate = typical multi-system, Complex = rare or challenging presentations.</li>
                  </ul>
                </li>
                <li>
                  <b>Use the Instructor Prompt (optional):</b>
                  <ul style={{marginTop: '0.5em', marginBottom: '0.5em'}}>
                    <li>Enter a specific theme, patient profile, or teaching focus to customize the scenario. Example: <i>"Make this a sports injury in a teen with subtle signs of head trauma."</i></li>
                    <li>Be as clear and concrete as possible for best results. You can specify age, setting, clinical twist, or learning goal.</li>
                    <li>Leave blank for a general scenario based on your other selections.</li>
                  </ul>
                </li>
                <li>Click <b>Generate Scenario</b> to create a detailed, protocol-aligned case with teaching cues.</li>
                <li>Use the <b>Night Shift</b> button (moon/sun icon) to toggle between day and night themes and shift-specific scenario flavor.</li>
                <li>Use the <b>Reset</b> button to clear all fields and start over.</li>
                <li>Use the <b>Export</b> button to download the generated scenario as a PDF (enabled after generating a scenario).</li>
              </ol>
            </section>
          )}
          {scenario && (
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
                  <h2 style={styles.sectionHeadingWrap}>
                    <button
                      type="button"
                      className="a11y-focus"
                      style={styles.sectionHeadingButton}
                      onClick={() => toggleSection(groupName)}
                      aria-expanded={!collapsedSections[groupName]}
                      aria-label={`${collapsedSections[groupName] ? "Expand" : "Collapse"} ${groupName}`}
                    >
                      <span aria-hidden="true" style={styles.sectionHeadingIcon}>
                        {collapsedSections[groupName] ? "▶️" : "🔽"}
                      </span>
                      {groupName}
                    </button>
                  </h2>

                  {groupName === "Education" && scenario.teachersPoints && (
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
                        style={{
                          marginBottom: "0.5rem",
                          fontSize: "1rem",
                        }}
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
                      .map((key) => scenario[key] && renderSection(key, scenario[key]))}
                </div>
              ))}
            </div>
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
            <div style={styles.loadingSubtext}>This will take a minute.</div>
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
            <img
              src={selectedECGImage}
              alt="ECG Rhythm"
              style={{ width: "100%", height: "auto", borderRadius: "8px" }}
            />
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
    fontFamily: '"Manrope", "Segoe UI", sans-serif',
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

  cardTitle: {
    marginBottom: "0.5rem",
    fontWeight: "bold",
    fontSize: "1.05rem",
    color: "var(--vn-accent-text)",
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

  sectionHeadingButton: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    background: "transparent",
    border: "none",
    textAlign: "left",
    color: "var(--vn-ink)",
    fontSize: isMobile ? "1rem" : "1.15rem",
    fontWeight: 700,
    cursor: "pointer",
    padding: isMobile ? "0.55rem 0.2rem" : "0.35rem 0.1rem",
    borderRadius: "8px",
    borderBottom: "2px solid var(--vn-accent-text)",
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