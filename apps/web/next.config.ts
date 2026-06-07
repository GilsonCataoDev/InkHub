import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  eslint: {
    // ESLint roda em CI separado — não bloqueia o build de produção
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Type-check roda em CI separado
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'https', hostname: '*.inkhub.app' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'}/:path*`,
      },
    ];
  },
};

export default nextConfig;
