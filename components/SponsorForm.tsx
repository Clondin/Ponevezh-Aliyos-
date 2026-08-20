"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Method = "card" | "wire";

interface TokenizationResult {
  nonce?: string;
  expiryMonth?: string | number;
  expiryYear?: string | number;
  avsZip?: string;
  expiry_month?: string | number;
  expiry_year?: string | number;
  avs_zip?: string;
  error?: string;
}

interface HostedTokenizationClient {
  on(eventType: "ready", handler: () => void): HostedTokenizationClient;
  getNonceToken(): Promise<TokenizationResult>;
  destroy(): void;
}

interface HostedTokenizationConstructor {
  new (
    publicKey: string,
    options: {
      target: string;
      showZip: boolean;
      requireCvv2: boolean;
      showFieldErrors: boolean;
    }
  ): HostedTokenizationClient;
}

declare global {
  interface Window {
    HostedTokenization?: HostedTokenizationConstructor;
  }
}

const PAY_OPTIONS: Array<{ id: Method; title: string; desc: string }> = [
  {
    id: "card",
    title: "Credit card",
    desc: "Securely pay with a major credit card.",
  },
  {
    id: "wire",
    title: "Reserve and pay by wire",
    desc: "Hold this kibbud for 72 hours while you arrange a wire or check with the office.",
  },
];

function tokenizationScript(environment: "sandbox" | "production"): string {
  return environment === "production"
    ? "https://tokenization.banquestgateway.com/tokenization/v0.3"
    : "https://tokenization.sandbox.banquestgateway.com/tokenization/v0.3";
}

