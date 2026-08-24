import type { Metadata } from "next";
import Script from "next/script";

export const metadata: Metadata = { title: "Office login" };

export default async function AdminLogin({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? "";
  return (
    <section className="admin-section">
      <div className="container" style={{ maxWidth: 520 }}>
        <div className="form-card">
          <p className="eyebrow">Ponevez office</p>
          <h1 className="admin-title">Enter the admin password</h1>
          <form action="/api/admin/login" method="post">
            <div className="field">
              <label htmlFor="password">Password</label>
              <input
                className="input"
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                autoFocus
                required
              />
            </div>
            {turnstileSiteKey ? (
              <>
                <Script
                  src="https://challenges.cloudflare.com/turnstile/v0/api.js"
                  strategy="afterInteractive"
                />
                <div
                  className="cf-turnstile turnstile-widget"
                  data-sitekey={turnstileSiteKey}
                  data-action="admin_login"
                  data-theme="light"
                />
              </>
            ) : null}
            {error ? (
              <p role="alert" style={{ color: "#9f2b2b", marginBottom: 16 }}>
                {error === "security"
                  ? "The security check failed or there were too many attempts. Please wait and try again."
                  : "Incorrect password. Please try again."}
              </p>
            ) : null}
            <button className="btn btn--fill" type="submit">
              Open admin
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
