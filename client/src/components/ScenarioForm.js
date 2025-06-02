// File: src/components/ScenarioForm.js

import React, { useState, useEffect } from "react";
import axios from "axios";
import jsPDF from "jspdf";
import { FaSpinner, FaMoon, FaSun, FaFilePdf } from "react-icons/fa";

const SCENARIO_TYPES = ["Medical", "Trauma", "Cardiac", "Respiratory", "Environmental", "Other"];
const SEMESTERS = ["2", "3", "4"];
const ENVIRONMENTS = ["Urban", "Rural", "Wilderness", "Industrial", "Home", "Public Space"];
const COMPLEXITIES = ["Simple", "Moderate", "Complex"];
const LEARNING_FOCI = ["Balanced", "Assessment", "Decision Making", "Pathophysiology", "Communication", "Procedures"];

const SECTION_GROUPS = {
  "Scene Info": ["title", "callInformation", "incidentNarrative"],
  "Patient Info": ["patientDemographics", "patientPresentation", "opqrst", "sample"],
  "Assessment": ["physicalExam", "vitalSigns"],
  "Clinical Reasoning": ["caseProgression", "differentialDiagnosis", "expectedTreatment", "protocolNotes", "scenarioRationale", "clinicalReasoning"],
  "Education": ["learningObjectives", "vocationalLearningOutcomes", "selfReflectiveQuestions", "grsAnchors"]
};

const TITLE_MAP = {
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
  selfReflectiveQuestions: "Self-Reflective Questions",
  opqrst: "OPQRST",
  physicalExam: "Physical Assessment",
  vitalSigns: "Vital Signs",
  caseProgression: "Case Progression",
  expectedTreatment: "Expected Treatment",
  protocolNotes: "Protocol Notes",
  vocationalLearningOutcomes: "Vocational Learning Outcomes (VLOs)",
  learningObjectives: "Learning Objectives",
  clinicalReasoning: "Integrated Clinical Reasoning",
  teachersPoints: "Teacher's Points",
  scenarioRationale: "Scenario Rationale & Teaching Tips"
};

