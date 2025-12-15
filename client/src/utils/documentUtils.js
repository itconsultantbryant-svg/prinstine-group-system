/**
 * Utility functions for handling document URLs, downloads, and printing
 */

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
 * Handle document view - opens document in new tab
 * @param {string} filePath - Path to the document
 */
export const handleViewDocument = (filePath) => {
  const url = normalizeDocumentUrl(filePath);
  window.open(url, '_blank');
};

/**
 * Handle document download
 * @param {string} filePath - Path to the document
 * @param {string} filename - Optional filename for download
 */
export const handleDownloadDocument = (filePath, filename = null) => {
  const url = normalizeDocumentUrl(filePath);
  
  // Try using fetch to download with proper headers
  fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    }
  })
  .then(response => {
    if (!response.ok) {
      // If fetch fails (e.g., CORS), fall back to direct link
      const link = document.createElement('a');
      link.href = url;
      link.download = filename || 'document';
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }
    
    return response.blob().then(blob => {
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename || url.split('/').pop() || 'document';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    });
  })
  .catch(error => {
    console.error('Download error:', error);
    // Fallback to direct link download
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || url.split('/').pop() || 'document';
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });
};

/**
 * Handle document print - opens document in new window and prints
 * @param {string} filePath - Path to the document
 */
export const handlePrintDocument = (filePath) => {
  const url = normalizeDocumentUrl(filePath);
  
  // Open document in new window and print
  const printWindow = window.open(url, '_blank');
  if (printWindow) {
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
      }, 500);
    };
  } else {
    alert('Please allow popups to print this document');
  }
};

/**
 * Handle attachment download/print/view (for notification/communication attachments)
 * @param {object} attachment - Attachment object with url and filename
 * @param {string} action - 'view', 'download', or 'print'
 */
export const handleAttachmentAction = (attachment, action) => {
  const url = attachment.url || attachment;
  const filename = attachment.filename || attachment.originalName || attachment;
  
  switch (action) {
    case 'view':
      handleViewDocument(url);
      break;
    case 'download':
      handleDownloadDocument(url, typeof filename === 'string' ? filename : null);
      break;
    case 'print':
      handlePrintDocument(url);
      break;
    default:
      console.error('Unknown action:', action);
  }
};

