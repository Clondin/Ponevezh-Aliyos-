import type { Metadata } from "next";
import InfoPage from "@/components/InfoPage";
import { campaignUrl } from "@/lib/seo";

export const metadata: Metadata = { title: "Refunds and corrections", alternates: { canonical: campaignUrl("/refunds") } };
export default function RefundsPage() { return <InfoPage eyebrow="Help" title="Refunds and corrections" hebrew="החזרים ותיקונים" photo="legal-hats"><p>For an incorrect or duplicate payment, contact <a href="mailto:office@ponevez.com">office@ponevez.com</a> or <a href="tel:+12126759260">+1 (212) 675-9260</a>.</p><p>Include your name, payment reference, kibbud, and payment date. Never email a card number or CVV.</p><p>The office reviews each request and will arrange a correction, replacement, credit, or refund when appropriate.</p></InfoPage>; }
