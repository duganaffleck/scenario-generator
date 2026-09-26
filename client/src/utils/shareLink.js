// Share a scenario as a link. The whole scenario rides in the URL fragment (#s=...), compressed.
// Nothing is stored on the server: the fragment never leaves the browser, and the link works for as long
// as the site does. A Detailed scenario makes a link of roughly 14,000 characters: fine for browsers,
// email and course sites, but some chat apps cut long links off.

const PREFIX = "#s=";
const VERSION = 1;

const toBase64Url = (bytes) => {
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const fromBase64Url = (text) => {
  const b64 = text.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((text.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
};

const pipeThrough = async (bytes, stream) => {
  const res = new Response(new Blob([bytes]).stream().pipeThrough(stream));
  return new Uint8Array(await res.arrayBuffer());
};

// Empty strings, arrays and objects add length and show nothing, so they are left out of the link.
const dropEmpty = (v) => {
  if (Array.isArray(v)) {
    const a = v.map(dropEmpty).filter((x) => x !== undefined);
    return a.length ? a : undefined;
  }
  if (v && typeof v === "object") {
    const o = {};
    Object.entries(v).forEach(([k, x]) => {
      const y = dropEmpty(x);
      if (y !== undefined) o[k] = y;
    });
    return Object.keys(o).length ? o : undefined;
  }
  return v === "" || v === null ? undefined : v;
};

export const canShareLinks = () =>
  typeof window !== "undefined" && typeof window.CompressionStream === "function" && typeof window.DecompressionStream === "function";

export async function buildShareLink(scenario, formData = {}) {
  const { semester, type, environment, complexity, scenarioFriction, generationDepth, shiftMode } = formData;
  const payload = JSON.stringify({ v: VERSION, f: { semester, type, environment, complexity, scenarioFriction, generationDepth, shiftMode }, s: dropEmpty(scenario) });
  const packed = await pipeThrough(new TextEncoder().encode(payload), new window.CompressionStream("deflate-raw"));
  const { origin, pathname } = window.location;
  return `${origin}${pathname}${PREFIX}${toBase64Url(packed)}`;
}

export const hasSharedScenario = (hash = window.location.hash) => String(hash || "").startsWith(PREFIX);

// Returns { scenario, formData } or throws with a plain-language message.
export async function readSharedScenario(hash = window.location.hash) {
  if (!hasSharedScenario(hash)) throw new Error("This isn't a scenario link.");
  if (!canShareLinks()) throw new Error("This browser can't open scenario links. Try a current version of Chrome, Edge, Firefox or Safari.");
  let data;
  try {
    const bytes = await pipeThrough(fromBase64Url(hash.slice(PREFIX.length)), new window.DecompressionStream("deflate-raw"));
    data = JSON.parse(new TextDecoder().decode(bytes));
  } catch (e) {
    throw new Error("This scenario link is incomplete. It may have been cut off when it was pasted. Ask for the link again, or for the PDF.");
  }
  if (!data || data.v !== VERSION || !data.s || typeof data.s !== "object" || typeof data.s.title !== "string") {
    throw new Error("This scenario link isn't one this version of the site can read.");
  }
  return { scenario: data.s, formData: data.f && typeof data.f === "object" ? data.f : {} };
}

export const clearSharedHash = () => {
  if (hasSharedScenario()) window.history.replaceState(null, "", window.location.pathname + window.location.search);
};
