const express = require('express');
const router = express.Router();
const upload = require('../utils/upload');
const uploadClaims = require('../utils/uploadClaims');
const uploadCommunications = require('../utils/uploadCommunications');
const uploadReports = require('../utils/uploadReports');
const { authenticateToken } = require('../utils/auth');
const path = require('path');

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

module.exports = router;

