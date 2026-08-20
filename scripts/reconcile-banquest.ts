export {};

const siteUrl = process.env.SITE_URL?.trim();
const adminToken = process.env.ADMIN_TOKEN?.trim();

if (!siteUrl || !adminToken) {
  throw new Error("SITE_URL and ADMIN_TOKEN are required for reconciliation");
}

const response = await fetch(new URL("/api/admin/reconcile-banquest", siteUrl), {
  method: "POST",
  headers: { "x-admin-token": adminToken },
});
const result = (await response.json()) as unknown;
if (!response.ok) {
  throw new Error(`Banquest reconciliation failed (${response.status}): ${JSON.stringify(result)}`);
}

console.log("Banquest reconciliation complete:", result);
