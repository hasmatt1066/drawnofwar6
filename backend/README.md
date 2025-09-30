# Drawn of War - Backend

Node.js backend API server for Drawn of War creature generation and battle system.

## Overview

The backend provides:
- REST API for creature creation and management
- WebSocket server for real-time updates
- Integration with PixelLab AI API for creature generation
- Redis-based job queue for async processing
- Firebase integration for data persistence
- Rate limiting and security

## Tech Stack

- **Node.js** - Runtime environment
- **Express** - Web framework
- **TypeScript** - Type safety
- **Socket.IO** - WebSocket server
- **Redis** - Cache and job queue
- **BullMQ** - Queue management
- **Firebase Admin SDK** - Data persistence
- **Zod** - Runtime validation
- **Winston** - Logging

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- pnpm >= 8.0.0
- Redis server (via Docker or local)
- PixelLab API key
- Firebase project

### Installation

From the root of the monorepo:

```bash
pnpm install
```

### Environment Variables

Create a `.env` file in the `backend` directory:

```bash
cp .env.example .env
```

Required variables:

```env
# PixelLab API
PIXELLAB_API_KEY=your-api-key-here

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Firebase
FIREBASE_PROJECT_ID=your-project-id
USE_FIREBASE_EMULATOR=true  # for local dev

# Server
PORT=3001
FRONTEND_URL=http://localhost:5173
```

See `.env.example` for complete list of configuration options.

### Start Redis

```bash
# From root directory
pnpm docker:up
```

### Development

```bash
# From root directory
pnpm dev:backend

# Or from backend directory
pnpm dev
```

The server will start on `http://localhost:3001`

### Building

```bash
# From root directory
pnpm build:backend

# Or from backend directory
pnpm build
```

Build output will be in the `dist` directory.

### Running in Production

```bash
pnpm start
```

## Project Structure

```
backend/
├── src/
│   ├── config/           # Configuration
│   │   └── env.ts        # Environment validation
│   ├── pixellab/         # ✅ PixelLab API Client (COMPLETED)
│   │   ├── animation-generator.ts    # Animation generation
│   │   ├── auth-manager.ts           # API key management
│   │   ├── balance-checker.ts        # Credit balance
│   │   ├── config-validator.ts       # Configuration validation
│   │   ├── correlation.ts            # Request correlation IDs
│   │   ├── errors.ts                 # Custom error classes
│   │   ├── http-client.ts            # HTTP client with Axios
│   │   ├── image-decoder.ts          # Base64 image decoding
│   │   ├── logger.ts                 # Structured logging
│   │   ├── metrics-tracker.ts        # Performance metrics
│   │   ├── quota-tracker.ts          # Quota monitoring
│   │   ├── rate-limiter.ts           # Token bucket rate limiting
│   │   ├── request-validator.ts      # Request validation
│   │   ├── result-builder.ts         # Result construction
│   │   ├── retry-strategy.ts         # Retry logic
│   │   ├── sprite-generator.ts       # Sprite generation
│   │   ├── status-parser.ts          # Job status parsing
│   │   ├── status-poller.ts          # Async polling
│   │   ├── test-utils/               # Test infrastructure
│   │   │   ├── fixtures.ts           # Test data
│   │   │   └── mock-server.ts        # Mock API server
│   │   └── *.test.ts                 # Comprehensive tests
│   ├── routes/           # Express routes
│   │   ├── creatures.ts  # Creature endpoints
│   │   ├── battles.ts    # Battle endpoints
│   │   └── health.ts     # Health check
│   ├── services/         # Business logic
│   │   ├── queue/        # Queue management
│   │   ├── cache/        # Redis cache
│   │   └── firebase/     # Firebase integration
│   ├── workers/          # Queue workers
│   │   └── generation.ts # Creature generation worker
│   ├── middleware/       # Express middleware
│   │   ├── auth.ts       # Authentication (post-MVP)
│   │   ├── validation.ts # Request validation
│   │   ├── rateLimit.ts  # Rate limiting
│   │   └── error.ts      # Error handling
│   ├── utils/            # Utility functions
│   ├── types/            # TypeScript types
│   ├── websocket/        # WebSocket handlers
│   │   └── index.ts      # Socket.IO setup
│   └── index.ts          # Application entry point
├── tests/                # Test files
│   ├── unit/            # Unit tests
│   └── integration/     # Integration tests
├── package.json
├── tsconfig.json
└── .env.example
```

## API Endpoints

### Creatures

#### Create Creature
```http
POST /api/creatures
Content-Type: application/json

{
  "description": "A fierce dragon with scales",
  "size": 64,
  "detail": "medium detail",
  "shading": "basic shading"
}
```

#### Get Creature
```http
GET /api/creatures/:id
```

#### List Creatures
```http
GET /api/creatures?limit=10&offset=0
```

#### Delete Creature
```http
DELETE /api/creatures/:id
```

### Queue Status

