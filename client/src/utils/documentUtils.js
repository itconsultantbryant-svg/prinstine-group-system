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
  if (!filePath) {
    alert('No file path provided');
    return;
  }
  
  try {
    const url = getAuthenticatedFileUrl(filePath, 'download');
    
    // Extract filename from path if not provided
    if (!filename) {
      const pathParts = filePath.split('/');
      filename = pathParts[pathParts.length - 1] || 'document';
      // Decode filename if it's URL encoded
      try {
        filename = decodeURIComponent(filename);
      } catch (e) {
        // If decode fails, use as-is
      }
    }
    
    console.log('Starting download:', { filePath, filename, url });
    
    // Method 1: Try using axios (more reliable with authentication)
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found. Please log in again.');
      }
      
      const response = await api.get(url, {
        responseType: 'blob',
        timeout: 120000, // 2 minutes timeout for large files
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      // Check if response is actually a blob (success) or error JSON
      let blob = response.data;
      
      // If blob is very small, it might be an error JSON
      if (blob instanceof Blob && blob.size < 500) {
        try {
          const text = await blob.text();
          const json = JSON.parse(text);
          if (json.error) {
            throw new Error(json.error);
          }
          // If not error JSON, recreate blob from text
          blob = new Blob([text], { type: response.headers['content-type'] || 'application/octet-stream' });
        } catch (e) {
          // Not JSON, use blob as-is
        }
      }
      
      // Get content type from response headers
      const contentType = response.headers['content-type'] || response.headers['Content-Type'] || 'application/octet-stream';
      
      // Ensure blob has correct type
      if (blob instanceof Blob) {
        if (blob.type !== contentType && contentType !== 'application/octet-stream') {
          const arrayBuffer = await blob.arrayBuffer();
          blob = new Blob([arrayBuffer], { type: contentType });
        }
      } else {
        // Convert to blob if not already
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
      
      console.log('Download initiated successfully');
      
      // Cleanup: Remove link and revoke blob URL after delay
      setTimeout(() => {
        try {
          document.body.removeChild(link);
          setTimeout(() => {
            window.URL.revokeObjectURL(blobUrl);
          }, 15000); // 15 seconds - plenty of time for download to start
        } catch (e) {
          // Link might already be removed, ignore
        }
      }, 1000);
      
      return; // Success
    } catch (axiosError) {
      console.warn('Axios download failed, trying fetch fallback:', axiosError);
      
      // Method 2: Fallback to fetch
      const token = localStorage.getItem('token');
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': '*/*'
        }
      });
      
      // Check if response is OK
      if (!response.ok) {
        // Try to get error message from response
        let errorText = `HTTP error! status: ${response.status}`;
        try {
          const errorData = await response.text();
          try {
            const errorJson = JSON.parse(errorData);
            errorText = errorJson.error || errorText;
          } catch (e) {
            errorText = errorData || errorText;
          }
        } catch (e) {
          // Couldn't parse error, use status
        }
        throw new Error(errorText);
      }
      
      // Get blob from response
      const blob = await response.blob();
      
      // Check if blob is actually an error JSON (small size)
      if (blob.size < 500) {
        try {
          const text = await blob.text();
          const json = JSON.parse(text);
          if (json.error) {
            throw new Error(json.error);
          }
        } catch (e) {
          // Not JSON error, continue with download
        }
      }
      
      // Create blob URL and trigger download
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      link.style.display = 'none';
      
      document.body.appendChild(link);
      link.click();
      
      console.log('Download initiated successfully (fetch method)');
      
      // Cleanup
      setTimeout(() => {
        try {
          document.body.removeChild(link);
          setTimeout(() => {
            window.URL.revokeObjectURL(blobUrl);
          }, 15000);
        } catch (e) {
          // Ignore
        }
      }, 1000);
      
      return; // Success
    }
    
  } catch (error) {
    console.error('Download error:', error);
    
    // Extract meaningful error message
    let errorMessage = 'Failed to download document. Please try again.';
    
    // Check response status
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;
      
      if (status === 404) {
        errorMessage = 'Document not found. It may have been deleted or moved.';
      } else if (status === 403) {
        errorMessage = 'You do not have permission to download this document.';
      } else if (status === 401) {
        errorMessage = 'Your session has expired. Please log in again.';
      } else if (status >= 500) {
        errorMessage = 'Server error. Please try again later.';
      } else if (data) {
        // Try to extract error from response data
        if (data instanceof Blob) {
          try {
            const text = await data.text();
            const json = JSON.parse(text);
            errorMessage = json.error || errorMessage;
          } catch (e) {
            // Couldn't parse, use default
          }
        } else if (typeof data === 'object' && data.error) {
          errorMessage = data.error;
        } else if (typeof data === 'string') {
          errorMessage = data;
        }
      }
    } else if (error.message) {
      // Use error message if available
      if (error.message.includes('timeout') || error.message.includes('TIMEOUT')) {
        errorMessage = 'Download timed out. The file may be too large. Please try again.';
      } else if (error.message.includes('Network Error') || error.message.includes('Failed to fetch')) {
        errorMessage = 'Network error. Please check your connection and try again.';
      } else if (error.message.includes('token')) {
        errorMessage = 'Authentication error. Please log in again.';
      } else {
        errorMessage = error.message;
      }
    }
    
    // Show user-friendly error message
    alert(errorMessage);
    
    // Log full error for debugging
    console.error('Full download error details:', {
      error,
      message: error.message,
      response: error.response,
      filePath,
      filename
    });
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

