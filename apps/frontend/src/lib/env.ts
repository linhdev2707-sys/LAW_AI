export const env = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000',
  appUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  nextAuthSecret: process.env.NEXTAUTH_SECRET || '',
  nextAuthUrl: process.env.NEXTAUTH_URL || 'http://localhost:3000',
} as const;
