<<<<<<< HEAD

/**
 * Online Hospital Appointment Management System Using DFA
 * Express Application & Server
=======
/**
 * Online Hospital Appointment Management System Using DFA — Express Application & Server
>>>>>>> ce80f239edc9e0b467abb27280f2a6646f4c47a5
 */

const express = require('express');
const fs = require('node:fs');
const path = require('node:path');
<<<<<<< HEAD

const ENV = require('./config/env');

const {
  connectDB,
  disconnectDB,
  mongoose,
} = require('./config/db');

=======
const ENV = require('./config/env');
const { connectDB, mongoose } = require('./config/db');
>>>>>>> ce80f239edc9e0b467abb27280f2a6646f4c47a5
const {
  securityHeaders,
  corsMiddleware,
  sanitizeInputMiddleware,
} = require('./middleware/validateMiddleware');
<<<<<<< HEAD

const { apiRateLimiter } = require('./middleware/rateLimiter');

const {
  notFoundHandler,
  errorHandler,
} = require('./middleware/errorHandler');

const {
  getDFADefinition,
} = require('./controllers/appointmentController');
=======
const { apiRateLimiter } = require('./middleware/rateLimiter');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');
const { getDFADefinition } = require('./controllers/appointmentController');
>>>>>>> ce80f239edc9e0b467abb27280f2a6646f4c47a5

const authRoutes = require('./routes/authRoutes');
const doctorRoutes = require('./routes/doctorRoutes');
const appointmentRoutes = require('./routes/appointmentRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();

<<<<<<< HEAD
// Prevent duplicate server startup within this module.
let activeServer = null;
let isStarting = false;

// --------------------------------------------------
// 1. Security and Parsing Middleware
// --------------------------------------------------

app.use(securityHeaders);
app.use(corsMiddleware);

app.use(express.json({
  limit: '256kb',
}));

app.use(sanitizeInputMiddleware);
app.use('/api', apiRateLimiter);

// --------------------------------------------------
// 2. Health Check Endpoint
// --------------------------------------------------

=======
// 1. Security & Parsing Middleware
app.use(securityHeaders);
app.use(corsMiddleware);
app.use(express.json({ limit: '256kb' }));
app.use(sanitizeInputMiddleware);
app.use('/api', apiRateLimiter);

// 2. Phase 1 Health-Check & Formal DFA Definition Endpoints
>>>>>>> ce80f239edc9e0b467abb27280f2a6646f4c47a5
app.get('/api/health', (_req, res) => {
  res.status(200).json({
    success: true,
    status: 'OK',
<<<<<<< HEAD

    service:
      'Online Hospital Appointment Management System (DFA Engine)',

=======
    service: 'Online Hospital Appointment Management System (DFA Engine)',
>>>>>>> ce80f239edc9e0b467abb27280f2a6646f4c47a5
    database: {
      connected: mongoose.connection.readyState === 1,
      name: mongoose.connection.name,
    },
<<<<<<< HEAD

    dfaStates: [
      'REQUESTED',
      'CONFIRMED',
      'RESCHEDULED',
      'CANCELLED',
      'REJECTED',
      'COMPLETED',
    ],

=======
    dfaStates: ['REQUESTED', 'CONFIRMED', 'RESCHEDULED', 'CANCELLED', 'REJECTED', 'COMPLETED'],
>>>>>>> ce80f239edc9e0b467abb27280f2a6646f4c47a5
    timestamp: new Date().toISOString(),
  });
});

<<<<<<< HEAD
// --------------------------------------------------
// 3. DFA Definition Endpoint
// --------------------------------------------------

app.get('/api/dfa/definition', getDFADefinition);

// --------------------------------------------------
// 4. Application Routes
// --------------------------------------------------

=======
app.get('/api/dfa/definition', getDFADefinition);

// 3. Domain Routes
>>>>>>> ce80f239edc9e0b467abb27280f2a6646f4c47a5
app.use('/api/auth', authRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/admin', adminRoutes);

<<<<<<< HEAD
// --------------------------------------------------
// 5. Serve React Frontend
// --------------------------------------------------

const frontendDist = path.resolve(
  __dirname,
  '..',
  'frontend',
  'dist'
);

if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));

  app.get('*', (req, res, next) => {
    if (
      req.path === '/api' ||
      req.path.startsWith('/api/')
    ) {
      return next();
    }

    return res.sendFile(
      path.join(frontendDist, 'index.html'),
      (error) => {
        if (error) next(error);
      }
    );
  });
}

