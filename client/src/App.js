import React, { useEffect, useRef, useState } from "react";
import "./App.css";
import ScenarioForm from "./components/forms/ScenarioForm";
import AcrReview from "./components/acr/AcrReview";
import { ToastHost, showToast } from "./components/toast/Toast";

// Easter eggs that live in the shell. None of them touch a scenario.
const KONAMI = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];
const isTyping = (el) => el && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable);

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

  // Tap the logo five times quickly: the trace goes flat.
  const logoTaps = useRef([]);
  const [flatline, setFlatline] = useState(false);
  const onLogoTap = () => {
    const now = Date.now();
    logoTaps.current = [...logoTaps.current.filter((t) => now - t < 2500), now];
    if (logoTaps.current.length >= 5 && !flatline) {
      logoTaps.current = [];
      setFlatline(true);
      showToast("Asystole? Check your leads, confirm it in a second lead, then start compressions.");
      setTimeout(() => setFlatline(false), 3200);
    }
  };

  // Konami code: lights and sirens. Typing "coffee" anywhere outside a text box: a coffee run.
  useEffect(() => {
    let seq = [];
    let word = "";
    const onKey = (e) => {
      if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      seq = [...seq, key].slice(-KONAMI.length);
      if (seq.join(",") === KONAMI.join(",")) {
        seq = [];
        document.body.classList.add("vn-sirens");
        setTimeout(() => document.body.classList.remove("vn-sirens"), 3400);
        showToast("Lights and sirens. Your partner is already holding the grab handle.");
      }
      if (key.length === 1) {
        word = (word + key).slice(-6);
        if (word === "coffee") {
          word = "";
          showToast("Coffee run approved. Your partner is buying, because you are driving.");
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
            className={flatline ? "brand-logo brand-logo-flatline" : "brand-logo"}
            onClick={onLogoTap}
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
      <ToastHost />
    </div>
  );
}

export default App;
