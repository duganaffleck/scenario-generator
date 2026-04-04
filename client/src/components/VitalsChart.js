// File: src/components/VitalsChart.js

import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const VitalsChart = ({ firstSet, secondSet }) => {
  const pick = (set, keys = []) => {
    for (const key of keys) {
      const value = set?.[key];
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        return String(value);
      }
    }
    return '';
  };

  const extractLeadingNumber = (value) => {
    const match = String(value || '').match(/-?\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : NaN;
  };

  const parseVitals = () => {
    const firstHR = pick(firstSet, ['hr', 'HR', 'heartRate']);
    const secondHR = pick(secondSet, ['hr', 'HR', 'heartRate']);
    const firstRR = pick(firstSet, ['rr', 'RR', 'respiratoryRate']);
    const secondRR = pick(secondSet, ['rr', 'RR', 'respiratoryRate']);

    return [
      {
        name: "HR",
        First: extractLeadingNumber(firstHR),
        Second: extractLeadingNumber(secondHR),
        FirstDisplay: firstHR,
        SecondDisplay: secondHR,
      },
      {
        name: "RR",
        First: extractLeadingNumber(firstRR),
        Second: extractLeadingNumber(secondRR),
        FirstDisplay: firstRR,
        SecondDisplay: secondRR,
      },
      {
        name: "BP (Systolic)",
        First: Number(pick(firstSet, ['bp', 'BP', 'bloodPressure']).split('/')[0]),
        Second: Number(pick(secondSet, ['bp', 'BP', 'bloodPressure']).split('/')[0]),
      },
      {
        name: "SpO₂",
        First: Number(pick(firstSet, ['spo2', 'SpO2', 'spO2']).replace('%', '')),
        Second: Number(pick(secondSet, ['spo2', 'SpO2', 'spO2']).replace('%', '')),
      },
      {
        name: "BGL",
        First: Number(pick(firstSet, ['bgl', 'BGL', 'bloodGlucose'])),
        Second: Number(pick(secondSet, ['bgl', 'BGL', 'bloodGlucose'])),
      },
    ];
  };

  const data = parseVitals();

  const tooltipFormatter = (value, name, payload) => {
    if (!payload || (payload.name !== 'HR' && payload.name !== 'RR')) {
      return [value, name];
    }

    const displayKey = name === 'First' ? 'FirstDisplay' : 'SecondDisplay';
    return [payload[displayKey] || value, name];
  };

  return (
    <div style={{ width: "100%", height: 300 }}>
      <h4>📈 Vital Signs Trend</h4>
      <ResponsiveContainer>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip formatter={tooltipFormatter} />
          <Legend />
          <Line type="monotone" dataKey="First" stroke="#8884d8" strokeWidth={2} />
          <Line type="monotone" dataKey="Second" stroke="#82ca9d" strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default VitalsChart;
