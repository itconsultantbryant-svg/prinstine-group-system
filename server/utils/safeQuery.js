const db = require('../config/database');

/**
 * Safely execute a database query, returning a default value if the table doesn't exist
 * @param {string} sql - SQL query to execute
 * @param {Array} params - Query parameters
 * @param {*} defaultValue - Default value to return if query fails (default: { count: 0 })
 * @returns {Promise<*>} Query result or default value
 */
async function safeQuery(sql, params = [], defaultValue = { count: 0 }) {
  try {
    const result = await db.get(sql, params);
    return result || defaultValue;
  } catch (error) {
    // If table doesn't exist, return default value instead of throwing
    if (error.message && (
      error.message.includes('no such table') ||
      error.message.includes('no such column') ||
      error.message.includes('syntax error')
    )) {
      console.warn(`Table/column may not exist yet: ${error.message}`);
      console.warn(`Query: ${sql.substring(0, 100)}...`);
      return defaultValue;
    }
    // For other errors, log and return default
    console.error('Database query error:', error.message);
    console.error('Query:', sql.substring(0, 100));
    return defaultValue;
  }
}

/**
 * Safely execute multiple queries in parallel
 * @param {Array<{sql: string, params: Array, defaultValue: *}>} queries - Array of query objects
 * @returns {Promise<Array>} Array of query results
 */
async function safeQueryAll(queries) {
  try {
    const results = await Promise.all(
      queries.map(({ sql, params = [], defaultValue = { count: 0 } }) =>
        safeQuery(sql, params, defaultValue)
      )
    );
    return results;
  } catch (error) {
    console.error('Error in safeQueryAll:', error.message);
    // Return array of default values
    return queries.map(({ defaultValue = { count: 0 } }) => defaultValue);
  }
}

module.exports = { safeQuery, safeQueryAll };

