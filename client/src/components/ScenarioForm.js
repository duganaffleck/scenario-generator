import React, { useState, useEffect } from "react";
import axios from "axios";
import jsPDF from "jspdf";
import { FaSpinner, FaFilePdf, FaLightbulb } from "react-icons/fa";

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
  const [formData, setFormData] = useState({
    semester: "3",
    type: "Medical",
    environment: "Urban",
    complexity: "Moderate",
    includeTeachingCues: true,
    customPrompt: "",
  });

  const [selectedECGImage, setSelectedECGImage] = useState(null);
  const [scenario, setScenario] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [collapsedSections, setCollapsedSections] = useState({});
  const [selectedCue, setSelectedCue] = useState(null);
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 900px)").matches : false
  );

  const styles = buildStyles(isMobile);

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
    if (isMobile) {
      document.body.style.overflow = "auto";
      document.documentElement.style.overflow = "auto";
    } else {
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
    }

    return () => {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
    };
  }, [isMobile]);


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

  const capitalizeFirstLetter = (string) =>
    String(string || "")
      .replace(/[_-]+/g, " ")
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/^./, (ch) => ch.toUpperCase());

  const sanitizePdfText = (value) => {
    const cueRegex = /\*\(💡(?:[a-z]+\|)?\s*(.+?)\s*\)\*/gi;
    return String(value ?? "")
      .replace(cueRegex, "Teaching cue: $1")
      .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "")
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

  const formatLabel = (label) =>
    label.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (str) => str.toUpperCase());

  const toggleSection = (section) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError("");
    setScenario(null);
    setSelectedCue(null);
    setSelectedECGImage(null);

    const baseURL = process.env.REACT_APP_API_BASE_URL || "http://localhost:10000";

    try {
      const response = await axios.post(`${baseURL}/api/generate-scenario`, formData);
      const generated = response.data;

      if (generated.ecgInterpretation && generated.vitalSigns && !generated.vitalSigns.ecgInterpretation) {
        generated.vitalSigns.ecgInterpretation = generated.ecgInterpretation;
      }

      setScenario(generated);
    } catch (err) {
      const message =
        err?.response?.data?.details ||
        err?.response?.data?.error ||
        err?.message ||
        "Scenario generation failed. Please check backend server.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const exportToPDF = () => {
    if (!scenario) return;

    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const pageHeight = doc.internal.pageSize.getHeight();
    const pageWidth = doc.internal.pageSize.getWidth();
    const marginX = 20;
    const marginY = 20;
    const maxLineWidth = pageWidth - marginX * 2;
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
        return true;
      }
      return false;
    };

    const printLine = (text, size, bold, color) => {
      doc.setFont(undefined, bold ? "bold" : "normal");
      doc.setFontSize(size);
      doc.setTextColor(...color);
      const wrapped = doc.splitTextToSize(sanitizePdfText(text), maxLineWidth);
      wrapped.forEach((line) => {
        needsNewPage(bodyLH);
        doc.text(line, marginX, y);
        y += bodyLH;
      });
    };

    const drawPageFooter = (pageNum, total) => {
      doc.setFont(undefined, "normal");
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.setDrawColor(180, 180, 180);
      doc.setLineWidth(0.2);
      doc.line(marginX, footerY, pageWidth - marginX, footerY);
      doc.text(documentTitle, marginX, footerY + 4.5);
      doc.text(`Page ${pageNum} of ${total}`, pageWidth - marginX, footerY + 4.5, { align: "right" });
    };

    // ── Cover page ──────────────────────────────────────────────────────────
    doc.setFont(undefined, "bold");
    doc.setFontSize(22);
    doc.setTextColor(20, 20, 20);
    const titleWrapped = doc.splitTextToSize(documentTitle, maxLineWidth);
    doc.text(titleWrapped, marginX, y);
    y += titleWrapped.length * 9 + 4;

    doc.setDrawColor(60, 60, 60);
    doc.setLineWidth(0.4);
    doc.line(marginX, y, pageWidth - marginX, y);
    y += 7;

    const metaFields = [
      ["Semester", sanitizePdfText(formData.semester)],
      ["Call Type", sanitizePdfText(scenario?.callInformation?.type || formData.type)],
      ["Environment", sanitizePdfText(formData.environment)],
      ["Complexity", sanitizePdfText(formData.complexity)],
    ];
    metaFields.forEach(([label, val]) => {
      if (!val) return;
      doc.setFont(undefined, "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(80, 80, 80);
      doc.text(`${label}:`, marginX, y);
      doc.setFont(undefined, "normal");
      doc.setTextColor(20, 20, 20);
      doc.text(val, marginX + 30, y);
      y += 5.8;
    });

    y += 4;
    doc.setDrawColor(60, 60, 60);
    doc.setLineWidth(0.2);
    doc.line(marginX, y, pageWidth - marginX, y);
    y += 6;

    doc.setFont(undefined, "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(130, 130, 130);
    doc.text(`Generated: ${exportedAt}`, marginX, y);
    y += 10;

    // ── Sections ─────────────────────────────────────────────────────────────
    sectionEntries.forEach((entry) => {
      // Section heading
      needsNewPage(12);
      y += 4;
      doc.setFont(undefined, "bold");
      doc.setFontSize(12);
      doc.setTextColor(20, 20, 20);
      doc.text(entry.label, marginX, y);
      y += 2.5;
      doc.setDrawColor(60, 60, 60);
      doc.setLineWidth(0.25);
      doc.line(marginX, y, pageWidth - marginX, y);
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
        const displayText = isBullet ? `\u2022  ${trimmed.slice(2)}` : trimmed;
        const indent = isBullet ? 4 : 0;
        const textX = marginX + indent;
        const textWidth = maxLineWidth - indent;

        const isLabelLine = /^[A-Z][^:]{1,35}:\s*$/.test(trimmed);
        doc.setFont(undefined, isLabelLine ? "bold" : "normal");
        doc.setFontSize(bodySize);
        doc.setTextColor(30, 30, 30);

        const wrapped = doc.splitTextToSize(sanitizePdfText(displayText), textWidth);
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
                  background: "#fef9c3",
                  color: "#1f2937",
                  border: "1px solid #fcd34d",
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
                  boxShadow: "0 6px 12px rgba(0,0,0,0.25)",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div
                  style={{
                    fontSize: "0.72rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    color: "#92400e",
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
          backgroundColor: "#e0f2fe",
          borderLeft: "5px solid #0284c7",
          padding: "1rem",
          borderRadius: "8px",
          marginBottom: "1rem",
        }
      : isProtocolNote
        ? {
            backgroundColor: "#dcfce7",
            borderLeft: "5px solid #16a34a",
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
      <div style={styles.headerBar}>
        <h1 style={styles.heading}>Scenario Generator 1.0</h1>
        <div>
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
                <label>{capitalizeFirstLetter(field)}:</label>
                <select
                  name={field}
                  value={formData[field]}
                  onChange={handleChange}
                  style={styles.select}
                  className="a11y-focus"
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
          {scenario && (
            <div style={styles.outputBox}>
              {scenario.customPrompt && (
                <div
                  style={{
                    backgroundColor: "#fef9c3",
                    borderLeft: "6px solid #facc15",
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
                        backgroundColor: "#fef9c3",
                        color: "#1e293b",
                        padding: "1rem",
                        borderRadius: "12px",
                        border: "1px solid #eab308",
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
            <div style={styles.loadingTitle}>Generating Scenario...</div>
            <div style={styles.loadingSubtext}>This will take a minute.</div>
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
              background: "#fff",
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
              style={{
                marginTop: "0.75rem",
                padding: "0.5rem 1rem",
                backgroundColor: "#0ea5e9",
                color: "#fff",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
              }}
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
    padding: isMobile ? "0.6rem" : "1rem 2rem 2rem",
    backgroundColor: "#f8fafc",
    color: "#1e293b",
    fontFamily: "Arial, sans-serif",
    fontSize: "14px",
    minHeight: "100vh",
    height: isMobile ? "auto" : "100vh",
    overflow: isMobile ? "auto" : "hidden",
    boxSizing: "border-box",
    lineHeight: "1.5",
  },
  loadingOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    width: "100vw",
    height: "100vh",
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 30000,
    overflow: "hidden",
  },

  loadingBox: {
    backgroundColor: "#ffffff",
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
    color: "#0d9488",
  },

  loadingTitle: {
    fontSize: "1.05rem",
    fontWeight: "bold",
    color: "#1e293b",
  },

  loadingSubtext: {
    fontSize: "0.9rem",
    color: "#475569",
  },
  headerBar: {
    position: isMobile ? "static" : "sticky",
    top: 0,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: isMobile ? "0.85rem" : "0.35rem",
    backgroundColor: "#e2e8f0",
    padding: isMobile ? "0.65rem 0.8rem" : "0.75rem 1.25rem",
    borderRadius: "10px",
    boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
    zIndex: 1000,
    borderLeft: "6px solid #0d9488",
  },

  heading: {
    fontSize: isMobile ? "1.1rem" : "1.4rem",
    fontWeight: "bold",
    margin: 0,
  },

  toggle: {
    padding: "0.5rem 0.75rem",
    marginLeft: "0.5rem",
    borderRadius: "8px",
    border: "none",
    cursor: "pointer",
    backgroundColor: "#cbd5e1",
    color: "#1e293b",
    fontSize: "0.9rem",
  },

  mainLayout: {
    display: "grid",
    gridTemplateColumns: isMobile ? "1fr" : "320px 1fr",
    gap: isMobile ? "0.75rem" : "0.5rem",
    alignItems: "start",
    height: isMobile ? "auto" : "calc(100vh - 110px)",
    overflow: isMobile ? "visible" : "hidden",
  },

  leftPanel: {
    position: isMobile ? "static" : "sticky",
    top: isMobile ? "auto" : "80px",
    height: "fit-content",
  },

  rightPanel: {
    minWidth: 0,
  },

  formBox: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: "0.85rem",
    backgroundColor: "#e2e8f0",
    padding: "1.25rem",
    borderRadius: "14px",
    marginBottom: isMobile ? "0.5rem" : "1rem",
    boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
  },

  fieldRow: {
    display: "flex",
    flexDirection: "column",
    gap: "0.35rem",
  },

  select: {
    padding: "0.45rem",
    borderRadius: "8px",
    border: "1px solid #94a3b8",
    backgroundColor: "#ffffff",
    color: "#1e293b",
  },

  textarea: {
    padding: "0.5rem",
    borderRadius: "8px",
    border: "1px solid #94a3b8",
    backgroundColor: "#ffffff",
    color: "#1e293b",
    resize: "vertical",
  },

  helperText: {
    color: "#475569",
    fontSize: "0.8rem",
    marginTop: "0.2rem",
  },

  button: {
    padding: "0.85rem",
    fontSize: "1rem",
    fontWeight: "bold",
    borderRadius: "10px",
    border: "none",
    backgroundColor: "#0d9488",
    color: "#ffffff",
    cursor: "pointer",
    boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
  },

  outputBox: {
    maxHeight: isMobile ? "none" : "calc(100vh - 140px)",
    overflowY: isMobile ? "visible" : "auto",
    backgroundColor: "#ffffff",
    padding: isMobile ? "1rem" : "1.5rem",
    borderRadius: "14px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
  },

  card: {
    backgroundColor: "#f9fafb",
    padding: "1rem",
    borderRadius: "10px",
    marginBottom: "1rem",
    border: "1px solid #e5e7eb",
  },

  cardTitle: {
    marginBottom: "0.5rem",
    fontWeight: "bold",
    fontSize: "1.05rem",
    color: "#0d9488",
  },

  error: {
    color: "#dc2626",
    fontWeight: "bold",
    marginTop: "0.5rem",
  },

  loading: {
    color: "#1e293b",
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
    color: "#1e293b",
    fontSize: isMobile ? "1rem" : "1.15rem",
    fontWeight: 700,
    cursor: "pointer",
    padding: isMobile ? "0.55rem 0.2rem" : "0.35rem 0.1rem",
    borderRadius: "8px",
    borderBottom: "2px solid #0d9488",
  },

  sectionHeadingIcon: {
    display: "inline-flex",
    minWidth: "1.1rem",
    justifyContent: "center",
  },
});

export default ScenarioForm;