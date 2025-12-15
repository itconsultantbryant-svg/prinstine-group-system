/**
 * Utility functions for handling document URLs, downloads, and printing
 */
import api from '../config/api';

/**
 * Normalize document URL to ensure it's a full URL
 * @param {string} filePath - Relative or absolute file path
 * @returns {string} Full URL to the document
 */
export const normalizeDocumentUrl = (filePath) => {
  if (!filePath) return '';
  
  // If already a full URL, return as is
  if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
    return filePath;
  }
  
  // If relative URL, prepend base URL
  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3006/api';
  const baseUrl = API_BASE_URL.replace('/api', '');
  
  // Ensure URL starts with /
  const relativeUrl = filePath.startsWith('/') ? filePath : `/${filePath}`;
  return `${baseUrl}${relativeUrl}`;
};

/**
 * Get authenticated download/view URL using API endpoint
 * @param {string} filePath - Relative file path (e.g., /uploads/communications/file.pdf)
 * @param {string} action - 'download' or 'view'
 * @returns {string} API URL with authentication
 */
export const getAuthenticatedFileUrl = (filePath, action = 'download') => {
  if (!filePath) return '';
  
  // Extract path if it's a full URL
  let pathToUse = filePath;
  if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
    // Extract the path from full URL
    try {
      const url = new URL(filePath);
      pathToUse = url.pathname;
    } catch (e) {
      // If URL parsing fails, use as-is
      pathToUse = filePath;
    }
  }
  
  // Ensure path starts with /
  if (!pathToUse.startsWith('/')) {
    pathToUse = `/${pathToUse}`;
  }
  
  // Use API endpoint for authenticated access
  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3006/api';
  const endpoint = action === 'view' ? '/upload/view' : '/upload/download';
  return `${API_BASE_URL}${endpoint}?path=${encodeURIComponent(pathToUse)}`;
};

/**
 * Handle document view - opens document in new tab using authenticated endpoint
 * @param {string} filePath - Path to the document
 */
export const handleViewDocument = (filePath) => {
  const url = getAuthenticatedFileUrl(filePath, 'view');
  // Get token for the URL
  const token = localStorage.getItem('token');
  const urlWithToken = token ? `${url}&token=${token}` : url;
  window.open(urlWithToken, '_blank');
};

/**
 * Handle document download using authenticated API endpoint
 * @param {string} filePath - Path to the document
 * @param {string} filename - Optional filename for download
 */
export const handleDownloadDocument = async (filePath, filename = null) => {
  try {
    const url = getAuthenticatedFileUrl(filePath, 'download');
    
    // Use axios (api) which automatically includes auth token
    const response = await api.get(url, {
      responseType: 'blob'
    });
    
    // Create blob URL and trigger download
    const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = blobUrl;
    
    // Use provided filename or extract from path
    if (!filename) {
      // Extract filename from path
      const pathParts = filePath.split('/');
      filename = pathParts[pathParts.length - 1] || 'document';
    }
    
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(blobUrl);
  } catch (error) {
    console.error('Download error:', error);
    alert('Failed to download document. Please try again.');
  }
};

/**
 * Handle document print - opens document in new window and prints
 * @param {string} filePath - Path to the document
 */
export const handlePrintDocument = (filePath) => {
  // Use view endpoint which will display the file inline
  const url = getAuthenticatedFileUrl(filePath, 'view');
  const token = localStorage.getItem('token');
  const urlWithToken = token ? `${url}&token=${token}` : url;
  
  // Open document in new window and print
  const printWindow = window.open(urlWithToken, '_blank');
  if (printWindow) {
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
      }, 1000); // Increased delay to ensure document loads
    };
  } else {
    alert('Please allow popups to print this document');
  }
};

/**
 * Handle attachment download/print/view (for notification/communication attachments)
 * @param {object|string} attachment - Attachment object with url and filename, or URL string
 * @param {string} action - 'view', 'download', or 'print'
 */
export const handleAttachmentAction = (attachment, action) => {
  // Handle both object and string formats
  const url = typeof attachment === 'string' ? attachment : (attachment.url || attachment);
  const filename = typeof attachment === 'string' ? null : (attachment.filename || attachment.originalName || null);
  
  // Extract path from URL if it's a full URL
  let filePath = url;
  if (url.startsWith('http://') || url.startsWith('https://')) {
    try {
      const urlObj = new URL(url);
      filePath = urlObj.pathname;
    } catch (e) {
      filePath = url;
    }
  }
  
  switch (action) {
    case 'view':
      handleViewDocument(filePath);
      break;
    case 'download':
      handleDownloadDocument(filePath, filename);
      break;
    case 'print':
      handlePrintDocument(filePath);
      break;
    default:
      console.error('Unknown action:', action);
  }
};

