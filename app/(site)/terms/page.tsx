import type { Metadata } from "next";
import InfoPage from "@/components/InfoPage";
import { campaignUrl } from "@/lib/seo";

export const metadata: Metadata = { title: "Terms", alternates: { canonical: campaignUrl("/terms") } };
export default function TermsPage() { return <InfoPage eyebrow="Legal" title="Sponsorship terms" hebrew="תנאי החסות" photo="legal-hats"><p>A kibbud is confirmed after payment is recorded and verified. A temporary reservation is not a completed sponsorship.</p><h2>Aliyah assignments</h2><p>Sponsorship does not guarantee that the purchaser will receive the aliyah. The Yeshiva assigns aliyos to Roshei Yeshiva, Rabbanim, and congregants. A Mi Shebeirach is guaranteed for the names provided.</p><p>The office or gabbaim may correct availability and tefillah details when necessary. If a kibbud cannot be provided as listed, the office will contact the sponsor.</p><p>Names and dedications are used as submitted. Please check spelling and contact the office with corrections.</p><p>Contributions are made to American Friends of Ponevez Yeshiva in Israel, Inc., EIN 13-5600414. No goods or services are provided in exchange.</p></InfoPage>; }
