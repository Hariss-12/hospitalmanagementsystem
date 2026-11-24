/**
 * Online Hospital Appointment Management System Using DFA
 * Express Application & Server
 */

const express = require('express');
const fs = require('node:fs');
const path = require('node:path');
const ENV = require('./config/env');
const { connectDB, disconnectDB, mongoose } = require('./config/db');
const {
  securityHeaders,
  corsMiddleware,
  sanitizeInputMiddleware,
} = require('./middleware/validateMiddleware');
const { apiRateLimiter } = require('./middleware/rateLimiter');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');
const { getDFADefinition } = require('./controllers/appointmentController');

const authRoutes = require('./routes/authRoutes');
const doctorRoutes = require('./routes/doctorRoutes');
const appointmentRoutes = require('./routes/appointmentRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();
let activeServer = null;
let isStarting = false;

app.use(securityHeaders);
app.use(corsMiddleware);
app.use(express.json({ limit: '256kb' }));
app.use(sanitizeInputMiddleware);
app.use('/api', apiRateLimiter);

app.get('/api/health', (_req, res) => {
  res.status(200).json({
    success: true,
    status: 'OK',
    service: 'Online Hospital Appointment Management System (DFA Engine)',
    database: {
      connected: mongoose.connection.readyState === 1,
      name: mongoose.connection.name,
    },
    dfaStates: [
      'REQUESTED',
      'CONFIRMED',
      'RESCHEDULED',
      'CANCELLED',
      'REJECTED',
      'COMPLETED',
    ],
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/dfa/definition', getDFADefinition);

app.use('/api/auth', authRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/admin', adminRoutes);

const frontendDist = path.resolve(__dirname, '..', 'frontend', 'dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get('*', (req, res, next) => {
    if (req.path === '/api' || req.path.startsWith('/api/')) {
      return next();
    }

    return res.sendFile(path.join(frontendDist, 'index.html'), (error) => {
      if (error) next(error);
    });
  });
}

app.use(notFoundHandler);
app.use(errorHandler);

async function startServer(port = ENV.PORT, options = {}) {
  if (activeServer || isStarting) {
    throw new Error('Server is already running or currently starting.');
  }

  isStarting = true;
  let server = null;

  try {
    console.log('[DATABASE] Connecting to configured database...');
    await connectDB(options);
    console.log('[DATABASE] Database connected successfully.');

    server = await new Promise((resolve, reject) => {
      const httpServer = app.listen(port, '0.0.0.0');
      httpServer.once('error', reject);
      httpServer.once('listening', () => {
        httpServer.removeListener('error', reject);
        resolve(httpServer);
      });
    });

    activeServer = server;
    const address = server.address();
    console.log(`[SERVER] Listening on 0.0.0.0:${address.port}`);
    return server;
  } catch (error) {
    console.error('[SERVER] Startup failed:', error.message);

    if (error.code === 'EADDRINUSE') {
      console.error(
        `[SERVER] Port ${port} is already in use. Stop the existing process or configure another port.`
      );
    }

    if (server && server.listening) {
      await new Promise((resolve) => server.close(resolve));
    }

    try {
      await disconnectDB();
    } catch (dbError) {
      console.error('[DATABASE] Disconnect failed:', dbError.message);
    }

    throw error;
  } finally {
    isStarting = false;
  }
}

async function shutdownServer(signal) {
  console.log(`[SERVER] Received ${signal}. Shutting down...`);

  try {
    if (activeServer) {
      await new Promise((resolve, reject) => {
        activeServer.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      });
      activeServer = null;
    }

    await disconnectDB();
    console.log('[SERVER] Shutdown completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('[SERVER] Shutdown error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  const { seedDatabase } = require('./utils/seed');

  startServer(ENV.PORT)
    .then(async (server) => {
      await seedDatabase({ forceReset: false });
      const address = server.address();
      console.log(
        `[Hospital DFA Backend] Server listening on 0.0.0.0:${address.port} (DB readyState=${mongoose.connection.readyState})`
      );
    })
    .catch((error) => {
      console.error('[SERVER] Failed to start application:', error.message);
      process.exit(1);
    });

  process.once('SIGINT', () => shutdownServer('SIGINT'));
  process.once('SIGTERM', () => shutdownServer('SIGTERM'));
}

module.exports = {
  app,
  startServer,
};
