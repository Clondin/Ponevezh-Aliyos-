"use client";

import Script from "next/script";
import { useCallback, useEffect, useId, useRef, useState } from "react";

interface TurnstileApi {
  render(target: string | HTMLElement, options: Record<string, unknown>): string;
  remove(widgetId: string): void;
  reset(widgetId: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export default function TurnstileWidget({
  siteKey,
  action,
  onToken,
}: {
  siteKey: string;
  action: string;
  onToken: (token: string | null) => void;
}) {
  const reactId = useId().replaceAll(":", "");
  const elementId = `turnstile-${reactId}`;
  const widgetId = useRef<string | undefined>(undefined);
  const [scriptReady, setScriptReady] = useState(false);
  const markReady = useCallback(() => setScriptReady(true), []);

  useEffect(() => {
    if (!siteKey || !scriptReady || !window.turnstile || widgetId.current) return;
    widgetId.current = window.turnstile.render(`#${elementId}`, {
      sitekey: siteKey,
      action,
      theme: "light",
      size: "flexible",
      appearance: "interaction-only",
      callback: (token: string) => onToken(token),
      "expired-callback": () => onToken(null),
      "error-callback": () => onToken(null),
    });
    return () => {
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current);
      widgetId.current = undefined;
    };
  }, [action, elementId, onToken, scriptReady, siteKey]);

  if (!siteKey) return null;
  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onLoad={markReady}
        onReady={markReady}
      />
      <div id={elementId} className="turnstile-widget" />
    </>
  );
}
