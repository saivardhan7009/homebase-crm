// index.js — HomeBase CRM Express Server Entry Point
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import { env } from './src/config/env.js';
import { apiLimiter } from './src/middleware/rateLimiter.js';
import { errorHandler } from './src/middleware/errorHandler.js';

// Route Imports
import authRoutes from './src/routes/authRoutes.js';
import propertyRoutes from './src/routes/propertyRoutes.js';
import leadRoutes from './src/routes/leadRoutes.js';
import customerRoutes from './src/routes/customerRoutes.js';
import favoriteRoutes from './src/routes/favoriteRoutes.js';
import appointmentRoutes from './src/routes/appointmentRoutes.js';
import notificationRoutes from './src/routes/notificationRoutes.js';
import analyticsRoutes from './src/routes/analyticsRoutes.js';
import agentRoutes from './src/routes/agentRoutes.js';
import assistantRoutes from './src/routes/assistantRoutes.js';
import followupRoutes from './src/routes/followupRoutes.js';
import adminSecurityRoutes from './src/routes/adminSecurityRoutes.js';

const app = express();

// Security Middleware
app.use(helmet());
app.use(
  cors({
    origin: [env.clientUrl, 'http://localhost:5173', 'http://127.0.0.1:5173'],
    credentials: true,
  })
);

// Body Parsers & Request Logging
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan(env.isDev ? 'dev' : 'combined'));

// Rate Limiting
app.use('/api', apiLimiter);

// Health Check Route
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'HomeBase CRM API is healthy and running',
    timestamp: new Date().toISOString(),
    environment: env.nodeEnv,
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/properties', propertyRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/agents', agentRoutes);
app.use('/api/assistant', assistantRoutes);
app.use('/api/followups', followupRoutes);
app.use('/api/admin/security', adminSecurityRoutes);

// 404 Route Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Cannot ${req.method} ${req.originalUrl} — endpoint not found`,
  });
});

// Centralized Error Handling Middleware
app.use(errorHandler);

// Start HTTP Server
const PORT = env.port || 4000;
app.listen(PORT, () => {
  console.log(`
🚀 ===============================================
   HOMEBASE CRM — BACKEND API SERVER RUNNING
   Environment : ${env.nodeEnv}
   Port        : ${PORT}
   API URL     : http://localhost:${PORT}/api
   Health Check: http://localhost:${PORT}/api/health
==================================================
  `);
});

export default app;
