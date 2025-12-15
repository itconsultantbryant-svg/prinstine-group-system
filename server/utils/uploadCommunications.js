const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads/communications directory exists
const uploadsDir = path.join(__dirname, '../../uploads/communications');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure storage for communication attachments
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `comm-${uniqueSuffix}-${sanitizedName}`);
  }
});

// File filter - allow common document and image types including PowerPoint
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|xls|xlsx|ppt|pptx|txt|csv|zip|rar/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = /image\/(jpeg|jpg|png|gif)|application\/(pdf|msword|vnd\.openxmlformats-officedocument\.wordprocessingml\.document|vnd\.ms-excel|vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet|vnd\.ms-powerpoint|vnd\.openxmlformats-officedocument\.presentationml\.presentation|zip|x-rar-compressed)|text\/(plain|csv)/.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('File type not allowed. Allowed types: Images (JPEG, PNG, GIF), Documents (PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT, CSV), Archives (ZIP, RAR)'));
  }
};

// Configure multer for communications
const uploadCommunications = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: fileFilter
});

module.exports = uploadCommunications;

