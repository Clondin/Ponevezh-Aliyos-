import Link from "next/link";
import React from "react";
import type { Metadata } from "next";
import { getMinyan, getOccasion } from "@/lib/catalog";
import { currentKibbud, currentPrice } from "@/lib/calendar/current";
import { kibbudHe } from "@/lib/hebrew";
import { usd } from "@/lib/format";
import { getRepository } from "@/lib/storage/repository";
import { emailRecord } from "@/lib/notifications/email";
import PhotoBand from "@/components/PhotoBand";
import PrintButton from "@/components/PrintButton";

export const metadata: Metadata = { title: "Confirmation", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function ConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<{
    item?: string;
    method?: string;
    key?: string;
    pledge?: string;
  }>;
}) {
  const { item: itemId, method, key, pledge: pledgeId } = await searchParams;
  const item = itemId ? currentKibbud(itemId) : undefined;
  const m = item ? getMinyan(item.minyan) : undefined;
  const o = item ? getOccasion(item.occasion) : undefined;
  const isWire = method === "wire";
  const repository = getRepository();
  const [checkoutCandidate, pledgeCandidate] = await Promise.all([
    key ? repository.checkout(key) : Promise.resolve(null),
    pledgeId ? repository.pledge(pledgeId) : Promise.resolve(null),
  ]);
  const checkout = checkoutCandidate?.kibbudId === itemId ? checkoutCandidate : null;
  const pledge = pledgeCandidate?.kibbudId === itemId ? pledgeCandidate : null;
  const orderCandidate = checkout?.status === "sold" && itemId
    ? await repository.orderFor(itemId)
    : null;
  const order = orderCandidate &&
    (orderCandidate.paymentId === key || orderCandidate.id === `ord_${key}`)
      ? orderCandidate
      : null;
  const accessValid = isWire ? Boolean(pledge) : Boolean(checkout);
  const delivery = order
    ? await emailRecord(`order-confirmation-${order.id}`)
    : pledge
      ? await emailRecord(`pledge-donor-${pledge.id}`)
      : null;
  const pending = checkout?.status === "created" || checkout?.status === "pending";
  const unsuccessful = checkout?.status === "released" || checkout?.status === "reversed";
  const donor = order?.donorName ?? checkout?.donorName ?? pledge?.donorName;
  const amount = order?.amount ?? checkout?.amount ?? pledge?.amount ??
    (item ? currentPrice(item) : 0);

  return (
    <div className="confirm">
      <div className="confirm__glyph" aria-hidden="true">
        ✳
      </div>
      <h1>
        {!accessValid
          ? "Confirmation unavailable"
          : isWire
          ? "Your kibbud is reserved"
          : unsuccessful
            ? "Payment not completed"
            : pending
              ? "Payment submitted"
              : "Thank you"}
      </h1>

      {accessValid && !pending && !unsuccessful ? (
        <PhotoBand photo="confirm-aron" slim />
      ) : null}

      {item && m && o && accessValid && (
        <div className="receipt">
          <div className="receipt__he" lang="he">
            {kibbudHe(item.slug, item.name)}
          </div>
          <div className="receipt__name">{item.name}</div>
          <div className="receipt__where">
            {o.name} &middot; {m.name} Minyan
          </div>
          <div className="receipt__split">
            <span className="receipt__date">{o.dateLabel}</span>
            <span className="receipt__price">{usd(amount)}</span>
          </div>
          {donor && <div className="receipt__donor">Sponsored by {donor}</div>}
          {(order?.dedicationType ?? pledge?.dedicationType) &&
          (order?.dedicationName ?? pledge?.dedicationName) ? (
            <div className="receipt__dedication">
              {(order?.dedicationType ?? pledge?.dedicationType) === "memory"
                ? "In memory of "
                : "In honor of "}
              {order?.dedicationName ?? pledge?.dedicationName}
            </div>
          ) : null}
        </div>
      )}

      <p className="confirm__body">
        {!accessValid
          ? "This confirmation link is incomplete or has expired. No donor information is shown."
          : isWire
          ? delivery?.status === "sent"
            ? "The kibbud is held for you for 72 hours. Payment instructions were emailed to the address you provided."
            : "The kibbud is held for 72 hours. We will email payment instructions shortly."
          : unsuccessful
            ? "Your payment was not completed. The kibbud is available again."
            : pending
              ? "Your payment is being confirmed."
              : delivery?.status === "sent"
                ? "Your receipt was emailed. The names you entered will be read at the Mi Shebeirach."
                : "Your sponsorship is confirmed. Your receipt will be emailed, and the names you entered will be read at the Mi Shebeirach."}
      </p>
      <p className="confirm__note">
        {!accessValid
          ? "Return to the kibbudim list or contact the office."
          : isWire
          ? "If payment does not arrive within 72 hours, the kibbud is released."
          : pending
            ? "We will email your receipt after confirmation."
            : "No goods or services were provided in exchange for this contribution."}
      </p>

      <div className="actions">
        {accessValid && !pending && !unsuccessful ? <PrintButton label="Print receipt" /> : null}
        <Link href={m ? `/${m.slug}` : "/"} className="btn btn--fill">
          Sponsor another
        </Link>
        <Link href="/" className="btn btn--outline">
          Home
        </Link>
      </div>
    </div>
  );
}
