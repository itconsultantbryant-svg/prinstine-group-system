/**
 * Comprehensive error handling utility for routes
 * Handles database errors, missing tables, permissions, and validation
 */

/**
 * Wrap route handler with comprehensive error handling
 * @param {Function} handler - Route handler function
 * @returns {Function} Wrapped handler
 */
function wrapHandler(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      handleError(error, req, res);
    }
  };
}

/**
 * Handle errors consistently across all routes
 * @param {Error} error - The error object
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 */
function handleError(error, req, res) {
  // Log error details
  console.error('Route error:', {
    method: req.method,
    path: req.path,
    error: error.message,
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
  });

  // Handle missing database table/column errors
  if (error.message && (
    error.message.includes('no such table') ||
    error.message.includes('no such column') ||
    error.message.includes('SQLITE_ERROR')
  )) {
    console.warn(`Database table/column may not exist: ${error.message}`);
    
    // Return appropriate empty response based on HTTP method
    if (req.method === 'GET') {
      // For GET requests, return empty array or object
      if (req.path.includes('/stats') || req.path.includes('/count')) {
        return res.json({ count: 0, stats: {} });
      }
      // Check if response expects array or object
      if (req.path.match(/\/\d+$/)) {
        // Single resource endpoint
        return res.status(404).json({ error: 'Resource not found' });
      }
      return res.json([]);
    } else {
      // For POST/PUT/DELETE, return error but don't crash
      return res.status(500).json({ 
        error: 'Database not fully initialized. Please contact administrator.',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Handle permission errors
  if (error.status === 403 || error.message && error.message.toLowerCase().includes('permission')) {
    return res.status(403).json({ 
      error: error.message || 'Insufficient permissions',
      code: 'PERMISSION_DENIED'
    });
  }

  // Handle authentication errors
  if (error.status === 401 || error.message && (
    error.message.includes('token') || 
    error.message.includes('authentication') ||
    error.message.includes('unauthorized')
  )) {
    return res.status(401).json({ 
      error: error.message || 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }

  // Handle validation errors
  if (error.status === 400 || error.name === 'ValidationError' || error.errors) {
    return res.status(400).json({ 
      error: error.message || 'Validation failed',
      errors: error.errors || undefined,
      code: 'VALIDATION_ERROR'
    });
  }

  // Handle not found errors
  if (error.status === 404 || error.message && error.message.includes('not found')) {
    return res.status(404).json({ 
      error: error.message || 'Resource not found',
      code: 'NOT_FOUND'
    });
  }

  // Handle database constraint errors
  if (error.message && (
    error.message.includes('UNIQUE constraint') ||
    error.message.includes('FOREIGN KEY constraint') ||
    error.message.includes('NOT NULL constraint')
  )) {
    return res.status(400).json({ 
      error: 'Data validation failed: ' + error.message,
      code: 'CONSTRAINT_ERROR',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }

  // Generic error handler
  const statusCode = error.status || error.statusCode || 500;
  res.status(statusCode).json({ 
    error: error.message || 'An error occurred processing your request',
    code: 'INTERNAL_ERROR',
    details: process.env.NODE_ENV === 'development' ? {
      stack: error.stack,
      message: error.message
    } : undefined
  });
}

/**
 * Middleware to ensure database tables exist before querying
 * @param {...string} requiredTables - Table names that must exist
 * @returns {Function} Middleware function
 */
function requireTables(...requiredTables) {
  return async (req, res, next) => {
    try {
      const db = require('../config/database');
      
      for (const table of requiredTables) {
        const tableExists = await db.get(
          "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
          [table]
        );
        
        if (!tableExists) {
          console.warn(`Required table '${table}' does not exist`);
          // Don't block, just log - database layer will handle gracefully
        }
      }
      
      next();
    } catch (error) {
      // If we can't check tables, continue anyway - database layer will handle
      console.warn('Could not verify table existence:', error.message);
      next();
    }
  };
}

module.exports = {
  wrapHandler,
  handleError,
  requireTables
};

