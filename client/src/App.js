import React, { useEffect, useState } from "react";
import "./App.css";
import ScenarioForm from "./components/forms/ScenarioForm";
import AcrReview from "./components/acr/AcrReview";

// Two views on one page. Students can be sent straight to ACR Review with /#acr-review.
// Both stay mounted, so switching back and forth keeps a generated scenario and a review on screen.
const viewFromHash = () => (window.location.hash === "#acr-review" ? "acr" : "generator");

function App() {
  const [view, setView] = useState(viewFromHash);

  useEffect(() => {
    const onHashChange = () => setView(viewFromHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const isAcr = view === "acr";

  return (
    <div className="app-shell">
      <div className="brand-orb brand-orb-left" aria-hidden="true" />
      <div className="brand-orb brand-orb-right" aria-hidden="true" />

      <header className="brand-hero" role="banner">
        <div className="brand-hero-topline">
          <div className="brand-badge">VitalNotes</div>
          <nav className="brand-nav" aria-label="Tools">
            <a className="brand-vitalnotes-link" href="#scenarios" aria-current={isAcr ? undefined : "page"}>
              Scenario Generator
            </a>
            <a className="brand-vitalnotes-link" href="#acr-review" aria-current={isAcr ? "page" : undefined}>
              ACR Review
            </a>
            <a
              className="brand-vitalnotes-link"
              href="https://vitalnotes-app.vercel.app"
              target="_blank"
              rel="noopener noreferrer"
            >
              Open VitalNotes
            </a>
          </nav>
        </div>
        <div className="brand-heading-row">
          <img
            src="/vitalnotes-mark.svg"
            alt="VitalNotes logo"
            className="brand-logo"
          />
          <div>
            <h1>{isAcr ? "VitalNotes ACR Review" : "VitalNotes Scenario Generator"}</h1>
            <p>
              {isAcr
                ? "Upload a practice ACR from a lab scenario. Get feedback on what to fix first."
                : "Ontario PCP scenarios. Generate a call, run it, chart it, get feedback on the chart."}
            </p>
          </div>
        </div>
      </header>

      <main className="workspace-wrap">
        <div hidden={isAcr}>
          <ScenarioForm />
        </div>
        <div hidden={!isAcr}>
          <AcrReview />
        </div>
      </main>
    </div>
  );
}

export default App;
