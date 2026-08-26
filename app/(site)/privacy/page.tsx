import type { Metadata } from "next";
import InfoPage from "@/components/InfoPage";

export const metadata: Metadata = { title: "Privacy" };
export default function PrivacyPage() { return <InfoPage eyebrow="Legal" title="Privacy" hebrew="פרטיות"><p>We collect the details needed to manage your sponsorship: contact information, Mi Shebeirach names, optional dedication, and payment status.</p><h2>Card information</h2><p>Admire processes the payment. Card numbers and CVV codes do not pass through or remain on this website.</p><h2>How we use information</h2><p>We use it for receipts, office follow-up, gabbai sheets, and legal records. Public recognition is always optional. Email, phone, and Mi Shebeirach names are never displayed publicly.</p><h2>Service providers</h2><p>Trusted services host the site, process payments, and send email.</p><p>Questions or corrections? Email <a href="mailto:office@ponevez.com">office@ponevez.com</a>.</p></InfoPage>; }
