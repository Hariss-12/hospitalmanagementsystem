<<<<<<< HEAD

/**
 * Mongoose Database Adapter
 *
 * Selects the appropriate database implementation:
 * 1. MongoDB Atlas / Standard MongoDB
 * 2. Persistent Local JSON Storage
 * 3. Test Environment
 */

const ENV = require('./env');

const useLocalDatabase =
  ENV.USE_LOCAL_DB === true ||
  ENV.NODE_ENV === 'test';

let mongoose;

try {
  if (useLocalDatabase) {
    console.log('[DATABASE] Using Local Database Adapter');
    mongoose = require('./localMongoose');
  } else {
    console.log('[DATABASE] Using MongoDB Atlas Adapter');
    mongoose = require('mongoose');
  }
} catch (error) {
  console.error('[DATABASE] Failed to load database adapter:', error.message);
  throw error;
}

module.exports = mongoose;
=======
const ENV = require('./env');

module.exports =
  ENV.USE_LOCAL_DB || ENV.NODE_ENV === 'test' ? require('./localMongoose') : require('mongoose');
>>>>>>> ce80f239edc9e0b467abb27280f2a6646f4c47a5