const ScenarioForm = () => {
  const [formData, setFormData] = useState({
    semester: "3",
    type: "Medical",
    environment: "Urban",
    complexity: "Moderate",
    focus: "Assessment"
  });

  const [scenario, setScenario] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [darkMode, setDarkMode] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState({});
  const [fontSizeLarge, setFontSizeLarge] = useState(false);

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
    return () => document.head.removeChild(spinnerStyle);
  }, []);

  const handleChange = (e) => {
    const { name, type, checked, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value
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
        .map((item) => typeof item === "object" ? `• ${formatFieldValue(item)}` : `• ${item}`)
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

    const baseURL = process.env.REACT_APP_API_BASE_URL || "http://localhost:10000";

    try {
      const response = await axios.post(`${baseURL}/api/generate-scenario`, formData);
      setScenario(response.data);
    } catch (err) {
      setError("Scenario generation failed. Please check backend server.");
    } finally {
      setLoading(false);
    }
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(12);
    doc.text(`Scenario: ${scenario.title}`, 10, 10);
    let y = 20;

    Object.entries(scenario).forEach(([key, value]) => {
      if (key === "teachersPoints") return;
      const label = capitalizeFirstLetter(key);
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
      doc.setFont(undefined, "bold");
      doc.text("Teacher's Points:", 10, y);
      y += 6;
      doc.setFont(undefined, "normal");

      const lines = doc.splitTextToSize(scenario.teachersPoints, 180);
      doc.text(lines, 10, y);
    }

    doc.save("scenario.pdf");
  };

  const renderContent = (data) => {
    if (Array.isArray(data)) {
      return (
        <ul style={{ paddingLeft: "1rem", marginTop: "0.5rem" }}>
          {data.map((item, index) => (
            <li key={index}>{renderContent(item)}</li>
          ))}
        </ul>
      );
    }
    if (typeof data === "object" && data !== null) {
      return (
        <ul style={{ paddingLeft: "1rem", marginTop: "0.5rem" }}>
          {Object.entries(data).map(([key, value], index) => (
            <li key={index}>
              <strong>{formatLabel(key)}:</strong> {renderContent(value)}
            </li>
          ))}
        </ul>
      );
    }
    return <span>{String(data)}</span>;
  };

  const renderSection = (title, content) => (
    <div style={styles(darkMode, fontSizeLarge).card}>
      <h3 style={styles(darkMode, fontSizeLarge).cardTitle}>{TITLE_MAP[title] || title}</h3>
      {renderContent(content)}
    </div>
  );

  return (
    <div style={styles(darkMode, fontSizeLarge).container}>
      <div style={styles(darkMode, fontSizeLarge).headerBar}>
        <h1 style={styles(darkMode, fontSizeLarge).heading}>Scenario Generator 1.0</h1>
        <div>
          <button onClick={() => setFontSizeLarge((prev) => !prev)} style={styles(darkMode, fontSizeLarge).toggle}>
            {fontSizeLarge ? "🔠 Normal Font" : "🔡 Large Font"}
          </button>
          <button onClick={() => setDarkMode((prev) => !prev)} style={styles(darkMode, fontSizeLarge).toggle}>
            {darkMode ? <FaSun /> : <FaMoon />}
          </button>
          {scenario && (
            <button onClick={exportToPDF} style={styles(darkMode, fontSizeLarge).toggle}>
              <FaFilePdf /> Export
            </button>
          )}
        </div>
      </div>

      <div style={styles(darkMode, fontSizeLarge).formBox}>
        <button onClick={handleSubmit} disabled={loading} style={styles(darkMode, fontSizeLarge).button}>
          {loading ? <FaSpinner className="spin" /> : "Generate Scenario"}
        </button>

        {["semester", "type", "environment", "complexity", "focus"].map((field, index) => (
          <div key={index} style={styles(darkMode, fontSizeLarge).fieldRow}>
            <label>{capitalizeFirstLetter(field)}:</label>
            <select
              name={field}
              value={formData[field]}
              onChange={handleChange}
              style={styles(darkMode, fontSizeLarge).select}
            >
              {(field === "semester" ? SEMESTERS :
                field === "type" ? SCENARIO_TYPES :
                field === "environment" ? ENVIRONMENTS :
                field === "complexity" ? COMPLEXITIES :
                LEARNING_FOCI).map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
        ))}
      </div>

      {error && <p style={styles(darkMode, fontSizeLarge).error}>{error}</p>}
      {loading && <p style={styles(darkMode, fontSizeLarge).loading}><FaSpinner className="spin" /> Generating Scenario...</p>}

      {scenario && (
        <div style={styles(darkMode, fontSizeLarge).outputBox}>
          {Object.entries(SECTION_GROUPS).map(([groupName, keys]) => (
            <div key={groupName}>
              <h2 style={styles(darkMode, fontSizeLarge).sectionHeading} onClick={() => toggleSection(groupName)}>
                {collapsedSections[groupName] ? "▶️" : "🔽"} {groupName}
              </h2>

              {groupName === "Education" && scenario.teachersPoints && (
                <div style={{
                  backgroundColor: darkMode ? "#facc15" : "#fef9c3",
                  color: "#1e293b",
                  padding: "1rem",
                  borderRadius: "12px",
                  border: "1px solid #eab308",
                  marginBottom: "1rem"
                }}>
                  <h3 style={{ marginBottom: "0.5rem", fontSize: fontSizeLarge ? "1.2rem" : "1rem" }}>🧠 Teacher's Points</h3>
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
    </div>
  );
};

const styles = (darkMode, fontSizeLarge) => ({
  container: {
    padding: "2rem",
    backgroundColor: darkMode ? "#1e293b" : "#f1f5f9",
    color: darkMode ? "#f1f5f9" : "#1e293b",
    fontFamily: "Arial, sans-serif",
    fontSize: fontSizeLarge ? "18px" : "14px",
    minHeight: "100vh",
    lineHeight: "1.5"
  },
  headerBar: {
    position: "sticky",
    top: 0,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "1rem",
    backgroundColor: darkMode ? "#334155" : "#e2e8f0",
    padding: "0.5rem 1rem",
    borderRadius: "8px",
    boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
    zIndex: 1000
  },
  heading: {
    fontSize: fontSizeLarge ? "1.6rem" : "1.2rem",
    margin: 0
  },
  toggle: {
    padding: "0.5rem",
    marginLeft: "0.5rem",
    borderRadius: "8px",
    border: "none",
    cursor: "pointer",
    backgroundColor: darkMode ? "#0f172a" : "#cbd5e1",
    color: darkMode ? "#f1f5f9" : "#1e293b",
    fontSize: "1rem"
  },
  formBox: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
    gap: "1rem",
    backgroundColor: darkMode ? "#334155" : "#e2e8f0",
    padding: "1rem",
    borderRadius: "12px",
    marginBottom: "1rem"
  },
  fieldRow: {
    display: "flex",
    flexDirection: "column"
  },
  select: {
    padding: "0.5rem",
    borderRadius: "8px",
    border: "1px solid #64748b",
    backgroundColor: darkMode ? "#1e293b" : "#ffffff",
    color: darkMode ? "#f1f5f9" : "#1e293b"
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
    cursor: "pointer"
  },
  outputBox: {
    maxHeight: "70vh",
    overflowY: "auto",
    marginTop: "1rem",
    backgroundColor: darkMode ? "#475569" : "#ffffff",
    padding: "1rem",
    borderRadius: "12px",
    boxShadow: "0 1px 4px rgba(0,0,0,0.2)"
  },
  card: {
    backgroundColor: darkMode ? "#334155" : "#f8fafc",
    padding: "1rem",
    borderRadius: "8px",
    marginBottom: "0.75rem"
  },
  cardTitle: {
    marginBottom: "0.5rem",
    fontWeight: "bold",
    fontSize: fontSizeLarge ? "1.2rem" : "1rem"
  },
  error: {
    color: "#dc2626",
    fontWeight: "bold",
    marginTop: "0.5rem"
  },
  loading: {
    color: darkMode ? "#f1f5f9" : "#1e293b",
    fontWeight: "bold",
    marginTop: "0.5rem"
  },
  sectionHeading: {
    fontSize: fontSizeLarge ? "1.4rem" : "1.1rem",
    cursor: "pointer",
    marginTop: "1rem",
    paddingBottom: "0.3rem",
    borderBottom: `2px solid ${darkMode ? "#94a3b8" : "#475569"}`
  }
});

export default ScenarioForm;
