const express = require('express');
const router = express.Router();
const upload = require('../utils/upload');
const uploadClaims = require('../utils/uploadClaims');
const uploadCommunications = require('../utils/uploadCommunications');
const uploadReports = require('../utils/uploadReports');
const { authenticateToken } = require('../utils/auth');
const path = require('path');
const fs = require('fs');

// Upload profile image
router.post('/profile-image', authenticateToken, upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Return relative URL that works with both frontend and backend
    // Frontend will prepend the API base URL if needed
    const imageUrl = `/uploads/${req.file.filename}`;
    
    console.log('Image uploaded:', {
      filename: req.file.filename,
      path: req.file.path,
      size: req.file.size,
      imageUrl: imageUrl
    });
    
    res.json({
      message: 'Image uploaded successfully',
      imageUrl: imageUrl,
      filename: req.file.filename
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to upload image' });
  }
});

// Upload communication attachment (authenticated users)
router.post('/communication', authenticateToken, uploadCommunications.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Return full URL for communication attachments
    const baseUrl = process.env.API_BASE_URL || 'http://localhost:3006';
    const fileUrl = `${baseUrl}/uploads/communications/${req.file.filename}`;
    
    console.log('Communication attachment uploaded:', {
      filename: req.file.filename,
      path: req.file.path,
      size: req.file.size,
      mimetype: req.file.mimetype,
      fileUrl: fileUrl
    });
    
    res.json({
      message: 'File uploaded successfully',
      url: fileUrl,
      filename: req.file.filename
    });
  } catch (error) {
    console.error('Upload error:', error);
    if (error.message.includes('File type not allowed')) {
      return res.status(400).json({ error: error.message });
    }
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File size too large. Maximum size is 10MB.' });
    }
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

// Upload report attachment (authenticated users)
router.post('/report', authenticateToken, uploadReports.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Return full URL for report attachments
    const baseUrl = process.env.API_BASE_URL || 'http://localhost:3006';
    const fileUrl = `${baseUrl}/uploads/reports/${req.file.filename}`;
    
    console.log('Report attachment uploaded:', {
      filename: req.file.filename,
      path: req.file.path,
      size: req.file.size,
      mimetype: req.file.mimetype,
      fileUrl: fileUrl
    });
    
    res.json({
      message: 'File uploaded successfully',
      url: fileUrl,
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype
    });
  } catch (error) {
    console.error('Upload error:', error);
    if (error.message.includes('File type not allowed')) {
      return res.status(400).json({ error: error.message });
    }
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File size too large. Maximum size is 10MB.' });
    }
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

// Upload claim attachment (public endpoint - no auth required)
router.post('/', uploadClaims.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Return full URL for claim attachments
    const baseUrl = process.env.API_BASE_URL || 'http://localhost:3006';
    const fileUrl = `${baseUrl}/uploads/claims/${req.file.filename}`;
    
    console.log('Claim attachment uploaded:', {
      filename: req.file.filename,
      path: req.file.path,
      size: req.file.size,
      mimetype: req.file.mimetype,
      fileUrl: fileUrl
    });
    
    res.json({
      message: 'File uploaded successfully',
      url: fileUrl,
      filename: req.file.filename
    });
  } catch (error) {
    console.error('Upload error:', error);
    if (error.message.includes('Only PNG, JPEG, and PDF')) {
      return res.status(400).json({ error: error.message });
    }
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File size too large. Maximum size is 10MB.' });
    }
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

