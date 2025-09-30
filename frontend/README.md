# Drawn of War - Frontend

React-based frontend application for Drawn of War creature creation and battle game.

## Overview

The frontend provides the user interface for:
- Creating creatures through text descriptions
- Viewing generation progress in real-time
- Managing creature collections
- Engaging in turn-based battles
- Viewing battle replays and statistics

## Tech Stack

- **React 18** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **React Router** - Client-side routing
- **Zustand** - State management
- **React Query** - Server state management
- **Socket.IO Client** - Real-time WebSocket communication
- **Axios** - HTTP client

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- pnpm >= 8.0.0

### Installation

From the root of the monorepo:

```bash
pnpm install
```

### Environment Variables

Create a `.env.local` file in the `frontend` directory:

```bash
cp .env.example .env.local
```

Required variables:
- `VITE_API_URL` - Backend API URL (default: `http://localhost:3001`)
- `VITE_WS_URL` - WebSocket URL (default: `ws://localhost:3001`)

Optional variables:
- `VITE_FEATURE_FLAG_ENABLE_ANIMATIONS` - Enable animations feature
- `VITE_FEATURE_FLAG_ENABLE_BATTLES` - Enable battles feature
- Firebase configuration variables (see `.env.example`)

### Development

```bash
# From root directory
pnpm dev:frontend

# Or from frontend directory
pnpm dev
```

The application will be available at `http://localhost:5173`

### Building

```bash
# From root directory
pnpm build:frontend

# Or from frontend directory
pnpm build
```

Build output will be in the `dist` directory.

### Preview Production Build

```bash
pnpm preview
```

## Project Structure

```
frontend/
├── src/
│   ├── components/        # Reusable React components
│   │   ├── common/       # Generic UI components
│   │   ├── creature/     # Creature-related components
│   │   ├── battle/       # Battle-related components
│   │   └── layout/       # Layout components
│   ├── pages/            # Page-level components
│   │   ├── Home/
│   │   ├── Create/
│   │   ├── Collection/
│   │   └── Battle/
│   ├── services/         # API and WebSocket clients
│   │   ├── api.ts        # Axios configuration
│   │   ├── creatures.ts  # Creature API calls
│   │   ├── battles.ts    # Battle API calls
│   │   └── socket.ts     # Socket.IO client
│   ├── stores/           # Zustand state stores
│   │   ├── useCreatureStore.ts
│   │   ├── useBattleStore.ts
│   │   └── useUIStore.ts
│   ├── hooks/            # Custom React hooks
│   │   ├── useCreature.ts
│   │   ├── useBattle.ts
│   │   └── useWebSocket.ts
│   ├── types/            # TypeScript type definitions
│   ├── utils/            # Utility functions
│   ├── assets/           # Static assets (images, fonts)
│   ├── styles/           # Global styles
│   ├── App.tsx           # Root component
│   └── main.tsx          # Application entry point
├── public/               # Static public assets
├── index.html            # HTML entry point
├── vite.config.ts        # Vite configuration
├── tsconfig.json         # TypeScript configuration
└── package.json          # Package dependencies
```

## Key Features

### Creature Creation Flow

1. User enters text description
2. Request sent to backend API
3. WebSocket connection established for progress updates
4. Real-time progress updates displayed
5. Generated creature displayed on completion

### Battle System

1. Select two creatures from collection
2. Initialize battle through API
3. WebSocket connection for real-time battle events
4. Turn-based combat with animations
5. Battle results and statistics

### State Management

- **Zustand** for client state (UI, selected creatures)
- **React Query** for server state (creatures, battles)
- **Socket.IO** for real-time updates

## API Integration

### REST API

All API calls go through the centralized `api.ts` service:

```typescript
import api from '@/services/api';

// Example: Create creature
const response = await api.post('/creatures', {
  description: 'A fierce dragon',
  size: 64
});
```

### WebSocket

WebSocket connections are managed through the `socket.ts` service:

```typescript
import { socket } from '@/services/socket';

// Listen for generation progress
socket.on('generation:progress', (data) => {
  console.log('Progress:', data.progress);
});
```

## Available Scripts

- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm preview` - Preview production build
- `pnpm lint` - Run ESLint
- `pnpm lint:fix` - Fix ESLint errors
- `pnpm type-check` - Run TypeScript type checking
- `pnpm clean` - Clean build artifacts

## Code Style

This project uses:
- **ESLint** for code linting
- **Prettier** for code formatting
- **TypeScript strict mode** for type safety

Run linting and formatting:
```bash
pnpm lint
pnpm format
```

## Performance Considerations

- Code splitting with React lazy loading
- Vendor chunk separation in Vite config
- Image optimization for creature assets
- React Query caching for API responses
- WebSocket connection pooling

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)

## Troubleshooting

### Connection Issues

If WebSocket connections fail:
1. Check backend is running on port 3001
2. Verify `VITE_WS_URL` in `.env.local`
3. Check browser console for connection errors

### Build Errors

If build fails:
1. Clear cache: `rm -rf node_modules/.vite`
2. Reinstall dependencies: `pnpm install`
3. Check TypeScript errors: `pnpm type-check`

## Contributing

Follow the project's documentation-driven development approach. See `/docs` in the root directory for specifications and design decisions.