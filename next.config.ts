import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },
  // @resvg/resvg-js is a native (.node) module used by the social renderer.
  // It can't be bundled into ESM chunks, so it must be loaded at runtime from
  // node_modules. satori is pure JS but kept external for the same code path.
  serverExternalPackages: ['@resvg/resvg-js', 'satori', 'sharp'],
  experimental: {
    serverActions: { bodySizeLimit: '10mb' },
  },
};

export default nextConfig;
