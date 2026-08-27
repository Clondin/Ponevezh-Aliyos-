import Link from "next/link";
import type { Metadata } from "next";
import CheckoutExperience from "@/components/CheckoutExperience";
import Notice from "@/components/Notice";
import { banquestPublicConfiguration } from "@/lib/banquest/client";
import { usd } from "@/lib/format";
import {
  PRODUCTION_TEST_AMOUNT,
  PRODUCTION_TEST_ITEM,
} from "@/lib/production-test";
import { getRepository } from "@/lib/storage/repository";

export const metadata: Metadata = {
  title: "Production Payment Test",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function ProductionTestPaymentPage() {
  const [status] = await getRepository().statuses([PRODUCTION_TEST_ITEM.id]);
  const banquest = banquestPublicConfiguration();
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? "";

  if (status?.state === "sold" || status?.state === "pending") {
    return (
      <Notice
        glyph="asterisk"
        title="Test payment completed"
        body="The production payment test has already been submitted. Refund it in Banquest before running it again."
        primaryHref="/ponevez-yeshiva"
        primaryLabel="Return to Ponevez Yeshiva"
        secondaryHref="/"
        secondaryLabel="All minyanim"
      />
    );
  }

  return (
    <>
      <div className="band">
        <div className="container container--narrow" style={{ padding: "40px 40px 48px" }}>
          <nav className="crumbs" aria-label="Breadcrumb" style={{ marginBottom: 44 }}>
            <Link href="/ponevez-yeshiva">Ponevez Yeshiva</Link>
            <span aria-hidden="true">/</span>
            <span className="current">Payment test</span>
          </nav>
          <div className="head-split">
            <div className="page-head">
              <div className="he he--left" lang="he">בדיקת תשלום</div>
              <h1>Production payment test</h1>
              <div className="meta">
                Runs through the live Banquest checkout and Admire feed.
              </div>
            </div>
            <div className="head-stat">
              <div className="head-stat__value">{usd(PRODUCTION_TEST_AMOUNT)}</div>
              <div className="head-stat__label">Real charge</div>
            </div>
          </div>
        </div>
      </div>

      <section className="container container--narrow" style={{ padding: "32px 40px 96px" }}>
        <CheckoutExperience
          itemId={PRODUCTION_TEST_ITEM.id}
          amount={PRODUCTION_TEST_AMOUNT}
          occasionHref="/ponevez-yeshiva"
          minyanHref="/ponevez-yeshiva"
          tokenizationKey={banquest.tokenizationKey}
          banquestEnvironment={banquest.environment}
          checkoutReady={banquest.checkoutReady}
          turnstileSiteKey={turnstileSiteKey}
          testPayment
        />
      </section>
    </>
  );
}
