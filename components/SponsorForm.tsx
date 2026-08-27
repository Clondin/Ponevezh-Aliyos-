"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { clearBasket } from "@/lib/basket";
import { usd } from "@/lib/format";
import { withBasePath } from "@/lib/site-paths";

interface TokenizationResult {
  nonce?: string;
  expiryMonth?: string | number;
  expiryYear?: string | number;
  avsZip?: string;
  expiry_month?: string | number;
  expiry_year?: string | number;
  avs_zip?: string;
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
      styles?: Record<string, string>;
    }
  ): HostedTokenizationClient;
}

declare global {
  interface Window {
    HostedTokenization?: HostedTokenizationConstructor;
  }
}

interface SponsorFormProps {
  itemId: string;
  amount: number;
  itemIds?: string[];
  tokenizationKey: string;
  banquestEnvironment: "sandbox" | "production";
  checkoutReady: boolean;
}

function tokenizationScript(environment: "sandbox" | "production"): string {
  return environment === "production"
    ? "https://tokenization.banquestgateway.com/tokenization/v0.3"
    : "https://tokenization.sandbox.banquestgateway.com/tokenization/v0.3";
}

const FIELD_STYLE =
  "font-size: 16px; padding: 12px 14px; border: 1px solid #d8d2c7; border-radius: 0; background: #ffffff; color: #1a1815;";

function LockIcon({ size = 13 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden="true"
    >
      <rect x="3" y="7" width="10" height="7" rx="0.5" />
      <path d="M5 7V5a3 3 0 0 1 6 0v2" />
    </svg>
  );
}

function tokenizationMessage(error: unknown): string {
  if (error && typeof error === "object" && "fieldErrors" in error) {
    return "Check the highlighted card details and try again.";
  }
  return error instanceof Error && error.message
    ? error.message
    : "Check your card details and try again.";
}