// Download file endpoint (authenticated)
// This endpoint allows authenticated users to download files permanently stored on server
// Usage: /api/upload/download?path=/uploads/communications/filename.pdf
router.get('/download', authenticateToken, (req, res) => {
  let fileStream = null;
  
  try {
    const filePath = req.query.path;
    
    if (!filePath) {
      return res.status(400).json({ error: 'File path is required' });
    }

    // Security: Ensure path is within uploads directory
    if (!filePath.startsWith('/uploads/')) {
      return res.status(403).json({ error: 'Invalid file path' });
    }

    // Resolve the full file path
    const fullPath = path.join(__dirname, '../..', filePath);
    
    // Additional security check - ensure it's within the project directory
    const normalizedPath = path.normalize(fullPath);
    const uploadsBaseDir = path.normalize(path.join(__dirname, '../../uploads'));
    
    if (!normalizedPath.startsWith(uploadsBaseDir)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check if file exists
    if (!fs.existsSync(normalizedPath)) {
      return res.status(404).json({ error: 'File not found. The file may have been deleted or moved.' });
    }

    // Get file stats
    let stats;
    try {
      stats = fs.statSync(normalizedPath);
    } catch (statError) {
      console.error('Error getting file stats:', statError);
      return res.status(500).json({ error: 'Unable to access file' });
    }
    
    if (!stats.isFile()) {
      return res.status(400).json({ error: 'Path is not a file' });
    }

    // Determine content type based on file extension
    const ext = path.extname(normalizedPath).toLowerCase();
    const contentTypeMap = {
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.ppt': 'application/vnd.ms-powerpoint',
      '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.txt': 'text/plain',
      '.zip': 'application/zip',
      '.rar': 'application/x-rar-compressed'
    };

    const contentType = contentTypeMap[ext] || 'application/octet-stream';
    const filename = path.basename(normalizedPath);

    // Set headers for permanent file download
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.setHeader('Content-Length', stats.size);
    // Cache control for production - files should be downloadable but not cached by browser
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    // Stream the file - this ensures the file is served directly from disk
    fileStream = fs.createReadStream(normalizedPath);
    
    // Handle stream errors
    fileStream.on('error', (streamError) => {
      console.error('File stream error:', streamError);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to read file. The file may be corrupted or inaccessible.' });
      } else {
        // Headers already sent, can't send error response
        res.end();
      }
    });
    
    // Handle client disconnect
    req.on('close', () => {
      if (fileStream && !fileStream.destroyed) {
        fileStream.destroy();
      }
    });
    
    // Pipe file to response
    fileStream.pipe(res);

  } catch (error) {
    console.error('Download error:', error);
    
    // Clean up file stream if it exists
    if (fileStream && !fileStream.destroyed) {
      fileStream.destroy();
    }
    
    if (!res.headersSent) {
      // Provide specific error messages for common issues
      if (error.code === 'ENOENT') {
        res.status(404).json({ error: 'File not found' });
      } else if (error.code === 'EACCES') {
        res.status(403).json({ error: 'Access denied to file' });
      } else {
        res.status(500).json({ error: 'Failed to download file. Please try again.' });
      }
    }
  }
});

// View file endpoint (authenticated) - opens file in browser instead of downloading
// Usage: /api/upload/view?path=/uploads/communications/filename.pdf
router.get('/view', authenticateToken, (req, res) => {
  try {
    const filePath = req.query.path;
    
    if (!filePath) {
      return res.status(400).json({ error: 'File path is required' });
    }

    // Security: Ensure path is within uploads directory
    if (!filePath.startsWith('/uploads/')) {
      return res.status(403).json({ error: 'Invalid file path' });
    }

    // Resolve the full file path
    const fullPath = path.join(__dirname, '../..', filePath);
    
    // Additional security check - ensure it's within the project directory
    const normalizedPath = path.normalize(fullPath);
    const uploadsBaseDir = path.normalize(path.join(__dirname, '../../uploads'));
    
    if (!normalizedPath.startsWith(uploadsBaseDir)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check if file exists
    if (!fs.existsSync(normalizedPath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Get file stats
    const stats = fs.statSync(normalizedPath);
    if (!stats.isFile()) {
      return res.status(400).json({ error: 'Path is not a file' });
    }

    // Determine content type based on file extension
    const ext = path.extname(normalizedPath).toLowerCase();
    const contentTypeMap = {
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.ppt': 'application/vnd.ms-powerpoint',
      '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.txt': 'text/plain',
      '.zip': 'application/zip',
      '.rar': 'application/x-rar-compressed'
    };

    const contentType = contentTypeMap[ext] || 'application/octet-stream';

    // Set headers for viewing (inline instead of attachment)
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${path.basename(normalizedPath)}"`);
    res.setHeader('Content-Length', stats.size);

    // Stream the file
    const fileStream = fs.createReadStream(normalizedPath);
    fileStream.pipe(res);

    fileStream.on('error', (error) => {
      console.error('File stream error:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to read file' });
      }
    });

  } catch (error) {
    console.error('View file error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to view file' });
    }
  }
});

module.exports = router;

