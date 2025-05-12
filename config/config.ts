import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'your-secret-key',
  database: {
    url: process.env.DATABASE_URL || 'mongodb://localhost:27017/your-database',
  },
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
  },
  masterPassword: process.env.MASTER_PASSWORD,
  agora: {
    appId: process.env.AGORA_APP_ID,
    certificate: process.env.AGORA_APP_CERTIFICATE,
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
  },
}; 