export default function SponsorForm({
  itemId,
  amount,
  itemIds,
  tokenizationKey,
  banquestEnvironment,
  checkoutReady,
}: SponsorFormProps) {
  const router = useRouter();
  const hostedTokenization = useRef<HostedTokenizationClient | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [names, setNames] = useState<string[]>([""]);
  const [dedicationType, setDedicationType] = useState<"none" | "honor" | "memory">("none");
  const [dedicationName, setDedicationName] = useState("");
  const [dedicationMessage, setDedicationMessage] = useState("");
  const [honoreeEmail, setHonoreeEmail] = useState("");
  const [assignmentAccepted, setAssignmentAccepted] = useState(false);
  const [cardReady, setCardReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isCombined = Boolean(itemIds && itemIds.length > 1);
  const donorName = `${firstName.trim()} ${lastName.trim()}`.trim();

  useEffect(() => {
    if (!checkoutReady || !tokenizationKey) return;

    let cancelled = false;
    const initialize = () => {
      if (cancelled || hostedTokenization.current || !window.HostedTokenization) return;
      try {
        const client = new window.HostedTokenization(tokenizationKey, {
          target: "#banquest-card-fields",
          showZip: true,
          requireCvv2: true,
          showFieldErrors: true,
          // Matched to the site's "Vault Light" tokens: ink text, --rule
          // borders, square corners, uppercase micro labels.
          styles: {
            container:
              "font-family: -apple-system, 'Segoe UI', system-ui, sans-serif; color: #1a1815;",
            card: FIELD_STYLE,
            expiryMonth: FIELD_STYLE,
            expiryYear: FIELD_STYLE,
            cvv2: FIELD_STYLE,
            avsZip: FIELD_STYLE,
            labels:
              "font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #625d55; margin-bottom: 6px;",
            fieldErrors: "font-size: 12.5px; color: #8b2f2d;",
          },
        });
        hostedTokenization.current = client;
        client.on("ready", () => {
          if (!cancelled) setCardReady(true);
        });
      } catch {
        if (!cancelled) setError("The secure card form could not load. Refresh and try again.");
      }
    };

    const selector = `script[data-banquest-tokenization="${banquestEnvironment}"]`;
    const existing = document.querySelector<HTMLScriptElement>(selector);
    if (window.HostedTokenization) {
      initialize();
    } else if (existing) {
      existing.addEventListener("load", initialize, { once: true });
    } else {
      const script = document.createElement("script");
      script.src = tokenizationScript(banquestEnvironment);
      script.async = true;
      script.dataset.banquestTokenization = banquestEnvironment;
      script.addEventListener("load", initialize, { once: true });
      script.addEventListener(
        "error",
        () => {
          if (!cancelled) setError("The secure card form could not load. Refresh and try again.");
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
  }, [banquestEnvironment, checkoutReady, tokenizationKey]);

  const setName = (index: number, value: string) =>
    setNames((current) => current.map((name, position) => (position === index ? value : name)));
  const addName = () => setNames((current) => [...current, ""]);
  const removeName = (index: number) =>
    setNames((current) =>
      current.length > 1 ? current.filter((_, position) => position !== index) : current
    );

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      if (!checkoutReady || !hostedTokenization.current || !cardReady) {
        throw new Error("Online card payment is not ready. Please try again shortly.");
      }

      let token: TokenizationResult;
      try {
        token = await hostedTokenization.current.getNonceToken();
      } catch (tokenError) {
        throw new Error(tokenizationMessage(tokenError));
      }
      const expiryMonth = Number(token.expiryMonth ?? token.expiry_month);
      const expiryYear = Number(token.expiryYear ?? token.expiry_year);
      if (!token.nonce || !Number.isInteger(expiryMonth) || !Number.isInteger(expiryYear)) {
        throw new Error("Check your card details and try again.");
      }

      const response = await fetch(
        withBasePath(isCombined ? "/api/cart/checkout" : "/api/checkout"),
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            ...(isCombined ? { kibbudIds: itemIds } : { kibbudId: itemId }),
            donorName,
            email,
            ...(phone.trim() ? { phone: phone.trim() } : {}),
            misheberachNames: names.map((name) => name.trim()).filter(Boolean),
            ...(dedicationType !== "none"
              ? {
                  dedicationType,
                  dedicationName: dedicationName.trim(),
                  ...(dedicationMessage.trim()
                    ? { dedicationMessage: dedicationMessage.trim() }
                    : {}),
                  ...(honoreeEmail.trim() ? { honoreeEmail: honoreeEmail.trim() } : {}),
                }
              : {}),
            assignmentAccepted,
            payment: {
              nonce: token.nonce,
              expiryMonth,
              expiryYear,
              avsZip: token.avsZip ?? token.avs_zip,
            },
          }),
        }
      );
      const body = (await response.json()) as {
        paymentId?: string;
        status?: "sold" | "pending";
        error?: { message?: string };
      };
      if (!response.ok || !body.paymentId || !body.status) {
        throw new Error(body.error?.message || "The card payment could not be completed.");
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
  }

  return (
    <form onSubmit={onSubmit} aria-busy={submitting}>
      <div className="campaign-notice">
        <span className="campaign-notice__step">Sponsorship details</span>
        Reserved. Enter your details and pay <strong>{usd(amount)}</strong>.
      </div>

      <div className="field">
        <label htmlFor="first-name">First name</label>
        <input id="first-name" className="input" required value={firstName} onChange={(event) => setFirstName(event.target.value)} autoComplete="given-name" />
      </div>
      <div className="field">
        <label htmlFor="last-name">Last name</label>
        <input id="last-name" className="input" required value={lastName} onChange={(event) => setLastName(event.target.value)} autoComplete="family-name" />
      </div>
      <div className="field">
        <label htmlFor="email">Email</label>
        <input id="email" type="email" className="input" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="For your receipt" autoComplete="email" />
      </div>
      <div className="field">
        <label htmlFor="phone">Phone <span className="label-optional">optional</span></label>
        <input id="phone" type="tel" className="input" value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="tel" />
      </div>

      <div className="field field--names">
        <span className="field-label">Names for the Mi Shebeirach</span>
        <div className="name-rows">
          {names.map((name, index) => (
            <div className="name-row" key={index}>
              <input className="input input--hebrew" dir="rtl" lang="he" value={name} onChange={(event) => setName(index, event.target.value)} placeholder="פלוני בן פלונית" aria-label={`Name ${index + 1}`} />
              {names.length > 1 ? (
                <button type="button" className="name-row__remove" onClick={() => removeName(index)} aria-label={`Remove name ${index + 1}`}>&times;</button>
              ) : null}
            </div>
          ))}
        </div>
        <button type="button" className="add-name" onClick={addName}>+ Add another name</button>
        <div className="hint">Enter names exactly as they should be read. Hebrew is welcome.</div>
      </div>

      <fieldset className="form-section">
        <legend className="field-label">Dedication <span className="label-optional">optional</span></legend>
        <div className="segmented-control">
          {([["none", "No dedication"], ["honor", "In honor of"], ["memory", "In memory of"]] as const).map(([value, label]) => (
            <label key={value} className={dedicationType === value ? "selected" : undefined}>
              <input type="radio" name="dedicationType" value={value} checked={dedicationType === value} onChange={() => setDedicationType(value)} />
              {label}
            </label>
          ))}
        </div>
        {dedicationType !== "none" ? (
          <div className="dedication-fields">
            <div className="field">
              <label htmlFor="dedication-name">Name</label>
              <input id="dedication-name" className="input" required value={dedicationName} onChange={(event) => setDedicationName(event.target.value)} placeholder={dedicationType === "memory" ? "Name of the person remembered" : "Name of the person honored"} />
            </div>
            <div className="field">
              <label htmlFor="dedication-message">Short message <span className="label-optional">optional</span></label>
              <textarea id="dedication-message" className="input textarea" maxLength={500} value={dedicationMessage} onChange={(event) => setDedicationMessage(event.target.value)} placeholder="A bracha or personal note" />
            </div>
            <div className="field">
              <label htmlFor="honoree-email">Notification email <span className="label-optional">optional</span></label>
              <input id="honoree-email" type="email" className="input" value={honoreeEmail} onChange={(event) => setHonoreeEmail(event.target.value)} placeholder="We can notify the honoree or family" autoComplete="off" />
            </div>
          </div>
        ) : null}
      </fieldset>

      <div className="assignment-disclosure">
        <p><strong>Aliyah assignment:</strong> The Yeshiva assigns aliyos to Roshei Yeshiva, Rabbanim, and congregants. Sponsorship does not guarantee that you will receive the aliyah. It guarantees a Mi Shebeirach for the names you provide.</p>
        <label><input type="checkbox" required checked={assignmentAccepted} onChange={(event) => setAssignmentAccepted(event.target.checked)} /><span>I understand and agree.</span></label>
      </div>

      <section className="pay-panel" aria-label="Payment">
        <div className="pay-panel__head">
          <span className="pay-panel__label">
            <LockIcon /> Payment
          </span>
          <span className="pay-panel__secure">Secured by Banquest</span>
        </div>
        <div className="pay-panel__body">
          <div className="pay-panel__summary">
            <span>{isCombined ? "Selected kibbudim" : "Kibbud sponsorship"}</span>
            <span className="pay-panel__amount">{usd(amount)}</span>
          </div>

          <div className="card-fields">
            {checkoutReady ? <div id="banquest-card-fields" /> : null}
            {checkoutReady && !cardReady ? (
              <div className="card-fields__loading" role="status">
                <span className="card-fields__spinner" aria-hidden="true" />
                Loading secure card fields&hellip;
              </div>
            ) : null}
            {!checkoutReady ? (
              <p className="form-error" role="alert">Online card payment is being configured. Please try again shortly.</p>
            ) : null}
          </div>

          <div className="pay-panel__brands">
            Visa &middot; Mastercard &middot; American Express &middot; Discover
          </div>

          <button type="submit" className="btn btn--fill btn--block" disabled={submitting || !cardReady}>
            {submitting ? "Processing payment…" : `Pay ${usd(amount)}`}
          </button>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          <p className="pay-panel__trust">
            <LockIcon size={12} />
            <span>
              Encrypted connection. Your card details are entered in
              Banquest&rsquo;s secure fields and never pass through this
              website.
            </span>
          </p>
        </div>
      </section>
      <p className="fineprint">
        Contributions are processed for American Friends of Ponevez Yeshiva in
        Israel, Inc., a 501(c)(3) organization. A receipt is emailed to you.
      </p>
    </form>
  );
}
