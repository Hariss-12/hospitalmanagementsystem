/**
 * Selects MongoDB or the local JSON adapter for development and tests.
 */

const ENV = require('./env');
const useLocalDatabase = ENV.USE_LOCAL_DB || ENV.NODE_ENV === 'test';

if (useLocalDatabase) {
  console.log('[DATABASE] Using Local Database Adapter');
  module.exports = require('./localMongoose');
} else {
  console.log('[DATABASE] Using MongoDB Atlas Adapter');
  module.exports = require('mongoose');
}
