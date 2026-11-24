/**
 * Database Connection Manager (MongoDB Atlas + Persistent Local Store)
 */

const mongoose = require('./mongoose');
const path = require('node:path');
const ENV = require('./env');

async function connectDB(options = {}) {
  if (!ENV.USE_LOCAL_DB && ENV.NODE_ENV !== 'test') {
    return mongoose.connect(ENV.MONGODB_URI);
  }

  const dbPath =
    options.dbFilePath ||
    process.env.DB_FILE_PATH ||
    path.resolve(__dirname, '..', 'data', 'hospital_dfa_store.json');

  const conn = await mongoose.connect(ENV.MONGODB_URI, {
    dbFilePath: dbPath,
    inMemoryOnly: Boolean(options.inMemoryOnly),
  });

  return conn;
}

async function disconnectDB() {
  await mongoose.disconnect();
}

module.exports = {
  connectDB,
  disconnectDB,
  mongoose,
};
