import React, { useEffect, useRef, useState } from "react";

// One small toast for confirmations and the odd Easter egg. Anything can raise one with showToast(text);
// ToastHost (mounted once in App) shows it for a few seconds. Screen readers hear it politely.
const EVENT = "vn-toast";

export const showToast = (text, ms = 4500) => {
  if (typeof window === "undefined" || !text) return;
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { text, ms } }));
};

export function ToastHost() {
  const [toast, setToast] = useState(null);
  const timer = useRef(null);

  useEffect(() => {
    const onToast = (e) => {
      const { text, ms } = e.detail || {};
      clearTimeout(timer.current);
      setToast({ text, id: Date.now() });
      timer.current = setTimeout(() => setToast(null), ms || 4500);
    };
    window.addEventListener(EVENT, onToast);
    return () => {
      window.removeEventListener(EVENT, onToast);
      clearTimeout(timer.current);
    };
  }, []);

  return (
    <div className="vn-toast-wrap" aria-live="polite" role="status">
      {toast && (
        <div key={toast.id} className="vn-toast" onClick={() => setToast(null)}>
          {toast.text}
        </div>
      )}
    </div>
  );
}