// --------------------------------------------------
// 6. Error Handling
// --------------------------------------------------

app.use(notFoundHandler);
app.use(errorHandler);

// --------------------------------------------------
// 7. Start Server
// --------------------------------------------------

async function startServer(port = ENV.PORT, options = {}) {

  if (activeServer || isStarting) {
    throw new Error(
      'Server is already running or currently starting.'
    );
  }

  isStarting = true;

  let server = null;

  try {

    // Connect to the configured database first.
    console.log('[DATABASE] Connecting to database...');

    await connectDB(options);

    console.log('[DATABASE] Database connected successfully.');

    // Start HTTP server.
    server = await new Promise((resolve, reject) => {

      const httpServer = app.listen(
        port,
        '0.0.0.0'
      );

      const handleError = (error) => {
        reject(error);
      };

      httpServer.once('error', handleError);

      httpServer.once('listening', () => {
        httpServer.removeListener('error', handleError);
        resolve(httpServer);
      });

    });

    activeServer = server;

    const address = server.address();

    console.log(
      `[SERVER] Listening on 0.0.0.0:${address.port}`
    );

    return server;

  } catch (error) {

    console.error('[SERVER] Startup failed:', error.message);

    if (error.code === 'EADDRINUSE') {
      console.error(
        `[SERVER] Port ${port} is already in use.`
      );

      console.error(
        '[SERVER] Stop the existing process or configure another port.'
      );
    }

    if (server && server.listening) {
      await new Promise((resolve) => {
        server.close(resolve);
      });
    }

    try {
      await disconnectDB();
    } catch (dbError) {
      console.error(
        '[DATABASE] Disconnect failed:',
        dbError.message
      );
    }

    throw error;

  } finally {
    isStarting = false;
  }
}

// --------------------------------------------------
// 8. Graceful Server Shutdown
// --------------------------------------------------

async function shutdownServer(signal) {

  console.log(`\n[SERVER] Received ${signal}. Shutting down...`);

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

    console.error(
      '[SERVER] Shutdown error:',
      error.message
    );

    process.exit(1);
  }
}

// --------------------------------------------------
// 9. Main Application Entry Point
// --------------------------------------------------

if (require.main === module) {

  const { seedDatabase } = require('./utils/seed');

  startServer(ENV.PORT)

    .then(async () => {

      console.log('[DATABASE] Running database seeding...');

      await seedDatabase({
        forceReset: false,
      });

      console.log(
        '[Hospital DFA Backend] Application started successfully.'
      );

      console.log(
        `[Hospital DFA Backend] Port: ${ENV.PORT}`
      );

      console.log(
        `[Hospital DFA Backend] Database readyState: ${mongoose.connection.readyState}`
      );

    })

    .catch((error) => {

      console.error(
        '[SERVER] Failed to start application:',
        error.message
      );

      process.exit(1);

    });

  // Handle terminal interruption.
  process.once('SIGINT', () => {
    shutdownServer('SIGINT');
  });

  // Handle operating system termination.
  process.once('SIGTERM', () => {
    shutdownServer('SIGTERM');
  });

}

// --------------------------------------------------
// 10. Module Exports
// --------------------------------------------------

=======
// Serve the built React application from the same Render web service when present.
const frontendDist = path.resolve(__dirname, '..', 'frontend', 'dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get('*', (req, res, next) => {
    if (req.path === '/api' || req.path.startsWith('/api/')) {
      return next();
    }
    return res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

// 4. Centralized 404 & Error Handling
app.use(notFoundHandler);
app.use(errorHandler);

async function startServer(port = ENV.PORT, options = {}) {
  await connectDB(options);
  return new Promise((resolve) => {
    const server = app.listen(port, '0.0.0.0', () => {
      resolve(server);
    });
  });
}

if (require.main === module) {
  const { seedDatabase } = require('./utils/seed');
  startServer(ENV.PORT)
    .then(async (server) => {
      await seedDatabase({ forceReset: false });
      const addr = server.address();
      console.log(
        `[Hospital DFA Backend] Server listening on 0.0.0.0:${addr.port} (DB readyState=${mongoose.connection.readyState})`
      );
    })
    .catch((err) => {
      console.error('Failed to start server:', err);
      process.exit(1);
    });
}

>>>>>>> ce80f239edc9e0b467abb27280f2a6646f4c47a5
module.exports = {
  app,
  startServer,
};
