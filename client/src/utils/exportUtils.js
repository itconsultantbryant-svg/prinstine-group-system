import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';

/**
 * Export data to PDF
 * @param {string} title - Document title
 * @param {string|Array} content - Content to export (string or array of lines)
 * @param {string} filename - Output filename
 */
export const exportToPDF = (title, content, filename = null) => {
  try {
    const doc = new jsPDF();
    
    // Add title
    doc.setFontSize(16);
    doc.text(title || 'Document', 10, 20);
    
    let y = 30;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 10;
    const maxWidth = 180;
    
    // Handle content
    let lines = [];
    if (typeof content === 'string') {
      lines = doc.splitTextToSize(content, maxWidth);
    } else if (Array.isArray(content)) {
      lines = content;
    } else {
      lines = [String(content)];
    }
    
    lines.forEach((line) => {
      if (y > pageHeight - margin) {
        doc.addPage();
        y = margin;
      }
      doc.setFontSize(10);
      doc.text(String(line || ''), margin, y);
      y += 7;
    });
    
    const outputFilename = filename || `${(title || 'document').replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(outputFilename);
  } catch (error) {
    console.error('PDF export error:', error);
    alert('Failed to export PDF: ' + (error.message || 'Unknown error'));
  }
};

/**
 * Export data to Excel
 * @param {string} title - Sheet title
 * @param {Array} data - Array of arrays representing rows
 * @param {string} filename - Output filename
 */
export const exportToExcel = (title, data, filename = null) => {
  try {
    if (!data || !Array.isArray(data) || data.length === 0) {
      alert('No data to export');
      return;
    }
    
    // Ensure all rows are arrays
    const sanitizedData = data.map(row => {
      if (Array.isArray(row)) {
        return row.map(cell => cell !== null && cell !== undefined ? String(cell) : '');
      }
      return [String(row)];
    });
    
    const ws = XLSX.utils.aoa_to_sheet(sanitizedData);
    const wb = XLSX.utils.book_new();
    
    // Limit sheet name to 31 characters (Excel limit)
    const sheetName = (title || 'Sheet1').substring(0, 31).replace(/[\\\/\?\*\[\]]/g, '_');
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    
    const outputFilename = filename || `${(title || 'export').replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, outputFilename);
  } catch (error) {
    console.error('Excel export error:', error);
    alert('Failed to export Excel: ' + (error.message || 'Unknown error'));
  }
};

/**
 * Print content in a new window
 * @param {string} title - Document title
 * @param {string} content - HTML or text content to print
 */
