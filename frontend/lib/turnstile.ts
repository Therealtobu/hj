declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: Record<string, unknown>) => string;
      remove: (widgetId: string) => void;
    };
    __turnstileLoadPromise?: Promise<void>;
  }
}

const TURNSTILE_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

function waitForTurnstile(maxRetries = 120, delayMs = 250): Promise<void> {
  return new Promise((resolve, reject) => {
    let retries = 0;
    const tick = () => {
      if (window.turnstile) return resolve();
      retries += 1;
      if (retries >= maxRetries) return reject(new Error("Turnstile API not available"));
      setTimeout(tick, delayMs);
    };
    tick();
  });
}

export function ensureTurnstileLoaded(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (window.__turnstileLoadPromise) return window.__turnstileLoadPromise;

  window.__turnstileLoadPromise = new Promise<void>((resolve, reject) => {
    const existing = document.getElementById("cf-turnstile-script") as HTMLScriptElement | null;
    if (existing) {
      waitForTurnstile().then(resolve).catch(reject);
      return;
    }

    const script = document.createElement("script");
    script.id = "cf-turnstile-script";
    script.src = TURNSTILE_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => waitForTurnstile().then(resolve).catch(reject);
    script.onerror = () => reject(new Error("Failed to load Turnstile script"));
    document.head.appendChild(script);
  }).catch((err) => {
    window.__turnstileLoadPromise = undefined;
    throw err;
  });

  return window.__turnstileLoadPromise;
}
