import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Note: large uploads (> 10 MB) bypass the rewrite via the dedicated
  // /api/upload Route Handler in src/app/api/upload/route.ts, because
  // Next.js's rewrite proxy caps request bodies at 10 MB.
  async rewrites() {
    const backend = process.env.BACKEND_URL ?? 'http://localhost:9100';
    return [
      {
        source: '/api/:path*',
        destination: `${backend}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
