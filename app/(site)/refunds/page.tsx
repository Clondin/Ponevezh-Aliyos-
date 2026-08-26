import type { Metadata } from "next";
import InfoPage from "@/components/InfoPage";

export const metadata: Metadata = { title: "Refunds and corrections" };
export default function RefundsPage() { return <InfoPage eyebrow="Help" title="Refunds and corrections" hebrew="החזרים ותיקונים" photo="legal-hats"><p>If you believe a payment was made in error, duplicated, or needs correction, contact the office as soon as possible at <a href="mailto:office@ponevez.com">office@ponevez.com</a> or <a href="tel:+12126759260">212-675-9260</a>.</p><p>Include your name, receipt or order number, kibbud, and payment date. Do not email a full card number or CVV.</p><p>Requests are reviewed individually. If the Yeshiva cannot provide a confirmed kibbud as described, the office will work with the sponsor on a replacement, credit, or refund as appropriate.</p></InfoPage>; }
