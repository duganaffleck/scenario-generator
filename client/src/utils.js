export const formatLabel = (label) => {
  return label
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (str) => str.toUpperCase())
    .replace(/_/g, " ");
};

export const formatFieldValue = (value) => {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object" && value !== null) {
    return Object.entries(value)
      .map(([key, val]) => `${formatLabel(key)}: ${formatFieldValue(val)}`)
      .join("\n");
  }
  return String(value);
};

export const TITLE_MAP = {
  callInformation: "🚑 Call Information",
  incidentNarrative: "📖 Incident Narrative",
  patientDemographics: "🧍 Patient Demographics",
  patientPresentation: "🩺 Patient Presentation",
  opqrst: "❓ OPQRST",
  sample: "🧪 SAMPLE",
  physicalExam: "🔍 Physical Exam",
  vitalSigns: "📊 Vital Signs",
  differentialDiagnosis: "🧠 Differential Diagnosis",
  expectedTreatment: "💉 Expected Treatment",
  protocolNotes: "📘 Protocol Notes",
  scenarioRationale: "💡 Scenario Rationale"
};

export const styles = (darkMode, fontSizeLarge) => ({
  card: {
    backgroundColor: darkMode ? "#333" : "#fff",
    color: darkMode ? "#fff" : "#000",
    borderRadius: "0.5rem",
    padding: "1rem",
    marginBottom: "1rem",
    boxShadow: "0 2px 6px rgba(0,0,0,0.1)"
  },
  cardTitle: {
    fontSize: fontSizeLarge ? "1.3rem" : "1.1rem",
    marginBottom: "0.75rem"
  },
  sectionHeader: {
    fontSize: fontSizeLarge ? "1.5rem" : "1.2rem",
    borderBottom: "2px solid #ccc",
    paddingBottom: "0.5rem",
    marginBottom: "1rem"
  }
});
