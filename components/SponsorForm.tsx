"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { clearBasket } from "@/lib/basket";
import { usd } from "@/lib/format";
import { withBasePath } from "@/lib/site-paths";

const ADMIRE_DONATION_URL = "https://ponevez.admirepro.app/donate";

interface AdmireReservation {
  pledgeId: string;
  reference: string;
  expiresAt: string;
  amount: number;
}

interface SponsorFormProps {
  itemId: string;
  amount: number;
  itemIds?: string[];
  admireCampaignId?: string;
  onReservationCreated?: (expiresAt: string) => void;
}

interface AdmirePaymentProps {
  reservation: AdmireReservation;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  campaignId?: string;
  combined: boolean;
}

function admirePaymentUrl({
  reservation,
  firstName,
  lastName,
  email,
  phone,
  campaignId,
}: Omit<AdmirePaymentProps, "combined">): string {
  const url = new URL(ADMIRE_DONATION_URL);
  url.searchParams.set("amount", String(reservation.amount));
  url.searchParams.set("firstName", firstName);
  url.searchParams.set("lastName", lastName);
  url.searchParams.set("email", email);
  if (phone) url.searchParams.set("cellPhone", phone);
  if (campaignId) url.searchParams.set("campaignID", campaignId);
  // Admire ignores unknown fields. This starts working automatically if the
  // office adds a custom field with this internal name to the donation form.
  url.searchParams.set("KibbudReference", reservation.reference);
  url.searchParams.set("recurring", "false");
  return url.toString();
}

function AdmirePayment({
  reservation,
  firstName,
  lastName,
  email,
  phone,
  campaignId,
  combined,
}: AdmirePaymentProps) {
  const paymentUrl = useMemo(
    () =>
      admirePaymentUrl({
        reservation,
        firstName,
        lastName,
        email,
        phone,
        campaignId,
      }),
    [campaignId, email, firstName, lastName, phone, reservation]
  );
  const heldUntil = new Date(reservation.expiresAt).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <section className="admire-checkout" aria-labelledby="admire-checkout-title">
      <div className="admire-checkout__intro">
        <span className="badge badge--pending">Awaiting Admire payment</span>
        <h2 id="admire-checkout-title">Complete your secure payment</h2>
        <p>
          Admire is handling the card payment. The amount below is already filled
          in for {combined ? "your selected kibbudim" : "this kibbud"}.
        </p>
        <dl className="admire-checkout__summary">
          <div>
            <dt>Exact total</dt>
            <dd>{usd(reservation.amount)}</dd>
          </div>
          <div>
            <dt>Reference</dt>
            <dd>{reservation.reference}</dd>
          </div>
          <div>
            <dt>Reserved until</dt>
            <dd>{heldUntil}</dd>
          </div>
        </dl>
        <div className="campaign-notice" role="note">
          Keep <strong>One-Time</strong> selected and do not change the amount.
          Admire will show the payment confirmation inside the secure form.
        </div>
      </div>

      <iframe
        className="admire-checkout__frame"
        src={paymentUrl}
        title="Secure Ponevez donation payment through Admire"
        allow="payment"
        loading="eager"
        referrerPolicy="strict-origin-when-cross-origin"
      />

      <div className="admire-checkout__fallback">
        <p>
          If the secure form does not appear, open it in a new tab. Use the same
          email address and the exact total shown above.
        </p>
        <div className="actions">
          <a className="btn btn--outline" href={paymentUrl} target="_blank" rel="noreferrer">
            Open secure payment
          </a>
          <Link
            className="btn btn--outline-bronze"
            href="/find"
            onClick={combined ? clearBasket : undefined}
          >
            Return to kibbudim
          </Link>
        </div>
        <p className="fineprint">
          Until Admire&rsquo;s webhook is connected, the office confirms the payment
          from Admire&rsquo;s records. Your card details never pass through this site.
        </p>
      </div>
    </section>
  );
}

