// GRSAccordion.js
import React from "react";

export function GRSAccordion({ grsAnchors }) {
  return (
    <div>
      {Object.entries(grsAnchors).map(([domain, scores]) => (
        <div key={domain} style={{ marginBottom: "1rem" }}>
          <h4>{domain}</h4>
          {Object.entries(scores).map(([score, descriptions]) => (
            <div key={score} style={{ marginLeft: "1rem" }}>
              <strong>Score {score}</strong>
              <ul>
                {descriptions.map((desc, i) => (
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
