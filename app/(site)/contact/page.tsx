import type { Metadata } from "next";
import InfoPage from "@/components/InfoPage";

export const metadata: Metadata = { title: "Contact" };
export default function ContactPage() { return <InfoPage eyebrow="Help" title="Contact the Ponevez office" hebrew="צרו קשר" photo="contact-lobby"><p>Need help with a kibbud, name, payment, or receipt?</p><div className="contact-card"><strong>American Friends of Ponevez Yeshiva in Israel, Inc.</strong><p>1133 Broadway, Suite 519<br />New York, NY 10010</p><p><a href="tel:+12126759260">212-675-9260</a><br /><a href="mailto:office@ponevez.com">office@ponevez.com</a></p></div><p>Include your kibbud and payment reference when possible. Never email card numbers.</p></InfoPage>; }
