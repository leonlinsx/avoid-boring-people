// The browser half of Turnstile, shared by the two islands that render a widget:
// the discussion form and the contact note form. Each caller keeps its own
// widget lifecycle (Preact effect in one, plain DOM in the other); everything
// that has to happen exactly once per page — the script URL, the explicit-render
// load, and the theme — lives here so the two cannot drift apart.

export const TURNSTILE_SCRIPT_URL =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

export type TurnstileWidgetId = string;

export type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      size?: 'normal' | 'compact' | 'flexible';
      theme?: 'light' | 'dark' | 'auto';
      callback?: (token: string) => void;
      'expired-callback'?: () => void;
      'error-callback'?: () => void;
    },
  ) => TurnstileWidgetId;
  reset: (widgetId?: TurnstileWidgetId) => void;
  remove: (widgetId?: TurnstileWidgetId) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

/** The global the script installs, if it has loaded. */
export function turnstileApi(): TurnstileApi | undefined {
  return window.turnstile;
}

/** The widget follows the page theme rather than the operating system's. */
export function pageTheme(): 'light' | 'dark' {
  return document.documentElement.getAttribute('data-theme') === 'dark'
    ? 'dark'
    : 'light';
}

/**
 * Loads the explicit-render script once and calls `onReady` when the widget API
 * is available. Only called when a reader asks for a form, so someone who never
 * posts downloads nothing extra.
 */
export function loadTurnstileScript(onReady: () => void): void {
  if (turnstileApi()) {
    onReady();
    return;
  }
  const existing = document.querySelector<HTMLScriptElement>(
    'script[data-turnstile-explicit]',
  );
  if (existing) {
    existing.addEventListener('load', onReady);
    return;
  }
  const script = document.createElement('script');
  script.src = TURNSTILE_SCRIPT_URL;
  script.async = true;
  script.defer = true;
  script.dataset.turnstileExplicit = 'true';
  script.addEventListener('load', onReady);
  document.head.appendChild(script);
}
