"use client";

import { useEffect, useState } from "react";

export default function ShareActions({ title, text }: { title: string; text: string }) {
  const [copied, setCopied] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  useEffect(() => setShareUrl(window.location.href), []);
  async function share() {
    if (navigator.share) {
      await navigator.share({ title, text, url: shareUrl }).catch(() => undefined);
      return;
    }
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
  }
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(`${text} ${shareUrl}`)}`;
  return <div className="share-actions no-print"><button type="button" className="btn btn--sm btn--outline-bronze" onClick={() => void share()} disabled={!shareUrl}>{copied ? "Link copied" : "Share"}</button><a className="btn btn--sm btn--outline-bronze" href={whatsapp} target="_blank" rel="noreferrer" aria-disabled={!shareUrl}>WhatsApp</a></div>;
}
