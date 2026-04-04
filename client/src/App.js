import React from "react";
import "./App.css";
import ScenarioForm from "./components/ScenarioForm";

function App() {
  return (
    <div className="app-shell">
      <div className="brand-orb brand-orb-left" aria-hidden="true" />
      <div className="brand-orb brand-orb-right" aria-hidden="true" />

      <header className="brand-hero" role="banner">
        <div className="brand-badge">VitalNotes</div>
        <div className="brand-heading-row">
          <img
            src="/vitalnotes-mark.svg"
            alt="VitalNotes logo"
            className="brand-logo"
          />
          <div>
            <h1>VitalNotes Scenario Generator</h1>
            <p>
              Build realistic, protocol-aligned simulation scenarios with
              instructor-grade teaching cues and shift-aware call texture.
            </p>
          </div>
        </div>
      </header>

      <main className="workspace-wrap">
        <ScenarioForm />
      </main>
    </div>
  );
}

export default App;