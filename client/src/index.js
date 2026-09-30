import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import LiveMonitor from './components/live/LiveMonitor';
import { MONITOR_HASH } from './components/live/liveChannel';
import reportWebVitals from './reportWebVitals';

const root = ReactDOM.createRoot(document.getElementById('root'));
// The pop-out patient monitor is its own page: no header, no generator, just the monitor.
const isMonitor = window.location.hash === MONITOR_HASH;
if (isMonitor) document.title = 'Patient monitor';
root.render(
  <React.StrictMode>
    {isMonitor ? <LiveMonitor /> : <App />}
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
