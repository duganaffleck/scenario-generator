import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
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
  sample: "SAMPLE",
  pathophysiology: "Pathophysiology",
  differentialDiagnosis: "Differential Diagnosis",
  clinicalReasoning: "Integrated Clinical Reasoning",
  grsAnchors: "GRS Anchors",
  selfReflectionPrompts: "Self-Reflective Questions",
  opqrst: "OPQRST",
  physicalExam: "Physical Assessment",
  vitalSigns: "Vital Signs",
  caseProgression: "Case Progression",
  expectedTreatment: "Expected Treatment",
  protocolNotes: "Protocol Notes",
  learningObjectives: "Learning Objectives",
  teachersPoints: "Instructor Debrief",
  scenarioRationale: "Scenario Rationale & Teaching Tips",
};

function computeCuePopoverStyle(anchorRect, isMobile) {
  if (!anchorRect || typeof window === "undefined") return null;

  const viewportWidth = window.innerWidth || 0;
  const viewportHeight = window.innerHeight || 0;
  const margin = isMobile ? 8 : 12;
  const preferredWidth = isMobile ? Math.min(340, viewportWidth - margin * 2) : 360;
  const maxAllowedWidth = Math.max(200, viewportWidth - margin * 2);
  const width = Math.min(preferredWidth, maxAllowedWidth);

  const spaceBelow = viewportHeight - anchorRect.bottom;
  const openUpward = !isMobile && spaceBelow < 220;
  const left = Math.max(margin, Math.min(anchorRect.left, viewportWidth - width - margin));
  const top = openUpward
    ? Math.max(margin, anchorRect.top - 12)
    : Math.min(viewportHeight - margin, anchorRect.bottom + 12);

  return {
    position: "fixed",
    left,
    top,
    width,
    maxWidth: `${maxAllowedWidth}px`,
    maxHeight: `${Math.max(160, viewportHeight - margin * 2)}px`,
    overflowY: "auto",
    transform: openUpward ? "translateY(-100%)" : "none",
    zIndex: 25000,
  };
}

