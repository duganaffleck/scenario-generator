import React from "react";
import { FaLightbulb } from "react-icons/fa";

const TeachingCue = ({ id, onClick }) => {
  return (
    <span
      onClick={() => onClick(id)}
      style={{ cursor: "pointer", color: "#facc15", marginLeft: "0.25rem" }}
      title="Click to show teaching tip"
    >
      <FaLightbulb style={{ display: "inline", animation: "pulse 1.5s infinite" }} />
    </span>
  );
};

export default TeachingCue;
