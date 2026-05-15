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
  "Other",
];

const SEMESTERS = ["2", "3", "4"];
const ENVIRONMENTS = ["Urban", "Rural", "Wilderness", "Industrial", "Home", "Public Space"];
const COMPLEXITIES = ["Simple", "Moderate", "Complex"];
const GENERATION_DEPTHS = ["Quick Draft", "Standard", "Detailed"];
const UNIQUENESS_LEVELS = ["Common", "Varied", "Rare/Obscure"];

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
    "vocationalLearningOutcomes",
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
  vocationalLearningOutcomes: "Vocational Learning Outcomes (VLOs)",
  learningObjectives: "Learning Objectives",
  teachersPoints: "Teacher's Points",
  scenarioRationale: "Scenario Rationale & Teaching Tips",
};

const ScenarioForm = () => {
  const [formData, setFormData] = useState({
    semester: "3",
    type: "Medical",
    environment: "Urban",
    complexity: "Moderate",
    generationDepth: "Standard",
    uniqueness: "Common",
    includeTeachingCues: true,
    customPrompt: "",
  });

  const [selectedECGImage, setSelectedECGImage] = useState(null);
  const [scenario, setScenario] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [collapsedSections, setCollapsedSections] = useState({});
  const [selectedCue, setSelectedCue] = useState(null);

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
    `;
    document.head.appendChild(spinnerStyle);

    return () => {
      document.head.removeChild(spinnerStyle);
    };
  }, []);

  useEffect(() => {
    const closeCue = () => setSelectedCue(null);
    document.addEventListener("click", closeCue);
    return () => document.removeEventListener("click", closeCue);
  }, []);

  const handleChange = (e) => {
    const { name, type, checked, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const capitalizeFirstLetter = (string) => string.charAt(0).toUpperCase() + string.slice(1);

  const formatFieldValue = (fieldValue) => {
    if (!fieldValue) return "";

    if (typeof fieldValue === "object" && !Array.isArray(fieldValue)) {
      return Object.entries(fieldValue)
        .map(([key, value]) => {
          if (typeof value === "object") {
            return `• ${capitalizeFirstLetter(key)}:\n${formatFieldValue(value)}`;
          }
          return `• ${capitalizeFirstLetter(key)}: ${value}`;
        })
        .join("\n");
    }

    if (Array.isArray(fieldValue)) {
      return fieldValue
        .map((item) => (typeof item === "object" ? `• ${formatFieldValue(item)}` : `• ${item}`))
        .join("\n");
    }

    return `• ${fieldValue}`;
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
      console.log("Received scenario:", generated);
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

    const doc = new jsPDF();
    doc.setFontSize(12);
    doc.text(`Scenario: ${scenario.title || "Untitled"}`, 10, 10);
    let y = 20;

    Object.entries(scenario).forEach(([key, value]) => {
      if (key === "teachersPoints") return;

      const label = TITLE_MAP[key] || capitalizeFirstLetter(key);
      doc.setFont(undefined, "bold");
      doc.text(`${label}:`, 10, y);
      y += 6;
      doc.setFont(undefined, "normal");

      const formattedValue = formatFieldValue(value);
      const lines = doc.splitTextToSize(formattedValue, 180);
      doc.text(lines, 10, y);
      y += lines.length * 6;

      if (y > 270) {
        doc.addPage();
        y = 20;
      }
    });

    if (scenario.teachersPoints) {
      if (y > 250) {
        doc.addPage();
        y = 20;
      }

      doc.setFont(undefined, "bold");
      doc.text("Teacher's Points:", 10, y);
      y += 6;
      doc.setFont(undefined, "normal");

      const lines = doc.splitTextToSize(scenario.teachersPoints, 180);
      doc.text(lines, 10, y);
    }

    doc.save("scenario.pdf");
  };

  const renderSafeContent = (data, parentKey = "root") => {
    if (typeof data === "string") {
      const parts = [];
      const cueRegex = /\*\(💡(?:[a-z]+\|)?\s*(.+?)\s*\)\*/gi;
      let lastIndex = 0;
      let match;
      let localCueIndex = 0;

      while ((match = cueRegex.exec(data)) !== null) {
        const matchStart = match.index;
        const matchEnd = cueRegex.lastIndex;
        const cueText = match[1];
        const id = `cue-${parentKey}-${matchStart}-${localCueIndex++}`;

        if (matchStart > lastIndex) {
          parts.push(<span key={`text-${id}`}>{data.slice(lastIndex, matchStart)}</span>);
        }

        parts.push(
          <span key={`cue-${id}`} style={{ position: "relative", display: "inline-block" }}>
            <FaLightbulb
              style={{
                cursor: "pointer",
                marginLeft: "4px",
                color: selectedCue === id ? "#facc15" : "#eab308",
                verticalAlign: "middle",
              }}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedCue((prev) => (prev === id ? null : id));
              }}
            />
            {selectedCue === id && (
              <div
                style={{
                  position: "absolute",
                  background: "#fef9c3",
                  color: "#1f2937",
                  border: "1px solid #fcd34d",
                  padding: "0.5rem 0.75rem",
                  borderRadius: "8px",
                  zIndex: 10000,
                  top: "1.8rem",
                  left: 0,
                  minWidth: "240px",
                  maxWidth: "420px",
                  whiteSpace: "normal",
                  boxShadow: "0 6px 12px rgba(0,0,0,0.25)",
                }}
                onClick={(e) => e.stopPropagation()}
              >
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
                    <span
                      style={{
                        cursor: "pointer",
                        textDecoration: "underline",
                        color: "#0ea5e9",
                        marginLeft: "6px",
                        marginRight: "6px",
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedECGImage(ecgImageUrl);
                      }}
                    >
                      📈
                    </span>
                  ) : (
                    "📈"
                  )}
                  {interpretation}
                </li>
              );
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
          {scenario && (
            <button onClick={exportToPDF} style={styles.toggle}>
              <FaFilePdf /> Export
            </button>
          )}
        </div>
      </div>

      <div style={styles.formBox}>
        <button onClick={handleSubmit} disabled={loading} style={styles.button}>
          {loading ? <FaSpinner className="spin" /> : "Generate Scenario"}
        </button>

        <div style={styles.howToBox}>
          <h2 style={styles.howToTitle}>How to use</h2>
          <p style={styles.howToLead}>Set scenario parameters:</p>
          <ul style={styles.howToList}>
            <li><strong>Semester:</strong> Sets the learner level and expected clinical reasoning standard.</li>
            <li><strong>Type:</strong> Shapes the main call family, such as medical, trauma, cardiac, respiratory, or environmental.</li>
            <li><strong>Environment:</strong> Changes the scene, operational friction, and patient access considerations.</li>
            <li><strong>Complexity:</strong> Controls how messy, layered, or straightforward the call should feel.</li>
            <li><strong>Generation Depth:</strong> Quick Draft is leaner, Standard balances speed and detail, and Detailed gives the model more room for richer instructor-level output.</li>
          </ul>
        </div>

        {["semester", "type", "environment", "complexity"].map((field) => (
          <div key={field} style={styles.fieldRow}>
            <label>{capitalizeFirstLetter(field)}:</label>
            <select name={field} value={formData[field]} onChange={handleChange} style={styles.select}>
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
          <label>Generation Depth:</label>
          <select
            name="generationDepth"
            value={formData.generationDepth}
            onChange={handleChange}
            style={styles.select}
          >
            {GENERATION_DEPTHS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        <div style={styles.fieldRow}>
          <label>
            <input
              type="checkbox"
              name="includeTeachingCues"
              checked={formData.includeTeachingCues}
              onChange={handleChange}
              style={{ marginRight: "0.5rem" }}
            />
            Include 💡 Teaching Cues
          </label>
        </div>

        <div style={styles.fieldRow}>
          <label>Uniqueness Level:</label>
          <select
            name="uniqueness"
            value={formData.uniqueness}
            onChange={handleChange}
            style={styles.select}
          >
            {UNIQUENESS_LEVELS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
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
            style={styles.textarea}
          />
        </div>

        {error && <p style={styles.error}>{error}</p>}
        {loading && (
          <p style={styles.loading}>
            <FaSpinner className="spin" /> Generating Scenario...
          </p>
        )}
      </div>

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
              <h2 style={styles.sectionHeading} onClick={() => toggleSection(groupName)}>
                {collapsedSections[groupName] ? "▶️" : "🔽"} {groupName}
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
                    🧠 Teacher's Points
                  </h3>
                  <p style={{ fontStyle: "italic" }}>{scenario.teachersPoints}</p>
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

const styles = {
  container: {
    padding: "2rem",
    backgroundColor: "#f1f5f9",
    color: "#1e293b",
    fontFamily: "Arial, sans-serif",
    fontSize: "14px",
    minHeight: "100vh",
    lineHeight: "1.5",
  },
  headerBar: {
    position: "sticky",
    top: 0,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "1rem",
    backgroundColor: "#e2e8f0",
    padding: "0.5rem 1rem",
    borderRadius: "8px",
    boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
    zIndex: 1000,
  },
  heading: {
    fontSize: "1.2rem",
    margin: 0,
  },
  toggle: {
    padding: "0.5rem",
    marginLeft: "0.5rem",
    borderRadius: "8px",
    border: "none",
    cursor: "pointer",
    backgroundColor: "#cbd5e1",
    color: "#1e293b",
    fontSize: "1rem",
  },
  formBox: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
    gap: "1rem",
    backgroundColor: "#e2e8f0",
    padding: "1rem",
    borderRadius: "12px",
    marginBottom: "1rem",
  },
  howToBox: {
    gridColumn: "1 / -1",
    backgroundColor: "#f8fafc",
    border: "1px solid #cbd5e1",
    borderRadius: "10px",
    padding: "0.85rem 1rem",
  },
  howToTitle: {
    margin: "0 0 0.35rem 0",
    fontSize: "1rem",
    color: "#0f766e",
  },
  howToLead: {
    margin: "0 0 0.35rem 0",
    fontWeight: "bold",
  },
  howToList: {
    margin: 0,
    paddingLeft: "1.2rem",
  },
  fieldRow: {
    display: "flex",
    flexDirection: "column",
  },
  select: {
    padding: "0.5rem",
    borderRadius: "8px",
    border: "1px solid #64748b",
    backgroundColor: "#ffffff",
    color: "#1e293b",
  },
  textarea: {
    padding: "0.5rem",
    borderRadius: "8px",
    border: "1px solid #64748b",
    backgroundColor: "#ffffff",
    color: "#1e293b",
  },
  button: {
    gridColumn: "1 / -1",
    padding: "0.75rem",
    fontSize: "1rem",
    fontWeight: "bold",
    borderRadius: "8px",
    border: "none",
    backgroundColor: "#0ea5e9",
    color: "#ffffff",
    cursor: "pointer",
  },
  outputBox: {
    maxHeight: "70vh",
    overflowY: "auto",
    marginTop: "1rem",
    backgroundColor: "#ffffff",
    padding: "1rem",
    borderRadius: "12px",
    boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
  },
  card: {
    backgroundColor: "#f8fafc",
    padding: "1rem",
    borderRadius: "8px",
    marginBottom: "0.75rem",
  },
  cardTitle: {
    marginBottom: "0.5rem",
    fontWeight: "bold",
    fontSize: "1rem",
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
    fontSize: "1.1rem",
    cursor: "pointer",
    marginTop: "1rem",
    paddingBottom: "0.3rem",
    borderBottom: "2px solid #475569",
  },
};

export default ScenarioForm;