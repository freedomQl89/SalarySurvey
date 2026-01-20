declare namespace NodeJS {
  interface ProcessEnv {
    DATABASE_URL: string;
    RECAPTCHA_SECRET_KEY: string;
    TOKEN_SECRET_KEY: string,
    ALLOWED_ORIGINS?: string;
    NODE_ENV: 'development' | 'production' | 'test';
  }
}