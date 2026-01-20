declare namespace NodeJS {
  interface ProcessEnv {
    DATABASE_URL: string;
    ALLOWED_ORIGINS?: string;
    NODE_ENV: 'development' | 'production' | 'test';
  }
}