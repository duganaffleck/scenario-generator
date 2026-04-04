import React from 'react';
import { render, screen } from '@testing-library/react';
import VitalsChart from './charts/VitalsChart';

describe('VitalsChart', () => {
  it('renders HR and RR values from props', () => {
    const firstSet = { hr: '80', rr: '16' };
    const secondSet = { hr: '90', rr: '18' };
    render(<VitalsChart firstSet={firstSet} secondSet={secondSet} />);
    // Check for HR and RR labels
    expect(screen.getByText('HR')).toBeInTheDocument();
    expect(screen.getByText('RR')).toBeInTheDocument();
    // Check for values
    expect(screen.getByText('80')).toBeInTheDocument();
    expect(screen.getByText('90')).toBeInTheDocument();
    expect(screen.getByText('16')).toBeInTheDocument();
    expect(screen.getByText('18')).toBeInTheDocument();
  });
});
