// utils.js

export const formatLabel = (label) => {
  if (!label) return "";
  return label
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (str) => str.toUpperCase());
};

export const formatFieldValue = (value) => {
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object" && value !== null)
    return Object.entries(value)
      .map(([k, v]) => `${formatLabel(k)}: ${v}`)
      .join(", ");
  return String(value);
};

export const TITLE_MAP = {
  scenarioIntro: "🎬 Scenario Intro",
  teachableBlurb: "🧠 Teachable Blurb",
  learningObjectives: "🎯 Learning Objectives",
  vocationalLearningOutcomes: "🎓 Vocational Learning Outcomes",
  selfReflectiveQuestions: "🪞 Self-Reflective Questions",
  grsAnchors: "📊 GRS Anchors",
  caseProgression: "🔄 Case Progression",
};

export const styles = (darkMode, fontSizeLarge) => ({
  card: {
    backgroundColor: darkMode ? "#222" : "#f9f9f9",
    color: darkMode ? "#fff" : "#000",
    borderRadius: "12px",
    padding: "1rem",
    boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
    marginBottom: "1rem",
  },
  cardTitle: {
    fontSize: fontSizeLarge ? "1.25rem" : "1rem",
    fontWeight: "bold",
    marginBottom: "0.75rem",
  },
  sectionHeader: {
    fontSize: fontSizeLarge ? "1.5rem" : "1.2rem",
    fontWeight: "bold",
    marginBottom: "0.5rem",
  },
});
