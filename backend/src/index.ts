/**
 * Drawn of War - Backend Server
 *
 * Express API server for creature generation with multi-modal inputs.
 * Supports text descriptions, canvas drawings, and image uploads.
 * Includes Socket.IO for real-time combat updates.
 */

import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { generateRouter } from './api/routes/generate.routes.js';
import libraryAnimationsRouter from './api/routes/library-animations.routes.js';
import { viewAngleTestRouter } from './api/routes/view-angle-test.routes.js';
import { deploymentRouter } from './api/routes/deployment.routes.js';
import creatureSpritesRouter from './api/routes/creature-sprites.routes.js';
import { combatRouter } from './api/routes/combat.routes.js';
import { validateClaudeConfig } from './config/claude.config.js';
import { initializeCombatSocket } from './sockets/combat-socket.js';
import { initializeDeploymentSocket } from './sockets/deployment-socket.js';

// Load environment variables
dotenv.config();

const app: Express = express();
const PORT = process.env['PORT'] || 3001;
const HOST = process.env['HOST'] || 'localhost';

// Security middleware
app.use(helmet());

// CORS configuration - allow multiple frontend ports for development
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost:5176',
  process.env['FRONTEND_URL']
].filter(Boolean);

const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: '10mb' })); // For base64 images
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API routes
app.use('/api', generateRouter);
app.use('/api/library-animations', libraryAnimationsRouter);
app.use('/api/test', viewAngleTestRouter);
app.use('/api/deployment', deploymentRouter);
app.use('/api/creatures', creatureSpritesRouter);
app.use('/api/combat', combatRouter);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.path}`,
    path: req.path
  });
});

// Error handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[Server Error]', err);

  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    error: err.name || 'Error',
    message,
    ...(process.env['NODE_ENV'] === 'development' && { stack: err.stack })
  });
});

// Start server
async function startServer() {
  try {
    // Validate Claude configuration on startup
    console.log('[Startup] Validating Claude API configuration...');
    validateClaudeConfig();

    // Create HTTP server (needed for Socket.IO)
    const httpServer = createServer(app);

    // Initialize Socket.IO for combat
    console.log('[Startup] Initializing Socket.IO for combat...');
    initializeCombatSocket(httpServer);

    // Initialize Socket.IO for deployment
    console.log('[Startup] Initializing Socket.IO for deployment...');
    initializeDeploymentSocket(httpServer);

    // Start listening
    httpServer.listen(PORT, () => {
      console.log(`[Server] Drawn of War backend running`);
      console.log(`[Server] URL: http://${HOST}:${PORT}`);
      console.log(`[Server] WebSocket: ws://${HOST}:${PORT}`);
      console.log(`[Server] Environment: ${process.env['NODE_ENV'] || 'development'}`);
      console.log(`[Server] Health check: http://${HOST}:${PORT}/health`);
    });
  } catch (error) {
    console.error('[Startup] Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('[Server] SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[Server] SIGINT received, shutting down gracefully...');
  process.exit(0);
});

// Start the server
startServer();

export { app };
