// File: src/components/GRSAccordion.js
import React from "react";

const GRSAccordion = ({ grsAnchors }) => {
  if (!grsAnchors || typeof grsAnchors !== "object") return null;

  return (
    <div className="space-y-4">
      {Object.entries(grsAnchors).map(([domain, scores]) => (
        <details key={domain} className="border rounded-xl p-3 bg-white dark:bg-gray-900 shadow-sm">
          <summary className="font-semibold text-lg cursor-pointer">
            {domain}
          </summary>
          <div className="pl-4 pt-2">
            {Object.entries(scores).map(([score, examples]) => (
              <div key={score} className="mb-2">
                <span className="font-bold">Score {score}:</span>
                <ul className="list-disc list-inside ml-4 text-sm">
                  {examples.map((ex, idx) => (
                    <li key={idx}>{ex}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </details>
      ))}
    </div>
  );
};

export default GRSAccordion;
