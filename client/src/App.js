import React from 'react';
import ScenarioForm from './components/ScenarioForm';

function App() {
  try {
    // Optionally pass mock scenarioData here if needed
    const scenarioData = {}; // Replace with real or test data if needed
    return <ScenarioForm scenario={scenarioData} darkMode={false} fontSizeLarge={false} />;
  } catch (e) {
    console.error("Runtime error in ScenarioForm:", e);
    return <div style={{ color: "red", padding: "2rem" }}>Error: {e.message}</div>;
  }
}

export default App;
