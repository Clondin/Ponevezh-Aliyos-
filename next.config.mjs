import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

initOpenNextCloudflareForDev();

const nextConfig = {
  basePath: "/high-holidays",
  poweredByHeader: false,
  async redirects() {
    return [
      {
        source: "/",
        destination: "/high-holidays",
        permanent: false,
        basePath: false,
      },
      {
        source: "/kibbudim",
        destination: "/high-holidays",
        permanent: true,
        basePath: false,
      },
      {
        source: "/kibbudim/:path*",
        destination: "/high-holidays/:path*",
        permanent: true,
        basePath: false,
      },
    ];
  },
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(self), usb=()" },
        { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
      ],
    }];
  },
};

export default nextConfig;
