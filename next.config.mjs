import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

initOpenNextCloudflareForDev();

// Next.js dev mode relies on eval for fast refresh; production stays strict.
const scriptEval =
  process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : "";

/** @type {import('next').NextConfig} */
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "img-src 'self' data: blob:",
  "font-src 'self' https://fonts.gstatic.com data:",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  `script-src 'self' 'unsafe-inline'${scriptEval} https://challenges.cloudflare.com https://static.cloudflareinsights.com`,
  "connect-src 'self' https://challenges.cloudflare.com https://cloudflareinsights.com",
  "frame-src https://ponevez.admirepro.app https://challenges.cloudflare.com",
  "upgrade-insecure-requests",
].join("; ");

const nextConfig = {
  basePath: "/kibbudim",
  poweredByHeader: false,
  async redirects() {
    return [{
      source: "/",
      destination: "/kibbudim",
      permanent: false,
      basePath: false,
    }];
  },
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "Content-Security-Policy", value: contentSecurityPolicy },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(self \"https://ponevez.admirepro.app\"), usb=()" },
        { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
      ],
    }];
  },
};

export default nextConfig;
