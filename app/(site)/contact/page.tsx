import type { Metadata } from "next";
import InfoPage from "@/components/InfoPage";

export const metadata: Metadata = { title: "Contact" };
export default function ContactPage() { return <InfoPage eyebrow="Help" title="Contact the Ponevez office" hebrew="צרו קשר" photo="contact-lobby"><p>For help choosing a kibbud, arranging an office payment, correcting names, or asking about a receipt, contact:</p><div className="contact-card"><strong>American Friends of Ponevez Yeshiva in Israel, Inc.</strong><p>1133 Broadway, Suite 519<br />New York, NY 10010</p><p><a href="tel:+12126759260">212-675-9260</a><br /><a href="mailto:office@ponevez.com">office@ponevez.com</a></p></div><p>Please include the kibbud, minyan, tefillah, and order or reservation number when possible. Never send credit-card numbers by email.</p></InfoPage>; }
