// Live run: the instructor's controls and the student-facing monitor talk to each other inside the browser.
// Two windows or tabs of the same site on the same device (a laptop and a TV, or an iPad in Split View).
// BroadcastChannel where the browser has it, localStorage events where it doesn't. No server involved.

const CHANNEL = "vn-live-run";
const STATE_KEY = "vn.liveRunState";

export function openLiveChannel(onMessage) {
  let bc = null;
  try {
    if (typeof BroadcastChannel !== "undefined") bc = new BroadcastChannel(CHANNEL);
  } catch (e) {
    bc = null;
  }
  const onStorage = (e) => {
    if (e.key !== CHANNEL || !e.newValue) return;
    try {
      onMessage(JSON.parse(e.newValue).msg);
    } catch (err) {
      /* ignore a half-written value */
    }
  };
  if (bc) bc.onmessage = (e) => onMessage(e.data);
  else window.addEventListener("storage", onStorage);

  return {
    post(msg) {
      if (bc) {
        bc.postMessage(msg);
        return;
      }
      try {
        localStorage.setItem(CHANNEL, JSON.stringify({ msg, t: Date.now() }));
      } catch (e) {
        /* storage blocked: the split view in the same window still works */
      }
    },
    close() {
      if (bc) bc.close();
      else window.removeEventListener("storage", onStorage);
    },
  };
}

// The last monitor state, so a monitor window opened mid-run shows the current numbers straight away.
export function saveLiveState(state) {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  } catch (e) {
    /* not essential */
  }
}

export function readLiveState() {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export const MONITOR_HASH = "#live-monitor";
