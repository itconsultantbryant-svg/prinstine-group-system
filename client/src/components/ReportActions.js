import React from 'react';
import { exportToPDF, exportToExcel, exportToWord, printContent, formatReportForExport, formatStaffClientReportForExport, convertReportsToExcel } from '../utils/exportUtils';

/**
 * Reusable component for report actions (Print, PDF, Word, Excel)
 * Can be used across all report types in the system
 */
const ReportActions = ({ report, reportType = 'department', size = 'sm', showLabels = false }) => {
  const handleExport = (format) => {
    let content, title, excelData;
    
    switch (reportType) {
      case 'staff_client':
        title = report.report_title || report.title || 'Client Report';
        content = formatStaffClientReportForExport(report);
        excelData = [
          [title],
          [],
          ['Field', 'Value'],
          ['Staff', report.staff_name || 'N/A'],
          ['Client', report.client_name || 'N/A'],
          ['Department', report.department_name || 'N/A'],
          ['Status', report.status || 'N/A'],
          ['Date', new Date(report.created_at || report.submitted_at).toLocaleDateString()],
          [],
          ['Content', content]
        ];
        break;
      case 'progress':
        title = report.name || report.title || 'Progress Report';
        content = formatReportForExport(report, 'progress');
        excelData = convertReportsToExcel([report], 'progress');
        break;
      case 'petty_cash':
        title = `Petty Cash Ledger - ${report.month}/${report.year}`;
        content = `PETTY CASH LEDGER\n==================\n\nPeriod: ${report.month}/${report.year}\nCustodian: ${report.custodian_name || 'N/A'}\nStarting Balance: ${report.starting_balance || 0}\nTotal Deposited: ${report.total_deposited || 0}\nTotal Withdrawn: ${report.total_withdrawn || 0}\nClosing Balance: ${report.closing_balance || 0}\nStatus: ${report.approval_status || 'Pending'}`;
        excelData = [
          ['PETTY CASH LEDGER'],
          [],
          ['Period', `${report.month}/${report.year}`],
          ['Custodian', report.custodian_name || 'N/A'],
          ['Starting Balance', report.starting_balance || 0],
          ['Total Deposited', report.total_deposited || 0],
          ['Total Withdrawn', report.total_withdrawn || 0],
          ['Closing Balance', report.closing_balance || 0],
          ['Status', report.approval_status || 'Pending']
        ];
        break;
      case 'asset':
        title = `${report.asset_name} - ${report.asset_id}`;
        content = `ASSET REGISTRY\n===============\n\nAsset ID: ${report.asset_id}\nAsset Name: ${report.asset_name}\nCategory: ${report.category}\nPurchase Date: ${report.purchase_date || 'N/A'}\nPurchase Cost: ${report.purchase_cost || 0}\nCurrent Value: ${report.current_value || 0}\nStatus: ${report.status || 'N/A'}`;
        excelData = [
          ['ASSET REGISTRY'],
          [],
          ['Asset ID', report.asset_id],
          ['Asset Name', report.asset_name],
          ['Category', report.category],
          ['Purchase Date', report.purchase_date || 'N/A'],
          ['Purchase Cost', report.purchase_cost || 0],
          ['Current Value', report.current_value || 0],
          ['Status', report.status || 'N/A']
        ];
        break;
      default: // department
        title = report.title || 'Department Report';
        content = formatReportForExport(report, 'department');
        excelData = convertReportsToExcel([report], 'department');
    }
    
    switch (format) {
      case 'print':
        printContent(title, content);
        break;
      case 'pdf':
        exportToPDF(title, content);
        break;
      case 'word':
        exportToWord(title, content);
        break;
      case 'excel':
        exportToExcel(title, excelData);
        break;
    }
  };

  const btnClass = size === 'sm' ? 'btn-sm' : '';
  const labelClass = showLabels ? 'me-1' : '';

  return (
    <div className="btn-group" role="group">
      <button
        className={`btn btn-outline-secondary ${btnClass}`}
        onClick={() => handleExport('print')}
        title="Print Report"
      >
        <i className={`bi bi-printer ${labelClass}`}></i>
        {showLabels && 'Print'}
      </button>
      <button
        className={`btn btn-outline-danger ${btnClass}`}
        onClick={() => handleExport('pdf')}
        title="Export to PDF"
      >
        <i className={`bi bi-file-pdf ${labelClass}`}></i>
        {showLabels && 'PDF'}
      </button>
      <button
        className={`btn btn-outline-primary ${btnClass}`}
        onClick={() => handleExport('word')}
        title="Export to Word"
      >
        <i className={`bi bi-file-word ${labelClass}`}></i>
        {showLabels && 'Word'}
      </button>
      <button
        className={`btn btn-outline-success ${btnClass}`}
        onClick={() => handleExport('excel')}
        title="Export to Excel"
      >
        <i className={`bi bi-file-excel ${labelClass}`}></i>
        {showLabels && 'Excel'}
      </button>
    </div>
  );
};

export default ReportActions;

