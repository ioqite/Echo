// Theme management: auto / light / dark, persisted
// `auto` resolves to light/dark via system preference; detection failure defaults to dark.

const STORAGE_KEY = 'echo.theme';
let currentSetting = 'auto';
let effectiveTheme = 'dark';
const listeners = new Set();

function systemTheme() {
  try {
    if (typeof window === 'undefined' || !window.matchMedia) return 'dark';
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    if (!mql) return 'dark';
    // Some browsers throw on .matches if the feature is unavailable
    return mql.matches ? 'dark' : 'light';
  } catch {
    return 'dark';
  }
}

export function getSetting() { return currentSetting; }
export function getEffectiveTheme() { return effectiveTheme; }

function resolveEffective(setting) {
  if (setting === 'light') return 'light';
  if (setting === 'dark') return 'dark';
  // auto
  return systemTheme();
}

export function applyTheme(setting) {
  currentSetting = ['auto', 'light', 'dark'].includes(setting) ? setting : 'auto';
  effectiveTheme = resolveEffective(currentSetting);
  // IMPORTANT: data-theme always reflects the *effective* theme so CSS variables resolve.
  document.documentElement.setAttribute('data-theme', effectiveTheme);
  // Also expose data-theme-pref for UI hints (which icon to show etc.)
  document.documentElement.setAttribute('data-theme-pref', currentSetting);
  try { localStorage.setItem(STORAGE_KEY, currentSetting); } catch {}
  listeners.forEach(fn => fn(effectiveTheme, currentSetting));
}

export function initTheme() {
  let saved = 'auto';
  try { saved = localStorage.getItem(STORAGE_KEY) || 'auto'; } catch {}
  applyTheme(saved);
  // Listen to system theme changes when in auto
  try {
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    if (mql) {
      const handler = () => { if (currentSetting === 'auto') applyTheme('auto'); };
      if (mql.addEventListener) mql.addEventListener('change', handler);
      else if (mql.addListener) mql.addListener(handler);
    }
  } catch {}
}

export function onThemeChange(fn) {
  listeners.add(fn);
  // Fire immediately with current state so subscribers can sync
  try { fn(effectiveTheme, currentSetting); } catch {}
  return () => listeners.delete(fn);
}

export function cycleSetting() {
  const next = { auto: 'light', light: 'dark', dark: 'auto' };
  applyTheme(next[currentSetting]);
}
