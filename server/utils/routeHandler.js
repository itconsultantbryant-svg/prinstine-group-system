/**
 * Wrapper for route handlers to ensure consistent error handling
 * Handles database errors, missing tables, and other common issues
 */

/**
 * Wrap a route handler with comprehensive error handling
 * @param {Function} handler - The route handler function
 * @returns {Function} Wrapped handler with error handling
 */
function handleRoute(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      // Handle missing table errors gracefully
      if (error.message && (
        error.message.includes('no such table') ||
        error.message.includes('no such column')
      )) {
        console.warn(`Database table/column may not exist: ${error.message}`);
        console.warn(`Route: ${req.method} ${req.path}`);
        
        // Return appropriate empty response based on HTTP method
        if (req.method === 'GET') {
          // For GET requests, return empty array or object
          if (req.path.includes('/stats') || req.path.includes('/count')) {
            return res.json({ count: 0, stats: {} });
          }
          return res.json([]);
        } else {
          return res.status(500).json({ 
            error: 'Database table not initialized. Please contact administrator.',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
          });
        }
      }
      
      // Handle permission errors
      if (error.message && error.message.includes('permission') || error.status === 403) {
        return res.status(403).json({ error: error.message || 'Insufficient permissions' });
      }
      
      // Handle authentication errors
      if (error.message && error.message.includes('token') || error.status === 401) {
        return res.status(401).json({ error: error.message || 'Authentication required' });
      }
      
      // Handle validation errors
      if (error.status === 400 || error.name === 'ValidationError') {
        return res.status(400).json({ 
          error: error.message || 'Validation failed',
          details: error.errors || undefined
        });
      }
      
      // Log full error for debugging
      console.error('Route error:', {
        method: req.method,
        path: req.path,
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
      
      // Return generic error response
      res.status(error.status || 500).json({ 
        error: error.message || 'An error occurred processing your request',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  };
}

/**
 * Middleware to ensure user is authenticated and has required role
 * @param {...string} allowedRoles - Roles that can access this route
 * @returns {Function} Middleware function
 */
function requireAuthAndRole(...allowedRoles) {
  return async (req, res, next) => {
    try {
      // Check authentication
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.split(' ')[1];
      
      if (!token) {
        return res.status(401).json({ error: 'Access token required' });
      }
      
      const { verifyToken } = require('./auth');
      const decoded = verifyToken(token);
      
      if (!decoded) {
        return res.status(403).json({ error: 'Invalid or expired token' });
      }
      
      req.user = decoded;
      
      // Check role if roles are specified
      if (allowedRoles.length > 0 && !allowedRoles.includes(req.user.role)) {
        return res.status(403).json({ 
          error: 'Insufficient permissions',
          required: allowedRoles,
          current: req.user.role
        });
      }
      
      next();
    } catch (error) {
      console.error('Auth middleware error:', error);
      res.status(500).json({ error: 'Authentication check failed' });
    }
  };
}

/**
 * Safe database query wrapper that handles missing tables
 * @param {Function} queryFn - Function that returns a database query promise
 * @param {*} defaultValue - Default value to return if query fails
 * @returns {Promise<*>} Query result or default value
 */
async function safeDbQuery(queryFn, defaultValue = null) {
  try {
    return await queryFn();
  } catch (error) {
    if (error.message && (
      error.message.includes('no such table') ||
      error.message.includes('no such column')
    )) {
      console.warn(`Safe query: Table/column may not exist: ${error.message}`);
      return defaultValue;
    }
    throw error; // Re-throw other errors
  }
}

module.exports = {
  handleRoute,
  requireAuthAndRole,
  safeDbQuery
};

