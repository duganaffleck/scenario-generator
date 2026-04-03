import { render, screen } from '@testing-library/react';
import App from './App';

test('renders scenario generator heading', () => {
  render(<App />);
  const heading = screen.getByText(/scenario generator 1.0/i);
  expect(heading).toBeInTheDocument();
});
