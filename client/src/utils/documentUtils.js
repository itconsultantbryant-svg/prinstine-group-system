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
    
    // Extract filename from path if not provided
    if (!filename) {
      const pathParts = filePath.split('/');
      filename = pathParts[pathParts.length - 1] || 'document';
    }
    
    // response.data is already a Blob when responseType is 'blob'
    // Get content type from response headers (server sets this correctly)
    const contentType = response.headers['content-type'] || response.headers['Content-Type'] || 'application/octet-stream';
    
    // Use the blob directly - axios already creates it with the correct type from response headers
    // If we need to ensure the type, we can read it and recreate, but typically the server headers are correct
    let blob = response.data;
    
    // If blob type doesn't match content type from headers, recreate with correct type
    if (blob instanceof Blob && blob.type !== contentType && contentType !== 'application/octet-stream') {
      // Read the blob data and recreate with correct type
      const arrayBuffer = await blob.arrayBuffer();
      blob = new Blob([arrayBuffer], { type: contentType });
    }
    
    // Create blob URL and trigger download
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    
    // Clean up after a short delay to ensure download starts
    setTimeout(() => {
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    }, 100);
  } catch (error) {
    console.error('Download error:', error);
    console.error('Error details:', error.response?.data || error.message);
    console.error('Error response:', error.response);
    
    // Try to extract error message from blob response if available
    let errorMessage = 'Failed to download document';
    if (error.response?.data instanceof Blob) {
      try {
        const text = await error.response.data.text();
        const json = JSON.parse(text);
        errorMessage = json.error || errorMessage;
      } catch (e) {
        // If parsing fails, use default message
      }
    } else if (error.response?.data?.error) {
      errorMessage = error.response.data.error;
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    alert(`Failed to download document: ${errorMessage}`);
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

