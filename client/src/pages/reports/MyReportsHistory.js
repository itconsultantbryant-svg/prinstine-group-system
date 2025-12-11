import React, { useState, useEffect } from 'react';
import api from '../../config/api';
import { useAuth } from '../../hooks/useAuth';
import { exportToPDF, exportToExcel, exportToWord, printContent, formatReportForExport, formatStaffClientReportForExport, convertReportsToExcel } from '../../utils/exportUtils';

const MyReportsHistory = () => {
  const { user } = useAuth();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewingReport, setViewingReport] = useState(null);
  const [filter, setFilter] = useState('all'); // all, submitted, approved
  const [reportTypeFilter, setReportTypeFilter] = useState('all'); // all, department, staff_client, progress

  useEffect(() => {
    fetchReports();
  }, [filter, reportTypeFilter]);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const response = await api.get('/my-reports-history/my-history');
      let allReports = response.data.reports || [];
      
      // Apply filters
      if (filter !== 'all') {
        if (filter === 'submitted') {
          allReports = allReports.filter(r => r.submitted_by === user.id || r.staff_id === user.id || r.created_by === user.id);
        } else if (filter === 'approved') {
          allReports = allReports.filter(r => 
            r.reviewed_by === user.id || 
            r.dept_head_reviewed_by === user.id || 
            r.marketing_manager_id === user.id ||
            r.admin_id === user.id ||
            r.approved_by_id === user.id
          );
        }
      }
      
      if (reportTypeFilter !== 'all') {
        allReports = allReports.filter(r => r.reportType === reportTypeFilter);
      }
      
      // Sort by date descending
      allReports.sort((a, b) => {
        const dateA = new Date(a.created_at || a.submitted_at || a.date_acquired);
        const dateB = new Date(b.created_at || b.submitted_at || b.date_acquired);
        return dateB - dateA;
      });
      
      setReports(allReports);
    } catch (error) {
      console.error('Error fetching reports history:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewReport = async (report) => {
    try {
      if (report.reportType === 'department') {
        const response = await api.get(`/department-reports/${report.id}`);
        setViewingReport({ ...response.data.report, reportType: 'department', reportTypeLabel: 'Department Report' });
      } else if (report.reportType === 'staff_client') {
        const response = await api.get(`/staff-client-reports/${report.id}`);
        setViewingReport({ ...response.data.report, reportType: 'staff_client', reportTypeLabel: 'Staff Client Report' });
      } else if (report.reportType === 'petty_cash') {
        const response = await api.get(`/finance/petty-cash/ledgers/${report.id}`);
        setViewingReport({ ...response.data.ledger, reportType: 'petty_cash', reportTypeLabel: 'Petty Cash Ledger', department_name: 'Finance' });
      } else if (report.reportType === 'asset') {
        const response = await api.get(`/finance/assets/${report.id}`);
        setViewingReport({ ...response.data.asset, reportType: 'asset', reportTypeLabel: 'Asset Registry', department_name: 'Finance' });
      } else {
        setViewingReport(report);
      }
    } catch (error) {
      console.error('Error fetching report details:', error);
      setViewingReport(report);
    }
  };

  const formatReportContent = (report) => {
    if (report.reportType === 'staff_client') {
      return formatStaffClientReportForExport(report);
    } else if (report.reportType === 'petty_cash') {
      let content = `PETTY CASH LEDGER\n==================\n\nPeriod: ${report.month}/${report.year}\nCustodian: ${report.custodian_name || 'N/A'}\nStarting Balance: ${report.starting_balance || 0}\nTotal Deposited: ${report.total_deposited || 0}\nTotal Withdrawn: ${report.total_withdrawn || 0}\nClosing Balance: ${report.closing_balance || 0}\nStatus: ${report.approval_status || 'Pending'}`;
      if (report.transactions && report.transactions.length > 0) {
        content += `\n\nTransactions:\n`;
        report.transactions.forEach((t, idx) => {
          content += `${idx + 1}. Date: ${t.transaction_date}, `;
          if (t.amount_deposited) content += `Deposited: ${t.amount_deposited}, `;
          if (t.amount_withdrawn) content += `Withdrawn: ${t.amount_withdrawn}, `;
          content += `Description: ${t.description || 'N/A'}\n`;
        });
      }
      return content;
    } else if (report.reportType === 'asset') {
      return `ASSET REGISTRY\n===============\n\nAsset ID: ${report.asset_id}\nAsset Name: ${report.asset_name}\nCategory: ${report.category}\nPurchase Date: ${report.purchase_date || 'N/A'}\nPurchase Cost: ${report.purchase_cost || 0}\nCurrent Value: ${report.current_value || 0}\nStatus: ${report.status || 'N/A'}\nLocation: ${report.location || 'N/A'}\nCustodian: ${report.custodian_name || 'N/A'}\nApproval Status: ${report.approval_status || 'Pending'}`;
    }
    return formatReportForExport(report, report.reportType || 'department');
  };

  const getRoleInReport = (report) => {
    if (report.submitted_by === user.id || report.staff_id === user.id || report.created_by === user.id) {
      return 'Submitted';
    }
    if (report.reviewed_by === user.id || report.dept_head_reviewed_by === user.id) {
      return 'Reviewed';
    }
    if (report.marketing_manager_id === user.id) {
      return 'Approved (Marketing Manager)';
    }
    if (report.admin_id === user.id || report.approved_by_id === user.id) {
      return 'Approved (Admin)';
    }
    return 'Related';
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid">
      <div className="row mb-4">
        <div className="col-12">
          <h1 className="h3 mb-0">My Reports History</h1>
          <p className="text-muted">View all reports you've submitted or approved</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card mb-4">
        <div className="card-body">
          <div className="row">
            <div className="col-md-4">
              <label className="form-label">Filter by Role:</label>
              <select
                className="form-select"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="all">All Reports</option>
                <option value="submitted">Reports I Submitted</option>
                <option value="approved">Reports I Approved</option>
              </select>
            </div>
            <div className="col-md-4">
              <label className="form-label">Filter by Type:</label>
              <select
                className="form-select"
                value={reportTypeFilter}
                onChange={(e) => setReportTypeFilter(e.target.value)}
              >
                <option value="all">All Types</option>
                <option value="department">Department Reports</option>
                <option value="staff_client">Staff Client Reports</option>
                <option value="progress">Progress Reports</option>
                <option value="petty_cash">Petty Cash Ledgers</option>
                <option value="asset">Asset Registry</option>
              </select>
            </div>
            <div className="col-md-4 d-flex align-items-end">
              <div>
                <strong>Total Reports:</strong> {reports.length}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Reports Table */}
      <div className="card">
        <div className="card-body">
          {reports.length === 0 ? (
            <div className="text-center py-5">
              <i className="bi bi-file-text" style={{ fontSize: '3rem', color: '#ccc' }}></i>
              <p className="text-muted mt-3">No reports found in your history</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Title</th>
                    <th>Department</th>
                    <th>Status</th>
                    <th>My Role</th>
                    <th>Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((report) => (
                    <tr key={`${report.reportType || 'dept'}-${report.id}`}>
                      <td>
                        <span className="badge bg-info">{report.reportTypeLabel || report.reportType || 'Department'}</span>
                      </td>
                      <td>
                        <strong>{report.title || report.report_title || report.asset_name || `Petty Cash - ${report.month}/${report.year}`}</strong>
                      </td>
                      <td>{report.department_name || 'N/A'}</td>
                      <td>
                        <span className={`badge bg-${
                          report.status === 'Approved' || report.status === 'Final_Approved' || report.approval_status === 'Approved' ? 'success' :
                          report.status === 'Rejected' || report.approval_status === 'Rejected' ? 'danger' : 'warning'
                        }`}>
                          {report.status || report.approval_status || 'Pending'}
                        </span>
                      </td>
                      <td>
                        <span className="badge bg-secondary">{getRoleInReport(report)}</span>
                      </td>
                      <td>
                        {report.created_at || report.submitted_at || report.date_acquired
                          ? new Date(report.created_at || report.submitted_at || report.date_acquired).toLocaleDateString()
                          : 'N/A'}
                      </td>
                      <td>
                        <div className="btn-group" role="group">
                          <button
                            className="btn btn-sm btn-outline-primary"
                            onClick={() => handleViewReport(report)}
                            title="View Report"
                          >
                            <i className="bi bi-eye"></i>
                          </button>
                          <button
                            className="btn btn-sm btn-outline-secondary"
                            onClick={() => printContent(report.title || report.report_title || 'Report', formatReportContent(report))}
                            title="Print"
                          >
                            <i className="bi bi-printer"></i>
                          </button>
                          <button
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => exportToPDF(report.title || report.report_title || 'Report', formatReportContent(report))}
                            title="Export to PDF"
                          >
                            <i className="bi bi-file-pdf"></i>
                          </button>
                          <button
                            className="btn btn-sm btn-outline-primary"
                            onClick={() => exportToWord(report.title || report.report_title || 'Report', formatReportContent(report))}
                            title="Export to Word"
                          >
                            <i className="bi bi-file-word"></i>
                          </button>
                          <button
                            className="btn btn-sm btn-outline-success"
                            onClick={() => {
                              let excelData = [];
                              if (report.reportType === 'staff_client') {
                                excelData = [
                                  [report.report_title || 'Report'],
                                  [],
                                  ['Field', 'Value'],
                                  ['Staff', report.staff_name || 'N/A'],
                                  ['Client', report.client_name || 'N/A'],
                                  ['Department', report.department_name || 'N/A'],
                                  ['Status', report.status || 'N/A'],
                                  ['Date', new Date(report.created_at || report.submitted_at).toLocaleDateString()],
                                  [],
                                  ['Content', formatReportContent(report)]
                                ];
                              } else if (report.reportType === 'petty_cash') {
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
                              } else if (report.reportType === 'asset') {
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
                              } else {
                                excelData = convertReportsToExcel([report], report.reportType || 'department');
                              }
                              exportToExcel(report.title || report.report_title || 'Report', excelData);
                            }}
                            title="Export to Excel"
                          >
                            <i className="bi bi-file-excel"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* View Report Modal */}
      {viewingReport && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} tabIndex="-1">
          <div className="modal-dialog modal-lg modal-dialog-scrollable">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">{viewingReport.title || viewingReport.report_title || 'Report Details'}</h5>
                <button type="button" className="btn-close" onClick={() => setViewingReport(null)}></button>
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <strong>Type:</strong> {viewingReport.reportTypeLabel || 'Department Report'}<br />
                  <strong>Department:</strong> {viewingReport.department_name || 'N/A'}<br />
                  <strong>Status:</strong> <span className={`badge bg-${
                    viewingReport.status === 'Approved' || viewingReport.status === 'Final_Approved' ? 'success' :
                    viewingReport.status === 'Rejected' ? 'danger' : 'warning'
                  }`}>{viewingReport.status || viewingReport.approval_status}</span><br />
                  <strong>Date:</strong> {new Date(viewingReport.created_at || viewingReport.submitted_at).toLocaleString()}
                </div>
                <div className="border-top pt-3">
                  <strong>Content:</strong>
                  <pre className="mt-2 p-3 bg-light" style={{ whiteSpace: 'pre-wrap', maxHeight: '400px', overflow: 'auto' }}>
                    {formatReportContent(viewingReport)}
                  </pre>
                </div>
              </div>
              <div className="modal-footer">
                <div className="btn-group" role="group">
                  <button
                    className="btn btn-outline-secondary"
                    onClick={() => printContent(viewingReport.title || viewingReport.report_title || 'Report', formatReportContent(viewingReport))}
                  >
                    <i className="bi bi-printer me-2"></i>Print
                  </button>
                  <button
                    className="btn btn-outline-danger"
                    onClick={() => exportToPDF(viewingReport.title || viewingReport.report_title || 'Report', formatReportContent(viewingReport))}
                  >
                    <i className="bi bi-file-pdf me-2"></i>PDF
                  </button>
                  <button
                    className="btn btn-outline-primary"
                    onClick={() => exportToWord(viewingReport.title || viewingReport.report_title || 'Report', formatReportContent(viewingReport))}
                  >
                    <i className="bi bi-file-word me-2"></i>Word
                  </button>
                  <button
                    className="btn btn-outline-success"
                    onClick={() => {
                      let excelData = [];
                      if (viewingReport.reportType === 'staff_client') {
                        excelData = [
                          [viewingReport.report_title || 'Report'],
                          [],
                          ['Field', 'Value'],
                          ['Staff', viewingReport.staff_name || 'N/A'],
                          ['Client', viewingReport.client_name || 'N/A'],
                          ['Department', viewingReport.department_name || 'N/A'],
                          ['Status', viewingReport.status || 'N/A'],
                          ['Date', new Date(viewingReport.created_at || viewingReport.submitted_at).toLocaleDateString()],
                          [],
                          ['Content', formatReportContent(viewingReport)]
                        ];
                      } else if (viewingReport.reportType === 'petty_cash') {
                        excelData = [
                          ['PETTY CASH LEDGER'],
                          [],
                          ['Period', `${viewingReport.month}/${viewingReport.year}`],
                          ['Custodian', viewingReport.custodian_name || 'N/A'],
                          ['Starting Balance', viewingReport.starting_balance || 0],
                          ['Total Deposited', viewingReport.total_deposited || 0],
                          ['Total Withdrawn', viewingReport.total_withdrawn || 0],
                          ['Closing Balance', viewingReport.closing_balance || 0],
                          ['Status', viewingReport.approval_status || 'Pending']
                        ];
                      } else if (viewingReport.reportType === 'asset') {
                        excelData = [
                          ['ASSET REGISTRY'],
                          [],
                          ['Asset ID', viewingReport.asset_id],
                          ['Asset Name', viewingReport.asset_name],
                          ['Category', viewingReport.category],
                          ['Purchase Date', viewingReport.purchase_date || 'N/A'],
                          ['Purchase Cost', viewingReport.purchase_cost || 0],
                          ['Current Value', viewingReport.current_value || 0],
                          ['Status', viewingReport.status || 'N/A']
                        ];
                      } else {
                        excelData = convertReportsToExcel([viewingReport], viewingReport.reportType || 'department');
                      }
                      exportToExcel(viewingReport.title || viewingReport.report_title || 'Report', excelData);
                    }}
                  >
                    <i className="bi bi-file-excel me-2"></i>Excel
                  </button>
                </div>
                <button
                  className="btn btn-secondary"
                  onClick={() => setViewingReport(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyReportsHistory;

