import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  // The certificate PDF route reads its fonts from disk at request time; make sure the font
  // files ship with that serverless function (keys are route globs, values project paths).
  outputFileTracingIncludes: {
    '/api/certificates/**': ['./src/assets/fonts/*.ttf'],
  },
};

export default nextConfig;