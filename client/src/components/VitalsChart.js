// File: src/components/VitalsChart.js

import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const VitalsChart = ({ firstSet, secondSet }) => {
  const parseVitals = () => {
    return [
      {
        name: "HR",
        First: Number(firstSet?.HR),
        Second: Number(secondSet?.HR),
      },
      {
        name: "RR",
        First: Number(firstSet?.RR),
        Second: Number(secondSet?.RR),
      },
      {
        name: "BP (Systolic)",
        First: Number(firstSet?.BP?.split('/')[0]),
        Second: Number(secondSet?.BP?.split('/')[0]),
      },
      {
        name: "SpO₂",
        First: Number(firstSet?.SpO2?.replace('%', '')),
        Second: Number(secondSet?.SpO2?.replace('%', '')),
      },
      {
        name: "BGL",
        First: Number(firstSet?.BGL),
        Second: Number(secondSet?.BGL),
      },
    ];
  };

  const data = parseVitals();

  return (
    <div style={{ width: "100%", height: 300 }}>
      <h4>📈 Vital Signs Trend</h4>
      <ResponsiveContainer>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="First" stroke="#8884d8" strokeWidth={2} />
          <Line type="monotone" dataKey="Second" stroke="#82ca9d" strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default VitalsChart;
