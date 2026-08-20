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
}: {
  expiresAt: string;
  itemId: string;
}) {
  const secs = useCountdown(expiresAt);
  const router = useRouter();

  useEffect(() => {
    if (secs !== null && secs <= 0) {
      router.replace(`/expired?item=${encodeURIComponent(itemId)}`);
    }
  }, [secs, router, itemId]);

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
      <div className="hold-banner__clock" aria-live="polite">
        {secs === null ? "12:00" : formatSecs(secs)}
      </div>
    </div>
  );
}
