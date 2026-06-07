/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@law-ai/shared'],
  // Expose BE URL to client via NEXT_PUBLIC_*
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000',
  },
  experimental: {
    // Allow server actions on more routes if needed
  },
  output: 'standalone',
};

export default nextConfig;
