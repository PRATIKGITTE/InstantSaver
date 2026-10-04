// Shared helpers for locale-prefixed URLs (e.g. /hi/faq). English is the default
// and has NO prefix — only hi/id/th/es get one, matching the existing translation.json
// locale set. Keeping this logic in one place avoids every page re-deriving it slightly
// differently (and getting the trailing-slash/canonical edge cases wrong individually).
export const SUPPORTED_LOCALES = ["hi", "id", "th", "es"];

const SITE_ORIGIN = "https://instantsaver.in";

// "/hi/faq" -> { lang: "hi", rest: "/faq" }; "/faq" -> { lang: null, rest: "/faq" };
// "/hi" -> { lang: "hi", rest: "/" }; "/" -> { lang: null, rest: "/" }.
export function parseLocalePath(pathname) {
  const parts = (pathname || "/").split("/").filter(Boolean);
  if (parts.length > 0 && SUPPORTED_LOCALES.includes(parts[0])) {
    const rest = "/" + parts.slice(1).join("/");
    return { lang: parts[0], rest: rest === "/" ? "/" : rest.replace(/\/$/, "") || "/" };
  }
  return { lang: null, rest: pathname === "/" || !pathname ? "/" : pathname.replace(/\/$/, "") };
}

// Absolute canonical URL for `path` (e.g. "/", "/faq") in a given language.
export function canonicalUrl(path, lang) {
  const prefix = lang && lang !== "en" ? `/${lang}` : "";
  if (path === "/") return prefix ? `${SITE_ORIGIN}${prefix}` : `${SITE_ORIGIN}/`;
  return `${SITE_ORIGIN}${prefix}${path}`;
}

// Where to navigate to keep the same page when switching language.
export function switchLocalePath(pathname, newLang) {
  const { rest } = parseLocalePath(pathname);
  const prefix = newLang && newLang !== "en" ? `/${newLang}` : "";
  if (rest === "/") return prefix || "/";
  return `${prefix}${rest}`;
}

// Prefix an in-app path with the current language, for nav links that should keep
// the visitor in whatever language they're already reading (e.g. header/footer links).
export function localizedHref(path, lang) {
  const prefix = lang && lang !== "en" ? `/${lang}` : "";
  if (path === "/") return prefix || "/";
  return `${prefix}${path}`;
}

// Captured once, synchronously, when this module first loads — the exact path+hash the
// browser actually requested, before any client-side routing has had a chance to run.
// This (not a bare "was the page EVER reloaded" flag) is what's needed: a flag alone can't
// tell "the route that was on-screen at the moment of a real browser refresh" apart from
// "a route the user later clicked their way into during the same session" — e.g. refresh
// the plain homepage, then click the FAQ link: the document's one Navigation Timing entry
// says "reload" for the whole page lifetime, but that click was obviously not a reload of
// "/#faq", and must not be treated as one just because the page it happened on had been.
const _initialLoad = (() => {
  let isReload = false;
  try {
    isReload = performance.getEntriesByType("navigation")[0]?.type === "reload";
  } catch {
    // Navigation Timing unsupported in this browser — treat as not-a-reload (safe default,
    // matches the pre-existing "just scroll/stay" behavior with no special-casing).
  }
  return { isReload, pathname: window.location.pathname, hash: window.location.hash };
})();
const _consumedFor = new Set();

// True at most once per distinct (pathname, hash) pair, and only when that exact pair is
// the one that was actually on-screen at the real browser reload — so a hash default of
// "" correctly matches a no-hash route like "/contact", and a later navigation that merely
// LOOKS like the same URL (e.g. clicking back to it a second time) is never mistaken for
// a reload the second time around.
export function isRefreshOf(pathname, hash = "") {
  if (!_initialLoad.isReload) return false;
  if (_initialLoad.pathname !== pathname || _initialLoad.hash !== hash) return false;
  const key = pathname + hash;
  if (_consumedFor.has(key)) return false;
  _consumedFor.add(key);
  return true;
}