export const printContent = (title, content) => {
  const printWindow = window.open('', '_blank');
  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>${title}</title>
        <style>
          body { 
            font-family: Arial, sans-serif; 
            padding: 20px; 
            margin: 0;
          }
          h1 { 
            color: #333; 
            border-bottom: 2px solid #333;
            padding-bottom: 10px;
          }
          table { 
            width: 100%; 
            border-collapse: collapse; 
            margin: 20px 0; 
          }
          th, td { 
            border: 1px solid #ddd; 
            padding: 8px; 
            text-align: left; 
          }
          th { 
            background-color: #f2f2f2; 
            font-weight: bold;
          }
          pre {
            white-space: pre-wrap;
            font-family: Arial, sans-serif;
          }
          @media print {
            body { padding: 0; }
            @page { margin: 1cm; }
          }
        </style>
      </head>
      <body>
        <h1>${title}</h1>
        ${typeof content === 'string' && content.includes('<') ? content : `<pre>${content}</pre>`}
      </body>
    </html>
  `;
  printWindow.document.write(htmlContent);
  printWindow.document.close();
  printWindow.print();
};

/**
 * Format report content for display/export
 * @param {Object} report - Report object
 * @param {string} type - Report type (department, progress, etc.)
 */
export const formatReportForExport = (report, type = 'department') => {
  let content = '';
  
  switch (type) {
    case 'department':
      content = `DEPARTMENT REPORT\n`;
      content += `==================\n\n`;
      content += `Title: ${report.title || 'N/A'}\n`;
      content += `Department: ${report.department_name || 'N/A'}\n`;
      content += `Submitted By: ${report.submitted_by_name || 'N/A'}\n`;
      content += `Status: ${report.status || 'N/A'}\n`;
      content += `Created: ${new Date(report.created_at).toLocaleString()}\n\n`;
      
      if (report.content) {
        try {
          const parsed = JSON.parse(report.content);
          if (typeof parsed === 'object') {
            content += `Report Content:\n`;
            content += JSON.stringify(parsed, null, 2);
          } else {
            content += `Report Content:\n${parsed}`;
          }
        } catch (e) {
          content += `Report Content:\n${report.content}`;
        }
      }
      break;
      
    case 'progress':
      content = `PROGRESS REPORT\n`;
      content += `===============\n\n`;
      content += `Name: ${report.name || 'N/A'}\n`;
      content += `Date: ${report.date || 'N/A'}\n`;
      content += `Category: ${report.category || 'N/A'}\n`;
      content += `Status: ${report.status || 'N/A'}\n`;
      content += `Department: ${report.department_name || report.department || 'N/A'}\n`;
      content += `Reported By: ${report.created_by_name || 'N/A'}\n`;
      if (report.created_by_email) {
        content += `Email: ${report.created_by_email}\n`;
      }
      content += `Created: ${new Date(report.created_at).toLocaleString()}\n`;
      break;
      
    default:
      content = JSON.stringify(report, null, 2);
  }
  
  return content;
};

/**
 * Export data to Word document
 * @param {string} title - Document title
 * @param {string} content - Content to export
 * @param {string} filename - Output filename
 */
export const exportToWord = (title, content, filename = null) => {
  try {
    const sanitizedTitle = title || 'Document';
    const sanitizedContent = content || '';
    
    const htmlContent = `
      <!DOCTYPE html>
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
          <meta charset="utf-8">
          <meta name="ProgId" content="Word.Document">
          <meta name="Generator" content="Microsoft Word">
          <meta name="Originator" content="Microsoft Word">
          <title>${sanitizedTitle}</title>
          <!--[if gte mso 9]><xml>
            <w:WordDocument>
              <w:View>Print</w:View>
              <w:Zoom>90</w:Zoom>
              <w:DoNotOptimizeForBrowser/>
            </w:WordDocument>
          </xml><![endif]-->
          <style>
            @page {
              size: 8.5in 11in;
              margin: 1in 1.25in 1in 1.25in;
            }
            body { 
              font-family: Arial, sans-serif; 
              padding: 20px; 
              line-height: 1.6;
            }
            h1 { 
              color: #333; 
              border-bottom: 2px solid #333;
              padding-bottom: 10px;
              margin-bottom: 20px;
            }
            pre { 
              white-space: pre-wrap; 
              font-family: Arial, sans-serif;
              word-wrap: break-word;
            }
            p {
              margin: 10px 0;
            }
          </style>
        </head>
        <body>
          <h1>${sanitizedTitle}</h1>
          <div>${typeof sanitizedContent === 'string' && sanitizedContent.includes('<') ? sanitizedContent : `<pre>${sanitizedContent}</pre>`}</div>
        </body>
      </html>
    `;
    
    const blob = new Blob(['\ufeff', htmlContent], { 
      type: 'application/msword' 
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || `${sanitizedTitle.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.doc`;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    
    // Cleanup after a short delay
    setTimeout(() => {
      try {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } catch (e) {
        // Ignore cleanup errors
      }
    }, 100);
  } catch (error) {
    console.error('Word export error:', error);
    alert('Failed to export Word document: ' + (error.message || 'Unknown error'));
  }
};

/**
 * Convert report data to Excel format
 * @param {Array} reports - Array of report objects
 * @param {string} type - Report type
 */
export const convertReportsToExcel = (reports, type = 'department') => {
  if (!reports || reports.length === 0) {
    return [['No reports available']];
  }
  
  switch (type) {
    case 'department':
      return [
        ['DEPARTMENT REPORTS'],
        [],
        ['Title', 'Department', 'Submitted By', 'Status', 'Created Date'],
        ...reports.map(r => [
          r.title || 'N/A',
          r.department_name || 'N/A',
          r.submitted_by_name || 'N/A',
          r.status || 'N/A',
          new Date(r.created_at).toLocaleDateString()
        ])
      ];
      
    case 'progress':
      return [
        ['PROGRESS REPORTS'],
        [],
        ['Name', 'Date', 'Category', 'Status', 'Department', 'Reported By', 'Created Date'],
        ...reports.map(r => [
          r.name || 'N/A',
          r.date || 'N/A',
          r.category || 'N/A',
          r.status || 'N/A',
          r.department_name || r.department || 'N/A',
          r.created_by_name || 'N/A',
          new Date(r.created_at).toLocaleDateString()
        ])
      ];
      
    case 'staff_client':
      return [
        ['STAFF CLIENT REPORTS'],
        [],
        ['Title', 'Staff', 'Client', 'Department', 'Status', 'Created Date'],
        ...reports.map(r => [
          r.report_title || r.title || 'N/A',
          r.staff_name || 'N/A',
          r.client_name || 'N/A',
          r.department_name || 'N/A',
          r.status || 'N/A',
          new Date(r.created_at || r.submitted_at).toLocaleDateString()
        ])
      ];
      
    default:
      return [['Reports'], ...reports.map(r => Object.values(r))];
  }
};

/**
 * Format staff client report for export
 * @param {Object} report - Report object
 */
export const formatStaffClientReportForExport = (report) => {
  try {
    const data = JSON.parse(report.report_content || '{}');
    let content = `STAFF CLIENT REPORT\n`;
    content += `==================\n\n`;
    content += `Title: ${report.report_title || report.title}\n`;
    content += `Client: ${report.client_name}\n`;
    content += `Staff: ${report.staff_name}\n`;
    content += `Department: ${report.department_name}\n`;
    content += `Status: ${report.status}\n`;
    content += `Created: ${new Date(report.created_at || report.submitted_at).toLocaleString()}\n\n`;
    if (data.reportTitle) content += `Report Title: ${data.reportTitle}\n`;
    if (data.clientName) content += `Client Name: ${data.clientName}\n`;
    if (data.activities) {
      content += `\nActivities:\n`;
      data.activities.forEach((act, idx) => {
        content += `${idx + 1}. ${act.objectiveTaskPerformed || act.description || 'N/A'}\n`;
      });
    }
    return content;
  } catch (e) {
    return report.report_content || '';
  }
};

