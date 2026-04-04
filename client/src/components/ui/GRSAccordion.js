import React from "react";

export function GRSAccordion({ grsAnchors }) {
  const scoreOrder = ["3", "5", "7"];
  const scoreLabels = {
    3: "Unsafe/Borderline Pattern",
    5: "Competent Standard",
    7: "Exceptional Performance"
  };

  return (
    <div>
      {Object.entries(grsAnchors).map(([domain, scores]) => (
        <div key={domain}>
          <h4>{domain}</h4>
          {scoreOrder.map((score) => (
            <div key={score}>
              <strong>{score} - {scoreLabels[score]}</strong>
              <ul>
                {(scores?.[score] || []).map((desc, i) => (
                  <li key={i}>{desc}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
