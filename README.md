# Drawn of War

AI-powered creature creation and battle game built with React, Node.js, and PixelLab API.

## Project Overview

Drawn of War is a creative game where players describe creatures using natural language, which are then generated as animated pixel art characters using AI. The core text-to-animated-sprite generation pipeline is **fully functional** and operational.

**Status**: Core generation pipeline working. Text descriptions generate 64x64 animated sprites with 4-frame walk cycles in ~27 seconds.

See `PROJECT_STATUS.md` for detailed status and `GETTING_STARTED.md` for quick setup.

## Architecture

This is a monorepo managed with pnpm workspaces, containing three packages:

- **frontend** - React + Vite web application
- **backend** - Express.js API server with WebSocket support
- **shared** - Shared TypeScript types and utilities

## Tech Stack

### Frontend
- React 18 + TypeScript
- Vite for build tooling
- Socket.IO for real-time updates
- Zustand for state management
- React Query for data fetching

### Backend
- Node.js + Express
- TypeScript
- Socket.IO for WebSocket connections
- Redis for caching and queue management
- BullMQ for job queue processing
- Firebase Admin SDK for data persistence
- Winston for logging

### Infrastructure
- pnpm workspaces for monorepo management
- Docker Compose for local development
- Firebase for authentication and storage
- Redis for caching and queues

## Prerequisites

- Node.js >= 18.0.0
- pnpm >= 8.0.0
- Docker (for Redis)
- PixelLab API key (https://pixellab.ai/)
- (Optional) Claude API key for future features

## Getting Started

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Set Up Environment Variables

#### Backend Environment
```bash
cp backend/.env.example backend/.env
# Edit backend/.env with your configuration
```

Required environment variables:
- `PIXELLAB_API_KEY` - Your PixelLab API key (required)
- `REDIS_HOST` and `REDIS_PORT` - Redis connection details (default: localhost:6379)
- `ANTHROPIC_API_KEY` - Claude API key (optional for now)

#### Frontend Environment
```bash
cp frontend/.env.example frontend/.env.local
# Edit frontend/.env.local with your configuration
```

### 3. Start Redis

```bash
# Start Redis container
docker run -d -p 6379:6379 --name redis-dev redis:alpine
```

### 4. Run Development Servers

```bash
# Start both frontend and backend in development mode
pnpm dev

# Or run them separately:
pnpm dev:frontend  # Frontend on http://localhost:5173
pnpm dev:backend   # Backend on http://localhost:3001
```

## Development

### Available Scripts

#### Root Level
- `pnpm dev` - Start all packages in development mode
- `pnpm build` - Build all packages
- `pnpm test` - Run tests in all packages
- `pnpm lint` - Lint all packages
- `pnpm format` - Format code with Prettier
- `pnpm docker:up` - Start Docker services
- `pnpm docker:down` - Stop Docker services

#### Package-Specific
- `pnpm dev:frontend` - Start frontend dev server
- `pnpm dev:backend` - Start backend dev server
- `pnpm build:frontend` - Build frontend for production
- `pnpm build:backend` - Build backend for production

### Project Structure

```
drawn-of-war/
├── backend/                # Backend API server
│   ├── src/
│   │   ├── config/        # Configuration and env validation
│   │   ├── routes/        # Express routes
│   │   ├── services/      # Business logic
│   │   ├── workers/       # Queue workers
│   │   └── index.ts       # Entry point
│   ├── package.json
│   └── tsconfig.json
├── frontend/              # React frontend
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── pages/         # Page components
│   │   ├── services/      # API clients
│   │   ├── stores/        # State management
│   │   └── main.tsx       # Entry point
│   ├── package.json
│   └── tsconfig.json
├── shared/                # Shared code
│   ├── src/
│   │   ├── types/         # TypeScript types
│   │   ├── constants/     # Shared constants
│   │   └── utils/         # Utility functions
│   ├── package.json
│   └── tsconfig.json
├── docs/                  # Documentation
│   ├── specs/            # Technical specifications
│   ├── decisions/        # Design decisions
│   └── planning/         # Planning documents
├── docker-compose.yml    # Docker services
├── package.json          # Root workspace config
└── pnpm-workspace.yaml   # pnpm workspace config
```

## Configuration

### Ports
- Frontend: `5173`
- Backend: `3001`
- Redis: `6379`
- Firebase Emulator UI: `4000`
- Firestore Emulator: `8080`

### Environment-Based CORS

The backend automatically configures CORS based on the environment:
- Development: Allows `http://localhost:5173`
- Production: Configure via `ALLOWED_ORIGINS` environment variable

### Feature Flags

Feature flags can be toggled via environment variables:
- `FEATURE_FLAG_ENABLE_ANIMATIONS` - Enable creature animations
- `FEATURE_FLAG_ENABLE_BATTLES` - Enable battle system
- `FEATURE_FLAG_ENABLE_CACHE_WARM_UP` - Enable cache warm-up on startup

## Testing

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run unit tests only
pnpm test:unit

# Run integration tests only
pnpm test:integration
```

## Building for Production

```bash
# Build all packages
pnpm build

# Build specific package
pnpm build:frontend
pnpm build:backend
```

## Documentation

Comprehensive documentation is available in the `/docs` directory:

- `/docs/specs/L0-VISION/` - Project vision and goals
- `/docs/specs/L1-THEMES/` - Major feature themes
- `/docs/specs/L2-EPICS/` - Epic-level specifications
- `/docs/specs/L3-FEATURES/` - Detailed feature specifications
- `/docs/decisions/` - Design decision records

## Contributing

This project follows a documentation-driven development approach. Please review `.claude/CLAUDE.md` for development guidelines and principles.

## License

UNLICENSED - Private project