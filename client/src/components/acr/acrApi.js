import axios from "axios";

export const API_BASE = process.env.REACT_APP_API_BASE_URL || "http://localhost:10000";
// The Practice ACR version this site ships. The server reports the version it pre-fills from; if they differ,
// the backend is running an older build (usually Render hasn't redeployed since the last merge).
export const ACR_FORM_VERSION = "3.5";
export const BLANK_ACR_URL = `/acr/ACR_practice_v${ACR_FORM_VERSION}.pdf`;
const ACR = `${API_BASE}/api/acr-review`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Render puts the backend to sleep when it's idle, and the first request after that can fail.
// Retry once after a pause, and tell the caller so the page can say what's happening.
async function withWake(request, onWaking) {
  try {
    return await request();
  } catch (err) {
    const status = err?.response?.status;
    const wakeable = !err?.response || [500, 502, 503, 504].includes(status);
    if (!wakeable || axios.isCancel(err)) throw err;
    if (onWaking) onWaking();
    await sleep(4000);
    return request();
  }
}

export async function errorMessage(err, fallback) {
  let data = err?.response?.data;
  if (data instanceof Blob) {
    try {
      data = JSON.parse(await data.text());
    } catch (e) {
      data = null;
    }
  }
  if (data?.error) return data.error;
  if (!err?.response) return "Couldn't reach the server. Check your connection and try again in a minute.";
  return fallback;
}

export async function getAcrConfig() {
  const res = await withWake(() => axios.get(`${ACR}/config`, { timeout: 60000 }));
  return res.data;
}

export async function reviewAcr(formData, onWaking) {
  const res = await withWake(() => axios.post(ACR, formData, { timeout: 180000 }), onWaking);
  return res.data;
}

// Pre-filled Practice ACR for a generated scenario. Saves it as ACR_<call number>.pdf.
export async function downloadScenarioAcr(scenario, onWaking) {
  const res = await withWake(
    () => axios.post(`${ACR}/acr-for-scenario`, { scenario }, { responseType: "blob", timeout: 60000 }),
    onWaking
  );
  const callNumber = res.headers["x-acr-call-number"] || "practice";
  const formVersion = res.headers["x-acr-form-version"] || "";
  const url = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `ACR_${callNumber}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return { callNumber, formVersion };
}

// Triage report practice: the chart plus a recording or typed report, checked against each other.
export async function checkTriageReport(formData, onWaking) {
  const res = await withWake(() => axios.post(`${ACR}/triage-report`, formData, { timeout: 120000 }), onWaking);
  return res.data;
}
