import type { Metadata } from "next";
import InfoPage from "@/components/InfoPage";

export const metadata: Metadata = { title: "About Ponevez" };
export default function AboutPage() { return <InfoPage eyebrow="The Yeshiva" title="An enduring voice of Torah and Tefillah" hebrew="קול התורה והתפילה"><p>Ponevez Yeshiva inspires thousands across Eretz Yisroel and the Diaspora. Sponsoring a kibbud connects your family to the tefillos of Tishrei and supports the Yeshiva.</p><h2>About this campaign</h2><p>Each kibbud is offered once. The office and gabbaim receive the sponsor and Mi Shebeirach names.</p><p><a href="https://ponevez.com/" target="_blank" rel="noreferrer">Visit the main Ponevez Yeshiva website →</a></p></InfoPage>; }