export default function SponsorForm({
  itemId,
  amount,
  itemIds,
  admireCampaignId,
  onReservationCreated,
}: SponsorFormProps) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [names, setNames] = useState<string[]>([""]);
  const [dedicationType, setDedicationType] = useState<"none" | "honor" | "memory">("none");
  const [dedicationName, setDedicationName] = useState("");
  const [dedicationMessage, setDedicationMessage] = useState("");
  const [honoreeEmail, setHonoreeEmail] = useState("");
  const [publicRecognition, setPublicRecognition] = useState(false);
  const [recognitionName, setRecognitionName] = useState("");
  const [assignmentAccepted, setAssignmentAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reservation, setReservation] = useState<AdmireReservation | null>(null);
  const isCombined = Boolean(itemIds && itemIds.length > 1);
  const donorName = `${firstName.trim()} ${lastName.trim()}`.trim();

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
      const response = await fetch(withBasePath("/api/admire/reservation"), {
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
          publicRecognition,
          assignmentAccepted,
          ...(publicRecognition
            ? { recognitionName: recognitionName.trim() || donorName }
            : {}),
        }),
      });
      const body = (await response.json()) as Partial<AdmireReservation> & {
        error?: { message?: string };
      };
      if (
        !response.ok ||
        !body.pledgeId ||
        !body.reference ||
        !body.expiresAt ||
        typeof body.amount !== "number"
      ) {
        throw new Error(body.error?.message || "The Admire reservation could not be created.");
      }
      const nextReservation: AdmireReservation = {
        pledgeId: body.pledgeId,
        reference: body.reference,
        expiresAt: body.expiresAt,
        amount: body.amount,
      };
      setReservation(nextReservation);
      onReservationCreated?.(nextReservation.expiresAt);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  if (reservation) {
    return (
      <AdmirePayment
        reservation={reservation}
        firstName={firstName}
        lastName={lastName}
        email={email}
        phone={phone}
        campaignId={admireCampaignId}
        combined={isCombined}
      />
    );
  }

  return (
    <form onSubmit={onSubmit} aria-busy={submitting}>
      <div className="campaign-notice">
        Your {isCombined ? "kibbudim are" : "kibbud is"} reserved while you enter the
        sponsorship details. The next step is a secure Admire payment for <strong>{usd(amount)}</strong>.
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
        <input id="email" type="email" className="input" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="For your Admire receipt and confirmation" autoComplete="email" />
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
        <div className="hint">Hebrew is welcome here. The gabbai reads these names exactly as written.</div>
      </div>

      <fieldset className="form-section">
        <legend className="field-label">Dedication <span className="label-optional">optional</span></legend>
        <div className="segmented-control">
          {([ ["none", "No dedication"], ["honor", "In honor of"], ["memory", "In memory of"] ] as const).map(([value, label]) => (
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
              <input id="honoree-email" type="email" className="input" value={honoreeEmail} onChange={(event) => setHonoreeEmail(event.target.value)} placeholder="We can notify the honoree or family after confirmation" autoComplete="off" />
            </div>
          </div>
        ) : null}
      </fieldset>

      <div className="recognition-option">
        <label>
          <input type="checkbox" checked={publicRecognition} onChange={(event) => setPublicRecognition(event.target.checked)} />
          <span><strong>List this sponsorship on the public recognition page</strong><small>Your email and Mi Shebeirach names are never displayed.</small></span>
        </label>
        {publicRecognition ? (
          <div className="field">
            <label htmlFor="recognition-name">Display name</label>
            <input id="recognition-name" className="input" value={recognitionName} onChange={(event) => setRecognitionName(event.target.value)} placeholder={donorName || "Family or sponsor name"} />
          </div>
        ) : null}
      </div>

      <div className="assignment-disclosure">
        <p><strong>Aliyah assignment:</strong> All aliyos are assigned to Roshei Yeshiva, Rabbanim, and congregants at the Yeshiva&rsquo;s discretion. Purchasing this sponsorship does not guarantee that you will personally receive the aliyah. What is guaranteed is that a Mi Shebeirach will be recited for the person or persons you name.</p>
        <label><input type="checkbox" required checked={assignmentAccepted} onChange={(event) => setAssignmentAccepted(event.target.checked)} /><span>I understand and agree.</span></label>
      </div>

      <button type="submit" className="btn btn--fill btn--block" disabled={submitting}>
        {submitting ? "Creating your reservation…" : "Continue to secure Admire payment"}
      </button>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <p className="fineprint">Admire securely collects and processes your credit-card information. Raw card details never pass through or remain on this website.</p>
    </form>
  );
}
