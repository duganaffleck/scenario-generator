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

const renderSection = (title, content) => {
  if (title === "grsAnchors" && typeof content === "object") {
    return (
      <div style={styles(darkMode, fontSizeLarge).card}>
        <h3 style={styles(darkMode, fontSizeLarge).cardTitle}>📊 GRS Anchors</h3>
        <GRSAccordion grsAnchors={content} />
      </div>
    );
  }

  if (title === "caseProgression" && typeof content === "object") {
    return (
      <div style={styles(darkMode, fontSizeLarge).card}>
        <h3 style={styles(darkMode, fontSizeLarge).cardTitle}>🔄 Case Progression</h3>
        <div style={{ marginBottom: "0.5rem" }}>
          <strong>🟢 With Correct Treatment:</strong>
          {renderContent(content.withProperCare)}
        </div>
        <div>
          <strong>🔴 With Incorrect or No Treatment:</strong>
          {renderContent(content.withoutProperCare)}
        </div>
      </div>
    );
  }

  const emojiMap = {
    teachableBlurb: "🧠 Teachable Blurb",
    learningObjectives: "🎯 Learning Objectives",
    vocationalLearningOutcomes: "🎓 Vocational Learning Outcomes",
    selfReflectiveQuestions: "🪞 Self-Reflective Questions",
  };

  return (
    <div style={styles(darkMode, fontSizeLarge).card}>
      <h3 style={styles(darkMode, fontSizeLarge).cardTitle}>
        {emojiMap[title] || TITLE_MAP[title] || formatLabel(title)}
      </h3>
      {renderContent(content)}
    </div>
  );
};

const exportToPDF = () => {
  const doc = new jsPDF();
  doc.setFontSize(12);
  doc.text(`Scenario: ${scenario.title}`, 10, 10);
  let y = 20;

  const addTextBlock = (label, text) => {
    doc.setFont(undefined, "bold");
    doc.text(`${label}:`, 10, y);
    y += 6;
    doc.setFont(undefined, "normal");

    const lines = doc.splitTextToSize(text, 180);
    doc.text(lines, 10, y);
    y += lines.length * 6;

    if (y > 270) {
      doc.addPage();
      y = 20;
    }
  };

  Object.entries(scenario).forEach(([key, value]) => {
    if (!value) return;

    if (key === "grsAnchors" && typeof value === "object") {
      doc.setFont(undefined, "bold");
      doc.text("📊 GRS Anchors", 10, y);
      y += 8;

      Object.entries(value).forEach(([domain, scores]) => {
        doc.setFont(undefined, "bold");
        doc.text(`- ${formatLabel(domain)}`, 12, y);
        y += 6;
        Object.entries(scores).forEach(([score, descList]) => {
          descList.forEach((desc) => {
            const lines = doc.splitTextToSize(`${score}: ${desc}`, 175);
            lines.forEach((line) => {
              doc.setFont(undefined, "normal");
              doc.text(`• ${line}`, 14, y);
              y += 6;
              if (y > 270) {
                doc.addPage();
                y = 20;
              }
            });
          });
        });
      });
      y += 6;
    }

    else if (key === "caseProgression" && typeof value === "object") {
      doc.setFont(undefined, "bold");
      doc.text("🔄 Case Progression", 10, y);
      y += 8;

      ["withProperCare", "withoutProperCare"].forEach((pathKey) => {
        const label = pathKey === "withProperCare" ? "🟢 With Correct Treatment" : "🔴 Without or Incorrect Treatment";
        doc.setFont(undefined, "bold");
        doc.text(`${label}:`, 12, y);
        y += 6;

        const lines = doc.splitTextToSize(formatFieldValue(value[pathKey]), 175);
        doc.setFont(undefined, "normal");
        lines.forEach((line) => {
          doc.text(`• ${line}`, 14, y);
          y += 6;
          if (y > 270) {
            doc.addPage();
            y = 20;
          }
        });
        y += 4;
      });
    }

    else {
      addTextBlock(TITLE_MAP[key] || formatLabel(key), formatFieldValue(value));
    }
  });

  doc.save("scenario.pdf");
};

const SECTION_GROUPS = {
  "📍 Scene Info": ["title", "callInformation", "incidentNarrative"],
  " Patient Info": ["patientDemographics", "patientPresentation", "opqrst", "sample"],
  "🎭 Scenario Modifiers": ["modifiersUsed"],
  " Assessment": ["physicalExam", "vitalSigns"],
  "🧠 Clinical Reasoning": [
    "caseProgression",
    "differentialDiagnosis",
    "expectedTreatment",
    "protocolNotes",
    "teachableBlurb",
    "scenarioRationale"
  ],
  "📚 Education": [
    "learningObjectives",
    "vocationalLearningOutcomes",
    "selfReflectiveQuestions",
    "grsAnchors"
  ]
};
