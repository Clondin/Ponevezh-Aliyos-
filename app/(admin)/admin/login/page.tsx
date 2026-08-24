import type { Metadata } from "next";

export const metadata: Metadata = { title: "Office login" };

export default async function AdminLogin({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
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
            {error ? (
              <p role="alert" style={{ color: "#9f2b2b", marginBottom: 16 }}>
                Incorrect password. Please try again.
              </p>
            ) : null}
            <button className="btn btn--primary" type="submit">
              Open admin
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
