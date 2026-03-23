import React from "react";

const CuePopup = ({ content, onClose }) => {
  return (
    <div
      style={{
        position: "absolute",
        backgroundColor: "#fef9c3",
        border: "1px solid #eab308",
        color: "#1e293b",
        padding: "0.75rem",
        borderRadius: "8px",
        zIndex: 9999,
        maxWidth: "300px",
        boxShadow: "0 4px 8px rgba(0,0,0,0.2)"
      }}
    >
      <div style={{ fontWeight: "bold", marginBottom: "0.5rem" }}>💡 Teaching Cue</div>
      <div style={{ fontSize: "0.9rem" }}>{content}</div>
      <div style={{ textAlign: "right", marginTop: "0.5rem" }}>
        <button
          onClick={onClose}
          style={{
            backgroundColor: "#eab308",
            color: "#1e293b",
            border: "none",
            padding: "0.3rem 0.6rem",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
};

export default CuePopup;
