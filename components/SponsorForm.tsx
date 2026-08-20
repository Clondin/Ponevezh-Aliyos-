"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Method = "ach" | "card" | "wire";

const PAY_OPTIONS: {
  id: Method;
  title: string;
  desc: string;
  preferred?: boolean;
}[] = [
  {
    id: "ach",
    title: "Bank transfer (ACH)",
    desc: "Direct from your U.S. bank account. More of your gift reaches the yeshiva.",
    preferred: true,
  },
  {
    id: "card",
    title: "Credit or debit card",
    desc: "All major cards accepted.",
  },
  {
    id: "wire",
    title: "Reserve and pay by wire",
    desc: "Hold this kibbud for 72 hours while you arrange a wire or check with the office.",
  },
];

/**
 * Donor details + payment choice. Builds entirely against fixtures:
 * submission routes to the confirmation screen with no network call.
 * At integration this posts to /api/checkout or /api/pledge per
 * contracts/api.md and follows the returned Stripe URL.
 */
export default function SponsorForm({ itemId }: { itemId: string }) {
  const router = useRouter();
  const [donorName, setDonorName] = useState("");
  const [email, setEmail] = useState("");
  const [names, setNames] = useState<string[]>([""]);
  const [method, setMethod] = useState<Method>("ach");
  const [submitting, setSubmitting] = useState(false);

  const setName = (i: number, v: string) =>
    setNames((ns) => ns.map((n, j) => (j === i ? v : n)));
  const addName = () => setNames((ns) => [...ns, ""]);
  const removeName = (i: number) =>
    setNames((ns) => (ns.length > 1 ? ns.filter((_, j) => j !== i) : ns));

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const params = new URLSearchParams({ item: itemId, method, donor: donorName });
    router.push(`/confirmation?${params.toString()}`);
  };

  return (
    <form onSubmit={onSubmit}>
      <div className="field">
        <label htmlFor="donor">Your name</label>
        <input
          id="donor"
          className="input"
          required
          value={donorName}
          onChange={(e) => setDonorName(e.target.value)}
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
          onChange={(e) => setEmail(e.target.value)}
          placeholder="For your receipt and confirmation"
          autoComplete="email"
        />
      </div>

      <div className="field field--names">
        <span className="field-label">Names for the Mi Shebeirach</span>
        <div className="name-rows">
          {names.map((n, i) => (
            <div className="name-row" key={i}>
              <input
                className="input input--hebrew"
                dir="rtl"
                lang="he"
                value={n}
                onChange={(e) => setName(i, e.target.value)}
                placeholder="פלוני בן פלונית"
                aria-label={`Name ${i + 1}`}
              />
              {names.length > 1 && (
                <button
                  type="button"
                  className="name-row__remove"
                  onClick={() => removeName(i)}
                  aria-label={`Remove name ${i + 1}`}
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
        {PAY_OPTIONS.map((p) => (
          <label
            key={p.id}
            className={`pay-option${method === p.id ? " pay-option--selected" : ""}`}
          >
            <input
              type="radio"
              name="method"
              value={p.id}
              checked={method === p.id}
              onChange={() => setMethod(p.id)}
            />
            <span className="pay-option__dot" aria-hidden="true" />
            <span>
              <span className="pay-option__title">
                {p.title}
                {p.preferred && <span className="pay-option__badge">Preferred</span>}
              </span>
              <span className="pay-option__desc">{p.desc}</span>
            </span>
          </label>
        ))}
      </div>

      <button type="submit" className="btn btn--fill btn--block" disabled={submitting}>
        {method === "wire" ? "Reserve this kibbud" : "Continue to secure payment"}
      </button>
      <p className="fineprint">
        Processed by American Friends of Ponevez Yeshiva in Israel, Inc., a
        501(c)(3) organization.
      </p>
    </form>
  );
}
