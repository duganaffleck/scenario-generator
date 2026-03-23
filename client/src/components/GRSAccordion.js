import React from "react";

export function GRSAccordion({ grsAnchors }) {
  return (
    <div>
      {Object.entries(grsAnchors).map(([domain, scores]) => (
        <div key={domain}>
          <h4>{domain}</h4>
          {Object.entries(scores).map(([score, descriptions]) => (
            <div key={score}>
              <strong>{score}</strong>
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
