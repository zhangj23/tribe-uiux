import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    middlewareClientMaxBodySize: '100mb',
  },
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