const ScenarioForm = () => {
  const [formData, setFormData] = useState({
    semester: "3",
    type: "Medical",
    environment: "Urban",
    complexity: "Moderate",
    includeTeachingCues: false,
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

  useEffect(() => {
    const closeCue = () => setSelectedCue(null);
    window.addEventListener("resize", closeCue);
    window.addEventListener("scroll", closeCue, true);
    return () => {
      window.removeEventListener("resize", closeCue);
      window.removeEventListener("scroll", closeCue, true);
    };
  }, []);

  const handleChange = (e) => {
    const { name, type, checked, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const capitalizeFirstLetter = (string) => string.charAt(0).toUpperCase() + string.slice(1);

  const sanitizePdfText = (value) => {
    const cueRegex = /\*\(💡(?:[a-z]+\|)?\s*(.+?)\s*\)\*/gi;
    return String(value ?? "")
      .replace(cueRegex, "Teaching cue: $1")
      .replace(/[^\t\n\r\x20-\x7E]/g, "")
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
    const marginX = 16;
    const marginY = 16;
    const maxLineWidth = pageWidth - marginX * 2;
    const bodySize = 9.8;
    const bodyLH = 5.4;
    const footerY = pageHeight - 10;
    const palette = {
      ink: [18, 48, 71],
      teal: [13, 139, 139],
      tealSoft: [223, 240, 245],
      paper: [247, 244, 238],
      orange: [242, 140, 40],
      neutralLine: [201, 214, 220],
      neutralText: [54, 78, 90],
      darkText: [20, 29, 35],
      white: [255, 255, 255],
    };
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
        y = marginY + 9;
        return true;
      }
      return false;
    };

    const drawPageHeader = (pageNum) => {
      if (pageNum === 1) return;
      doc.setFillColor(...palette.paper);
      doc.rect(0, 0, pageWidth, 10.5, "F");

      doc.setDrawColor(...palette.neutralLine);
      doc.setLineWidth(0.2);
      doc.line(marginX, 10.5, pageWidth - marginX, 10.5);

      doc.setFont(undefined, "bold");
      doc.setFontSize(8.2);
      doc.setTextColor(...palette.ink);
      doc.text("VitalNotes Scenario Generator", marginX, 6.8);

      doc.setFont(undefined, "normal");
      doc.setFontSize(7.8);
      doc.setTextColor(...palette.neutralText);
      doc.text("Instructor Export", pageWidth - marginX, 6.8, { align: "right" });
    };

    const drawPageFooter = (pageNum, total) => {
      doc.setFont(undefined, "normal");
      doc.setFontSize(8);
      doc.setTextColor(...palette.neutralText);
      doc.setDrawColor(...palette.neutralLine);
      doc.setLineWidth(0.2);
      doc.line(marginX, footerY, pageWidth - marginX, footerY);
      doc.text(documentTitle, marginX, footerY + 4.5);
      doc.text(`Page ${pageNum} of ${total}`, pageWidth - marginX, footerY + 4.5, { align: "right" });
    };

    // Cover page
    doc.setFillColor(...palette.ink);
    doc.rect(0, 0, pageWidth, 42, "F");

    doc.setFillColor(...palette.orange);
    doc.rect(0, 42, pageWidth, 2.2, "F");

    doc.setFont(undefined, "bold");
    doc.setFontSize(11);
    doc.setTextColor(...palette.white);
    doc.text("VitalNotes Scenario Generator", marginX, 12);

    doc.setFont(undefined, "bold");
    doc.setFontSize(20);
    doc.setTextColor(...palette.white);
    const titleWrapped = doc.splitTextToSize(documentTitle, maxLineWidth);
    doc.text(titleWrapped, marginX, 23);

    doc.setFont(undefined, "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(225, 239, 245);
    doc.text("Protocol-aligned scenario export for simulation and debrief.", marginX, 35);

    y = 52;

    doc.setFillColor(...palette.paper);
    doc.roundedRect(marginX, y, pageWidth - marginX * 2, 32, 2.5, 2.5, "F");
    doc.setDrawColor(...palette.neutralLine);
    doc.setLineWidth(0.25);
    doc.roundedRect(marginX, y, pageWidth - marginX * 2, 32, 2.5, 2.5, "S");

    const cardY = y + 6.5;
    const colA = marginX + 6;
    const colB = marginX + 54;
    const colC = marginX + 102;
    const colD = marginX + 148;

    const metaFields = [
      ["Semester", sanitizePdfText(formData.semester)],
      ["Call Type", sanitizePdfText(scenario?.callInformation?.type || formData.type)],
      ["Environment", sanitizePdfText(formData.environment)],
      ["Complexity", sanitizePdfText(formData.complexity)],
    ];

    const positions = [
      [colA, cardY],
      [colB, cardY],
      [colC, cardY],
      [colD, cardY],
    ];

    metaFields.forEach(([label, val], index) => {
      const [xPos, yPos] = positions[index];
      doc.setFont(undefined, "bold");
      doc.setFontSize(8.4);
      doc.setTextColor(...palette.neutralText);
      doc.text(label, xPos, yPos);

      doc.setFont(undefined, "bold");
      doc.setFontSize(10);
      doc.setTextColor(...palette.ink);
      const wrappedVal = doc.splitTextToSize(val || "-", 42);
      doc.text(wrappedVal, xPos, yPos + 5);
    });

    y += 37;

    doc.setFont(undefined, "normal");
    doc.setFontSize(8.2);
    doc.setTextColor(...palette.neutralText);
    doc.text(`Generated: ${exportedAt}`, marginX, y);
    y += 5;

    doc.setDrawColor(...palette.neutralLine);
    doc.setLineWidth(0.22);
    doc.line(marginX, y, pageWidth - marginX, y);
    y += 4;

    // Content sections
    sectionEntries.forEach((entry) => {
      needsNewPage(13.5);

      doc.setFillColor(...palette.tealSoft);
      doc.roundedRect(marginX, y, pageWidth - marginX * 2, 8.3, 1.5, 1.5, "F");
      doc.setDrawColor(...palette.neutralLine);
      doc.setLineWidth(0.2);
      doc.roundedRect(marginX, y, pageWidth - marginX * 2, 8.3, 1.5, 1.5, "S");

      doc.setFont(undefined, "bold");
      doc.setFontSize(10.2);
      doc.setTextColor(...palette.ink);
      doc.text(entry.label, marginX + 2.6, y + 5.5);
      y += 11.3;

      const rawLines = String(entry.formattedValue).split("\n");
      rawLines.forEach((rawLine) => {
        const expanded = rawLine.replace(/\t/g, "  ");
        const trimmed = expanded.trim();
        if (!trimmed) {
          y += 2.1;
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
        doc.setTextColor(...palette.darkText);

        const wrapped = doc.splitTextToSize(sanitizePdfText(displayText), textWidth);
        wrapped.forEach((line) => {
          needsNewPage(bodyLH);
          doc.text(line, textX, y);
          y += bodyLH;
        });
      });

      y += 1.2;
    });

    // Footer and header on every page
    const totalPages = doc.getNumberOfPages();
    for (let p = 1; p <= totalPages; p += 1) {
      doc.setPage(p);
      drawPageHeader(p);
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
        const isCueOpen = selectedCue?.id === id;

        if (matchStart > lastIndex) {
          parts.push(<span key={`text-${id}`}>{data.slice(lastIndex, matchStart)}</span>);
        }

        parts.push(
          <span key={`cue-${id}`} style={{ position: "relative", display: "inline-block" }}>
            <button
              type="button"
              className="a11y-focus"
              aria-label={isCueOpen ? "Hide teaching cue" : "Show teaching cue"}
              aria-pressed={isCueOpen}
              title={isCueOpen ? "Hide teaching cue" : "Show teaching cue"}
              data-cue-toggle="true"
              style={{
                cursor: "pointer",
                marginLeft: "4px",
                color: isCueOpen ? "#facc15" : "#eab308",
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
                const rect = e.currentTarget.getBoundingClientRect();
                setSelectedCue((prev) =>
                  prev?.id === id
                    ? null
                    : {
                        id,
                        cueTag,
                        cueText,
                        cueIndex,
                        anchorRect: rect,
                      }
                );
              }}
            >
              <FaLightbulb aria-hidden="true" />
            </button>
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
        <div style={styles.headerInner}>
          <h1 style={styles.heading}>VitalNotes Workspace</h1>
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

            {/* Teaching Cues disabled for redesign - revisit later */}
            {/* 
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
            */}

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
                        Instructor Debrief
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
            <div style={styles.loadingSubtext}>This will take a minute (or several).</div>
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

      {selectedCue &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            data-cue-popover="true"
            style={{
              ...computeCuePopoverStyle(selectedCue.anchorRect, isMobile),
              background: "#fef9c3",
              color: "#1f2937",
              border: "1px solid #fcd34d",
              padding: "0.6rem 0.8rem",
              borderRadius: "10px",
              whiteSpace: "normal",
              boxShadow: "0 10px 24px rgba(0,0,0,0.28)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {selectedCue.cueText}
          </div>,
          document.body
        )}
    </div>
  );
};

const buildStyles = (isMobile) => {
  const headerPanelGap = "0.22rem";

  return ({
  container: {
    padding: `${headerPanelGap} 0 1rem`,
    backgroundColor: "transparent",
    color: "#123047",
    fontFamily: "var(--vn-font-body, Manrope, Segoe UI, sans-serif)",
    fontSize: "14px",
    minHeight: "100vh",
    height: "auto",
    overflow: "visible",
    overflowAnchor: "none",
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
    color: "#0d8b8b",
  },

  loadingTitle: {
    fontSize: "1.05rem",
    fontWeight: "bold",
    color: "#123047",
  },

  loadingSubtext: {
    fontSize: "0.9rem",
    color: "#426272",
  },
  headerBar: {
    position: "sticky",
    top: 0,
    left: "auto",
    right: "auto",
    marginBottom: headerPanelGap,
    background: "linear-gradient(140deg, rgba(18, 48, 71, 0.92), rgba(13, 139, 139, 0.92))",
    padding: isMobile ? "0.65rem 0.8rem" : "0.7rem 0.7rem",
    borderRadius: "12px",
    boxShadow: "0 8px 20px rgba(18,48,71,0.24)",
    zIndex: 1000,
    boxSizing: "border-box",
    border: "1px solid rgba(211, 234, 238, 0.5)",
  },

  headerInner: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    margin: "0 auto",
    padding: isMobile ? 0 : "0 0 0 0.55rem",
    borderLeft: "5px solid #f28c28",
    boxSizing: "border-box",
  },

  heading: {
    fontSize: isMobile ? "1.1rem" : "1.4rem",
    fontWeight: "bold",
    fontFamily: "var(--vn-font-heading, Spectral, Georgia, serif)",
    color: "#f6fbfc",
    margin: 0,
  },

  toggle: {
    padding: "0.5rem 0.75rem",
    marginLeft: "0.5rem",
    borderRadius: "8px",
    border: "none",
    cursor: "pointer",
    backgroundColor: "#f28c28",
    color: "#112d43",
    fontSize: "0.9rem",
    fontWeight: 700,
  },

  mainLayout: {
    display: "grid",
    gridTemplateColumns: isMobile ? "1fr" : "320px minmax(0, 1fr)",
    gap: isMobile ? "0.55rem" : "0.7rem",
    alignItems: "start",
    height: "auto",
    overflow: "visible",
    paddingTop: 0,
  },

  leftPanel: {
    position: isMobile ? "static" : "sticky",
    top: isMobile ? "auto" : "4.15rem",
    left: "auto",
    width: isMobile ? "auto" : "320px",
    zIndex: isMobile ? "auto" : 500,
    height: "fit-content",
  },

  rightPanel: {
    minWidth: 0,
    marginLeft: 0,
  },

  formBox: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: "0.85rem",
    backgroundColor: "rgba(255,255,255,0.82)",
    padding: "1.25rem",
    borderRadius: "14px",
    marginBottom: isMobile ? "0.35rem" : "0.5rem",
    boxShadow: "0 10px 24px rgba(18,48,71,0.12)",
    border: "1px solid #c7d9df",
    backdropFilter: "blur(5px)",
  },

  fieldRow: {
    display: "flex",
    flexDirection: "column",
    gap: "0.35rem",
  },

  select: {
    padding: "0.45rem",
    borderRadius: "8px",
    border: "1px solid #97b6c2",
    backgroundColor: "#ffffff",
    color: "#1e293b",
  },

  textarea: {
    padding: "0.5rem",
    borderRadius: "8px",
    border: "1px solid #97b6c2",
    backgroundColor: "#ffffff",
    color: "#1e293b",
    resize: "vertical",
  },

  helperText: {
    color: "#475569",
    fontSize: "0.8rem",
    marginTop: "0.2rem",
    lineHeight: "1.45",
  },

  button: {
    padding: "0.85rem",
    fontSize: "1rem",
    fontWeight: "bold",
    borderRadius: "10px",
    border: "none",
    backgroundColor: "#0d8b8b",
    color: "#ffffff",
    cursor: "pointer",
    boxShadow: "0 8px 18px rgba(13,139,139,0.28)",
  },

  outputBox: {
    maxHeight: "none",
    overflowY: "visible",
    backgroundColor: "rgba(255,255,255,0.93)",
    padding: isMobile ? "1rem" : "1.5rem",
    borderRadius: "14px",
    boxShadow: "0 14px 30px rgba(18,48,71,0.12)",
    border: "1px solid #c7d9df",
  },

  card: {
    backgroundColor: "#fbfdfd",
    padding: "1rem",
    borderRadius: "10px",
    marginBottom: "1rem",
    border: "1px solid #d6e3e8",
  },

  cardTitle: {
    marginBottom: "0.5rem",
    fontWeight: "bold",
    fontSize: "1.05rem",
    color: "#0a6e72",
  },

  error: {
    color: "#c64545",
    fontWeight: "bold",
    marginTop: "0.5rem",
  },

  loading: {
    color: "#123047",
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
    color: "#123047",
    fontSize: isMobile ? "1rem" : "1.15rem",
    fontWeight: 700,
    cursor: "pointer",
    padding: isMobile ? "0.55rem 0.2rem" : "0.35rem 0.1rem",
    borderRadius: "8px",
    borderBottom: "2px solid #0d8b8b",
  },

  sectionHeadingIcon: {
    display: "inline-flex",
    minWidth: "1.1rem",
    justifyContent: "center",
  },
  });
};

export default ScenarioForm;