export default function SponsorForm({
  itemId,
  tokenizationKey,
  banquestEnvironment,
}: {
  itemId: string;
  tokenizationKey: string;
  banquestEnvironment: "sandbox" | "production";
}) {
  const router = useRouter();
  const hostedTokenization = useRef<HostedTokenizationClient | null>(null);
  const [donorName, setDonorName] = useState("");
  const [email, setEmail] = useState("");
  const [names, setNames] = useState<string[]>([""]);
  const [method, setMethod] = useState<Method>("card");
  const [cardReady, setCardReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tokenizationKey) {
      setError("Online card payments are not configured yet. Please choose wire.");
      return;
    }

    let cancelled = false;
    const initialize = () => {
      if (cancelled || hostedTokenization.current || !window.HostedTokenization) return;
      try {
        const client = new window.HostedTokenization(tokenizationKey, {
          target: "#banquest-card-fields",
          showZip: true,
          requireCvv2: true,
          showFieldErrors: true,
        });
        hostedTokenization.current = client;
        client.on("ready", () => {
          if (!cancelled) setCardReady(true);
        });
      } catch {
        setError("The secure credit-card form could not load. Please refresh and try again.");
      }
    };

    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-banquest-tokenization="true"]'
    );
    if (window.HostedTokenization) {
      initialize();
    } else if (existing) {
      existing.addEventListener("load", initialize, { once: true });
    } else {
      const script = document.createElement("script");
      script.src = tokenizationScript(banquestEnvironment);
      script.async = true;
      script.dataset.banquestTokenization = "true";
      script.addEventListener("load", initialize, { once: true });
      script.addEventListener(
        "error",
        () => {
          if (!cancelled) {
            setError("The secure credit-card form could not load. Please refresh and try again.");
          }
        },
        { once: true }
      );
      document.head.appendChild(script);
    }

    return () => {
      cancelled = true;
      existing?.removeEventListener("load", initialize);
      hostedTokenization.current?.destroy();
      hostedTokenization.current = null;
      setCardReady(false);
    };
  }, [banquestEnvironment, tokenizationKey]);

  const setName = (i: number, value: string) =>
    setNames((current) => current.map((name, j) => (j === i ? value : name)));
  const addName = () => setNames((current) => [...current, ""]);
  const removeName = (i: number) =>
    setNames((current) =>
      current.length > 1 ? current.filter((_, j) => j !== i) : current
    );

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const payload = {
      kibbudId: itemId,
      donorName,
      email,
      misheberachNames: names.map((name) => name.trim()).filter(Boolean),
    };

    try {
      if (method === "wire") {
        const response = await fetch("/api/pledge", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
        const body = (await response.json()) as {
          pledgeId?: string;
          error?: { message?: string };
        };
        if (!response.ok || !body.pledgeId) {
          throw new Error(body.error?.message || "The reservation could not be created.");
        }
        const params = new URLSearchParams({
          item: itemId,
          method: "wire",
          pledge: body.pledgeId,
        });
        router.push(`/confirmation?${params.toString()}`);
        return;
      }

      if (!hostedTokenization.current || !cardReady) {
        throw new Error("The secure credit-card form is still loading. Please try again.");
      }
      const token = await hostedTokenization.current.getNonceToken();
      const expiryMonth = Number(token.expiryMonth ?? token.expiry_month);
      const expiryYear = Number(token.expiryYear ?? token.expiry_year);
      if (!token.nonce || !Number.isInteger(expiryMonth) || !Number.isInteger(expiryYear)) {
        throw new Error(token.error || "Please check the credit-card details and try again.");
      }

      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...payload,
          payment: {
            nonce: token.nonce,
            expiryMonth,
            expiryYear,
            avsZip: token.avsZip ?? token.avs_zip,
          },
        }),
      });
      const body = (await response.json()) as {
        paymentId?: string;
        status?: "sold" | "pending";
        error?: { message?: string };
      };
      if (!response.ok || !body.paymentId || !body.status) {
        throw new Error(body.error?.message || "The credit-card payment could not be completed.");
      }
      const params = new URLSearchParams({
        item: itemId,
        method: "card",
        key: body.paymentId,
      });
      router.push(`/confirmation?${params.toString()}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong.");
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={onSubmit} aria-busy={submitting}>
      <div className="field">
        <label htmlFor="donor">Your name</label>
        <input
          id="donor"
          className="input"
          required
          value={donorName}
          onChange={(event) => setDonorName(event.target.value)}
          placeholder="As it should appear on the receipt"
          autoComplete="name"
        />
      </div>

      <div className="field">
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          className="input"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="For your receipt and confirmation"
          autoComplete="email"
        />
      </div>

      <div className="field field--names">
        <span className="field-label">Names for the Mi Shebeirach</span>
        <div className="name-rows">
          {names.map((name, index) => (
            <div className="name-row" key={index}>
              <input
                className="input input--hebrew"
                dir="rtl"
                lang="he"
                value={name}
                onChange={(event) => setName(index, event.target.value)}
                placeholder="פלוני בן פלונית"
                aria-label={`Name ${index + 1}`}
              />
              {names.length > 1 && (
                <button
                  type="button"
                  className="name-row__remove"
                  onClick={() => removeName(index)}
                  aria-label={`Remove name ${index + 1}`}
                >
                  &times;
                </button>
              )}
            </div>
          ))}
        </div>
        <button type="button" className="add-name" onClick={addName}>
          + Add another name
        </button>
        <div className="hint">
          Hebrew is welcome here. The gabbai reads these names exactly as written.
        </div>
      </div>

      <span className="field-label" style={{ marginBottom: 10 }}>
        Payment
      </span>
      <div className="pay-options" role="radiogroup" aria-label="Payment method">
        {PAY_OPTIONS.map((option) => (
          <label
            key={option.id}
            className={`pay-option${method === option.id ? " pay-option--selected" : ""}`}
          >
            <input
              type="radio"
              name="method"
              value={option.id}
              checked={method === option.id}
              onChange={() => setMethod(option.id)}
            />
            <span className="pay-option__dot" aria-hidden="true" />
            <span>
              <span className="pay-option__title">{option.title}</span>
              <span className="pay-option__desc">{option.desc}</span>
            </span>
          </label>
        ))}
      </div>

      <div className={method === "card" ? "card-fields" : "card-fields card-fields--hidden"}>
        <div id="banquest-card-fields" />
        {!cardReady && tokenizationKey && (
          <p className="card-fields__loading" role="status">
            Loading secure credit-card fields…
          </p>
        )}
      </div>

      <button
        type="submit"
        className="btn btn--fill btn--block"
        disabled={submitting || (method === "card" && !cardReady)}
      >
        {submitting
          ? "Please wait…"
          : method === "wire"
            ? "Reserve this kibbud"
            : "Sponsor with credit card"}
      </button>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <p className="fineprint">
        Credit-card details are securely collected by Banquest and never pass through
        this website. Contributions are processed by American Friends of Ponevez
        Yeshiva in Israel, Inc., a 501(c)(3) organization.
      </p>
    </form>
  );
}
