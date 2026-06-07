import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.BACKEND_PORT || '4000', 10),
  corsOrigin:
    process.env.BACKEND_CORS_ORIGIN ||
    process.env.CORS_ORIGIN ||
    'http://localhost:3000',

  database: {
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '5432', 10),
    username: process.env.DATABASE_USER || 'lawai',
    password: process.env.DATABASE_PASSWORD || 'lawai_password',
    name: process.env.DATABASE_NAME || 'law_ai',
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'change-me-in-prod',
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'change-me-in-prod-refresh',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
}));
