// Detect production vs development based on hostname
const isProduction =
  typeof window !== 'undefined' &&
  (window.location.hostname.includes('railway.app') ||
    window.location.hostname.includes('ilaw.io.vn') ||
    window.location.hostname.includes('vercel.app'));

// On server-side (during build), default to production URLs
// On client-side, detect from hostname
const PRODUCTION_API_URL = 'https://law-aibackend-production.up.railway.app';
const PRODUCTION_APP_URL = 'https://law-aifrontend-production.up.railway.app';

export const env = {
  // API URL - prefer env var, fallback to production (NOT localhost)
  apiUrl:
    process.env.NEXT_PUBLIC_API_URL ||
    (isProduction ? PRODUCTION_API_URL : 'http://localhost:4000'),

  // App URL
  appUrl:
    process.env.NEXT_PUBLIC_APP_URL ||
    (isProduction ? PRODUCTION_APP_URL : 'http://localhost:3000'),

  // NextAuth
  nextAuthSecret: process.env.NEXTAUTH_SECRET || '',
  nextAuthUrl:
    process.env.NEXTAUTH_URL ||
    (isProduction ? PRODUCTION_APP_URL : 'http://localhost:3000'),
} as const;
