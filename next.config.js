const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable React strict mode for better development experience
  reactStrictMode: true,
  
  // Image optimization configuration
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        pathname: '/**',
      },
    ],
  },
  
  // Environment variables that should be available on the client
  env: {
    NEXT_PUBLIC_APP_NAME: 'KK & SONS Architectural Services EMS',
    NEXT_PUBLIC_APP_VERSION: '1.0.0',
  },
  
  // Experimental features
  experimental: {
    // Enable server actions
    serverActions: {
      allowedOrigins: ['localhost:3000'],
    },
  },
  
  // Webpack configuration for Firebase Admin SDK
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Don't include server-only modules on client
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
      };
    }
    return config;
  },
};

module.exports = withPWA(nextConfig);