```http
GET /api/queue/status
```

### Health Check

```http
GET /health
```

## WebSocket Events

### Client → Server

- `generation:subscribe` - Subscribe to generation updates
- `battle:join` - Join a battle session
- `battle:action` - Submit battle action

### Server → Client

- `generation:progress` - Generation progress update
- `generation:complete` - Generation completed
- `generation:failed` - Generation failed
- `battle:update` - Battle state update
- `battle:end` - Battle ended

## Queue System

The backend uses BullMQ for processing creature generation jobs:

### Queue Configuration

```typescript
{
  MAX_QUEUE_SIZE: 500,
  WARNING_THRESHOLD: 400,
  USER_CONCURRENCY_LIMIT: 5,
  CACHE_TTL_DAYS: 30
}
```

### Queue Flow

1. Job submitted via API
2. Deduplicated against recent requests
3. Added to queue if under limit
4. Worker picks up job
5. Calls PixelLab API
6. Caches result in Redis
7. Persists to Firebase
8. Emits WebSocket event
9. Marks job complete

### Dead Letter Queue (DLQ)

Failed jobs are moved to DLQ for manual retry:
- Retry available to job owner or admin
- Preserves error details for debugging

## Caching Strategy

### Redis Cache

- **Eviction Policy**: LRU (Least Recently Used)
- **Max Memory**: 2GB
- **TTL**: 30 days
- **Write Strategy**: Write-through to Firebase

### Cache Keys

```
creature:{creatureId}           # Full creature data
queue:jobs                      # Active job IDs
queue:dlq                       # Failed job IDs
dedup:{hash}:{timestamp}        # Deduplication window
```

## Error Handling

### Standard Error Response

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid creature size",
    "details": { "size": "Must be 16, 32, 48, 64, or 128" }
  }
}
```

### Error Codes

- `VALIDATION_ERROR` - Invalid request data
- `QUEUE_FULL` - Queue at capacity
- `GENERATION_FAILED` - PixelLab API error
- `RATE_LIMIT_EXCEEDED` - Too many requests
- `INTERNAL_ERROR` - Server error

## Security

### Rate Limiting

- 100 requests per minute per session
- Configurable via `RATE_LIMIT_MAX_REQUESTS`

### CORS

- Configured based on `FRONTEND_URL` and `ALLOWED_ORIGINS`
- Credentials enabled for session cookies

### API Key Protection

- PixelLab API key stored in backend only
- Never exposed to client
- Logged in redacted form

## Logging

Winston logger with structured JSON output:

```typescript
logger.info('Creature generation started', {
  creatureId: '123',
  userId: 'abc',
  size: 64
});
```

### Log Levels

- `error` - Error conditions
- `warn` - Warning conditions
- `info` - Informational messages (default)
- `debug` - Debug messages

Configure via `LOG_LEVEL` environment variable.

## Monitoring

### Health Check

```bash
curl http://localhost:3001/health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2025-09-30T12:00:00.000Z",
  "uptime": 3600,
  "redis": "connected",
  "firebase": "connected"
}
```

### Metrics

Key metrics to monitor:
- Queue length
- Job processing time
- Cache hit rate
- API error rate
- WebSocket connections

## Testing

```bash
# Run all tests
pnpm test

# Run unit tests
pnpm test:unit

# Run integration tests
pnpm test:integration

# Watch mode
pnpm test:watch
```

## Available Scripts

- `pnpm dev` - Start development server with hot reload
- `pnpm build` - Build for production
- `pnpm start` - Run production build
- `pnpm lint` - Run ESLint
- `pnpm lint:fix` - Fix ESLint errors
- `pnpm type-check` - Run TypeScript type checking
- `pnpm clean` - Clean build artifacts

## Configuration

### Dynamic Timeouts

Timeouts are calculated based on image size:

```typescript
{
  16px: 5 minutes,
  32px: 8 minutes,
  48px: 10 minutes,
  64px: 12 minutes,
  128px: 15 minutes
}
```

### Feature Flags

- `FEATURE_FLAG_ENABLE_ANIMATIONS` - Enable animation generation
- `FEATURE_FLAG_ENABLE_BATTLES` - Enable battle system
- `FEATURE_FLAG_ENABLE_CACHE_WARM_UP` - Pre-warm cache on startup

## Troubleshooting

### Redis Connection Errors

```bash
# Check Redis is running
docker ps | grep redis

# Check Redis connectivity
redis-cli ping
```

### PixelLab API Errors

Check logs for:
- API key validity
- Rate limit issues
- Network connectivity

### Memory Issues

Monitor Redis memory usage:
```bash
redis-cli info memory
```

## Performance Optimization

- Connection pooling for Redis
- Request deduplication
- Efficient cache eviction (LRU)
- Background job processing
- WebSocket connection reuse

## Contributing

Follow the project's documentation-driven development approach. See `/docs` in the root directory for specifications and design decisions.

## License

UNLICENSED - Private project