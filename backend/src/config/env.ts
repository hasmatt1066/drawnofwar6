/**
 * Environment variable validation and configuration module
 * Validates all required environment variables at startup using Zod
 * Provides type-safe access to configuration throughout the application
 */

import { z } from 'zod';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

/**
 * Environment variable schema definition
 * All required variables must be present, optional ones have defaults
 */
const envSchema = z.object({
  // Node Environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Server Configuration
  PORT: z.string().transform(Number).pipe(z.number().positive()).default('3001'),
  HOST: z.string().default('localhost'),

  // Frontend URL (for CORS)
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),
  ALLOWED_ORIGINS: z
    .string()
    .optional()
    .transform((val) => (val ? val.split(',').map((s) => s.trim()) : [])),

  // PixelLab API Configuration
  PIXELLAB_API_KEY: z.string().min(1, 'PixelLab API key is required'),
  PIXELLAB_API_URL: z.string().url().default('https://api.pixellab.ai/v1'),

  // Redis Configuration
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.string().transform(Number).pipe(z.number().positive()).default('6379'),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.string().transform(Number).pipe(z.number().nonnegative()).default('0'),

  // Firebase Admin SDK Configuration
  FIREBASE_PROJECT_ID: z.string().min(1, 'Firebase project ID is required'),
  FIREBASE_PRIVATE_KEY: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: z.string().email().optional(),
  FIREBASE_DATABASE_URL: z.string().url().optional(),
  USE_FIREBASE_EMULATOR: z
    .string()
    .optional()
    .transform((val) => val === 'true')
    .default('false'),

  // Queue Configuration
  MAX_QUEUE_SIZE: z.string().transform(Number).pipe(z.number().positive()).default('500'),
  QUEUE_WARNING_THRESHOLD: z.string().transform(Number).pipe(z.number().positive()).default('400'),
  USER_CONCURRENCY_LIMIT: z.string().transform(Number).pipe(z.number().positive()).default('5'),

  // Cache Configuration
  CACHE_TTL_DAYS: z.string().transform(Number).pipe(z.number().positive()).default('30'),
  DEDUPLICATION_WINDOW_MS: z.string().transform(Number).pipe(z.number().positive()).default('10000'),

  // Timeout Configuration (in milliseconds)
  TIMEOUT_16PX: z.string().transform(Number).pipe(z.number().positive()).default('300000'),
  TIMEOUT_32PX: z.string().transform(Number).pipe(z.number().positive()).default('480000'),
  TIMEOUT_48PX: z.string().transform(Number).pipe(z.number().positive()).default('600000'),
  TIMEOUT_64PX: z.string().transform(Number).pipe(z.number().positive()).default('720000'),
  TIMEOUT_128PX: z.string().transform(Number).pipe(z.number().positive()).default('900000'),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).pipe(z.number().positive()).default('60000'),
  RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).pipe(z.number().positive()).default('100'),

  // Feature Flags
  FEATURE_FLAG_ENABLE_ANIMATIONS: z
    .string()
    .optional()
    .transform((val) => val === 'true')
    .default('true'),
  FEATURE_FLAG_ENABLE_BATTLES: z
    .string()
    .optional()
    .transform((val) => val === 'true')
    .default('true'),
  FEATURE_FLAG_ENABLE_CACHE_WARM_UP: z
    .string()
    .optional()
    .transform((val) => val === 'true')
    .default('false'),

  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  LOG_FORMAT: z.enum(['json', 'pretty']).default('json'),
});

/**
 * Validated environment configuration
 * Exported as a const to ensure immutability
 */
export type EnvConfig = z.infer<typeof envSchema>;

/**
 * Parse and validate environment variables
 * Throws an error if validation fails with detailed error messages
 */
function validateEnv(): EnvConfig {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('❌ Environment variable validation failed:');
    console.error(JSON.stringify(result.error.format(), null, 2));
    throw new Error('Invalid environment configuration');
  }

  return result.data;
}

// Validate and export configuration
export const env = validateEnv();

/**
 * Derived configurations
 * Computed from validated environment variables
 */

// Timeout map for different image sizes
export const TIMEOUT_MAP: Record<number, number> = {
  16: env.TIMEOUT_16PX,
  32: env.TIMEOUT_32PX,
  48: env.TIMEOUT_48PX,
  64: env.TIMEOUT_64PX,
  128: env.TIMEOUT_128PX,
};

// CORS configuration
export const CORS_OPTIONS = {
  origin: [env.FRONTEND_URL, ...env.ALLOWED_ORIGINS],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

// Redis connection configuration
export const REDIS_CONFIG = {
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD,
  db: env.REDIS_DB,
};

// Queue configuration
export const QUEUE_CONFIG = {
  MAX_JOBS: env.MAX_QUEUE_SIZE,
  WARNING_THRESHOLD: env.QUEUE_WARNING_THRESHOLD,
  USER_CONCURRENCY_LIMIT: env.USER_CONCURRENCY_LIMIT,
  CACHE_TTL_DAYS: env.CACHE_TTL_DAYS,
  DEDUPLICATION_WINDOW_MS: env.DEDUPLICATION_WINDOW_MS,
};

// Feature flags
export const FEATURE_FLAGS = {
  ENABLE_ANIMATIONS: env.FEATURE_FLAG_ENABLE_ANIMATIONS,
  ENABLE_BATTLES: env.FEATURE_FLAG_ENABLE_BATTLES,
  ENABLE_CACHE_WARM_UP: env.FEATURE_FLAG_ENABLE_CACHE_WARM_UP,
};

// Log startup configuration (redact sensitive values)
if (env.NODE_ENV === 'development') {
  console.log('🔧 Environment Configuration:');
  console.log(`  NODE_ENV: ${env.NODE_ENV}`);
  console.log(`  PORT: ${env.PORT}`);
  console.log(`  REDIS_HOST: ${env.REDIS_HOST}:${env.REDIS_PORT}`);
  console.log(`  FRONTEND_URL: ${env.FRONTEND_URL}`);
  console.log(`  USE_FIREBASE_EMULATOR: ${env.USE_FIREBASE_EMULATOR}`);
  console.log(`  PIXELLAB_API_KEY: ${env.PIXELLAB_API_KEY.substring(0, 10)}...`);
  console.log(`  Feature Flags: ${JSON.stringify(FEATURE_FLAGS)}`);
}