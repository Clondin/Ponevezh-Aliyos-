"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { formatSecs, useCountdown } from "@/components/Countdown";

/**
 * The 12-minute checkout hold. Reads expiresAt from state and routes to the
 * expired notice when it runs out.
 */
export default function HoldBanner({
  expiresAt,
  itemId,
  expiredHref,
}: {
  expiresAt: string;
  itemId: string;
  expiredHref?: string;
}) {
  const secs = useCountdown(expiresAt);
  const router = useRouter();

  useEffect(() => {
    if (secs !== null && secs <= 0) {
      router.replace(expiredHref ?? `/expired?item=${encodeURIComponent(itemId)}`);
    }
  }, [expiredHref, secs, router, itemId]);

  return (
    <div className="hold-banner" role="status">
      <div>
        <div className="hold-banner__lead">
          This kibbud is held for you while you complete the details below.
        </div>
        <div className="hold-banner__sub">
          If the time runs out, it is released for others.
        </div>
      </div>
      <div
        className="hold-banner__clock"
        aria-label={
          secs === null
            ? "Hold time remaining"
            : `${Math.ceil(secs / 60)} minutes remaining`
        }
      >
        {secs === null ? "–:––" : formatSecs(secs)}
      </div>
    </div>
  );
}
