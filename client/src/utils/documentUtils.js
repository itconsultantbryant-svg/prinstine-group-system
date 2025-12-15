/**
 * Utility functions for handling document URLs, downloads, and printing
 */
import api from '../config/api';
import { getApiBaseUrl, getBaseUrl, normalizeUrl } from './apiUrl';

/**
 * Normalize document URL to ensure it's a full URL
 * @param {string} filePath - Relative or absolute file path
 * @returns {string} Full URL to the document
 */
export const normalizeDocumentUrl = (filePath) => {
  return normalizeUrl(filePath);
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
  const API_BASE_URL = getApiBaseUrl();
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
    
    // Extract filename from path if not provided
    if (!filename) {
      const pathParts = filePath.split('/');
      filename = pathParts[pathParts.length - 1] || 'document';
    }
    
    // Method 1: Try using fetch with blob for better control and error handling
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      // Get content type from response
      const contentType = response.headers.get('content-type') || 'application/octet-stream';
      const blob = await response.blob();
      
      // Create blob URL and trigger download
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      link.style.display = 'none';
      
      // Add to DOM, click, then remove
      document.body.appendChild(link);
      link.click();
      
      // Don't revoke immediately - wait longer to ensure download completes
      // Blob URLs will be cleaned up when the page is closed
      setTimeout(() => {
        try {
          document.body.removeChild(link);
          // Only revoke after a longer delay to ensure download started
          setTimeout(() => {
            window.URL.revokeObjectURL(blobUrl);
          }, 10000); // 10 seconds - plenty of time for download to start
        } catch (e) {
          // Link might already be removed, ignore
        }
      }, 1000); // Wait 1 second before attempting cleanup
      
      return; // Success, exit function
    } catch (fetchError) {
      console.warn('Fetch download method failed, trying axios fallback:', fetchError);
      // Fall through to axios method
    }
    
    // Method 2: Fallback to axios (original method)
    const response = await api.get(url, {
      responseType: 'blob',
      timeout: 60000 // 60 second timeout for large files
    });
    
    // Get content type from response headers
    const contentType = response.headers['content-type'] || response.headers['Content-Type'] || 'application/octet-stream';
    let blob = response.data;
    
    // Ensure blob has correct type
    if (blob instanceof Blob && blob.type !== contentType && contentType !== 'application/octet-stream') {
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
    
    // Don't revoke immediately - wait longer to ensure download completes
    setTimeout(() => {
      try {
        document.body.removeChild(link);
        // Only revoke after a longer delay
        setTimeout(() => {
          window.URL.revokeObjectURL(blobUrl);
        }, 10000); // 10 seconds
      } catch (e) {
        // Link might already be removed, ignore
      }
    }, 1000); // Wait 1 second before attempting cleanup
    
  } catch (error) {
    console.error('Download error:', error);
    
    // Try to extract error message from blob response if available
    let errorMessage = 'Failed to download document. Please try again.';
    
    if (error.response?.data instanceof Blob) {
      try {
        const text = await error.response.data.text();
        const json = JSON.parse(text);
        errorMessage = json.error || errorMessage;
      } catch (e) {
        // If parsing fails, check status code
        if (error.response?.status === 404) {
          errorMessage = 'Document not found. It may have been deleted.';
        } else if (error.response?.status === 403) {
          errorMessage = 'You do not have permission to download this document.';
        } else if (error.response?.status === 401) {
          errorMessage = 'Your session has expired. Please log in again.';
        }
      }
    } else if (error.response?.data?.error) {
      errorMessage = error.response.data.error;
    } else if (error.message) {
      if (error.message.includes('timeout')) {
        errorMessage = 'Download timed out. The file may be too large. Please try again.';
      } else if (error.message.includes('Network Error')) {
        errorMessage = 'Network error. Please check your connection and try again.';
      } else {
        errorMessage = error.message;
      }
    }
    
    // For production: Show user-friendly error message
    alert(errorMessage);
    
    // Also log full error for debugging (only in development)
    if (process.env.NODE_ENV === 'development') {
      console.error('Full error details:', error);
    }
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

