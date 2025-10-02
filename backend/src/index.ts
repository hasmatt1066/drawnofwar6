/**
 * Drawn of War - Backend Server
 *
 * Express API server for creature generation with multi-modal inputs.
 * Supports text descriptions, canvas drawings, and image uploads.
 */

import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { generateRouter } from './api/routes/generate.routes.js';
import libraryAnimationsRouter from './api/routes/library-animations.routes.js';
import { validateClaudeConfig } from './config/claude.config.js';

// Load environment variables
dotenv.config();

const app: Express = express();
const PORT = process.env['PORT'] || 3001;
const HOST = process.env['HOST'] || 'localhost';

// Security middleware
app.use(helmet());

// CORS configuration
const corsOptions = {
  origin: process.env['FRONTEND_URL'] || 'http://localhost:5173',
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

    // Start listening
    app.listen(PORT, () => {
      console.log(`[Server] Drawn of War backend running`);
      console.log(`[Server] URL: http://${HOST}:${PORT}`);
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
