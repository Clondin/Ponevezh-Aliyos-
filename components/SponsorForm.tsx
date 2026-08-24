"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { clearBasket } from "@/lib/basket";

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
  itemIds,
}: {
  itemId: string;
  tokenizationKey: string;
  banquestEnvironment: "sandbox" | "production";
  itemIds?: string[];
}) {
  const router = useRouter();
  const hostedTokenization = useRef<HostedTokenizationClient | null>(null);
  const [donorName, setDonorName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [names, setNames] = useState<string[]>([""]);
  const [dedicationType, setDedicationType] = useState<"none" | "honor" | "memory">("none");
  const [dedicationName, setDedicationName] = useState("");
  const [dedicationMessage, setDedicationMessage] = useState("");
  const [honoreeEmail, setHonoreeEmail] = useState("");
  const [publicRecognition, setPublicRecognition] = useState(false);
  const [recognitionName, setRecognitionName] = useState("");
  const [method, setMethod] = useState<Method>("card");
  const [cardReady, setCardReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isCombined = Boolean(itemIds && itemIds.length > 1);

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
      ...(isCombined ? { kibbudIds: itemIds } : { kibbudId: itemId }),
      donorName,
      email,
      ...(method === "wire" && phone.trim() ? { phone: phone.trim() } : {}),
      misheberachNames: names.map((name) => name.trim()).filter(Boolean),
      ...(dedicationType !== "none"
        ? {
            dedicationType,
            dedicationName: dedicationName.trim(),
            ...(dedicationMessage.trim() ? { dedicationMessage: dedicationMessage.trim() } : {}),
            ...(honoreeEmail.trim() ? { honoreeEmail: honoreeEmail.trim() } : {}),
          }
        : {}),
      publicRecognition,
      ...(publicRecognition
        ? { recognitionName: recognitionName.trim() || donorName.trim() }
        : {}),
    };

    try {
      if (method === "wire" && !isCombined) {
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

      const response = await fetch(isCombined ? "/api/cart/checkout" : "/api/checkout", {
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
      if (isCombined) {
        clearBasket();
        router.push(`/basket/confirmation?key=${encodeURIComponent(body.paymentId)}`);
      } else {
        const params = new URLSearchParams({
          item: itemId,
          method: "card",
          key: body.paymentId,
        });
        router.push(`/confirmation?${params.toString()}`);
      }
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

      {method === "wire" ? (
        <div className="field">
          <label htmlFor="phone">Phone <span className="label-optional">optional</span></label>
          <input
            id="phone"
            type="tel"
            className="input"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="For the office if follow-up is needed"
            autoComplete="tel"
          />
        </div>
      ) : null}

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

      <fieldset className="form-section">
        <legend className="field-label">Dedication <span className="label-optional">optional</span></legend>
        <div className="segmented-control">
          {([
            ["none", "No dedication"],
            ["honor", "In honor of"],
            ["memory", "In memory of"],
          ] as const).map(([value, label]) => (
            <label key={value} className={dedicationType === value ? "selected" : undefined}>
              <input
                type="radio"
                name="dedicationType"
                value={value}
                checked={dedicationType === value}
                onChange={() => setDedicationType(value)}
              />
              {label}
            </label>
          ))}
        </div>
        {dedicationType !== "none" ? (
          <div className="dedication-fields">
            <div className="field">
              <label htmlFor="dedication-name">Name</label>
              <input
                id="dedication-name"
                className="input"
                required
                value={dedicationName}
                onChange={(event) => setDedicationName(event.target.value)}
                placeholder={dedicationType === "memory" ? "Name of the person remembered" : "Name of the person honored"}
              />
            </div>
            <div className="field">
              <label htmlFor="dedication-message">Short message <span className="label-optional">optional</span></label>
              <textarea
                id="dedication-message"
                className="input textarea"
                maxLength={500}
                value={dedicationMessage}
                onChange={(event) => setDedicationMessage(event.target.value)}
                placeholder="A bracha or personal note"
              />
            </div>
            <div className="field">
              <label htmlFor="honoree-email">Notification email <span className="label-optional">optional</span></label>
              <input
                id="honoree-email"
                type="email"
                className="input"
                value={honoreeEmail}
                onChange={(event) => setHonoreeEmail(event.target.value)}
                placeholder="We can notify the honoree or family after payment"
                autoComplete="off"
              />
            </div>
          </div>
        ) : null}
      </fieldset>

      <div className="recognition-option">
        <label>
          <input
            type="checkbox"
            checked={publicRecognition}
            onChange={(event) => setPublicRecognition(event.target.checked)}
          />
          <span>
            <strong>List this sponsorship on the public recognition page</strong>
            <small>Your email and Mi Shebeirach names are never displayed.</small>
          </span>
        </label>
        {publicRecognition ? (
          <div className="field">
            <label htmlFor="recognition-name">Display name</label>
            <input
              id="recognition-name"
              className="input"
              value={recognitionName}
              onChange={(event) => setRecognitionName(event.target.value)}
              placeholder={donorName || "Family or sponsor name"}
            />
          </div>
        ) : null}
      </div>

      <span className="field-label" style={{ marginBottom: 10 }}>
        Payment
      </span>
      <div className="pay-options" role="radiogroup" aria-label="Payment method">
        {PAY_OPTIONS.filter((option) => !isCombined || option.id === "card").map((option) => (
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
        {isCombined ? " All selected kibbudim will appear as one card charge." : ""}
      </p>
    </form>
  );
}
