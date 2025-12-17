import React, { useState, useEffect } from 'react';
import api from '../../config/api';
import { useAuth } from '../../hooks/useAuth';
import { exportToPDF, exportToExcel, exportToWord, printContent, formatReportForExport, convertReportsToExcel } from '../../utils/exportUtils';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';

const ReportsManagement = () => {
  const { user } = useAuth();
  const [reports, setReports] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [filteredReports, setFilteredReports] = useState([]);
  const [viewingReport, setViewingReport] = useState(null);

  useEffect(() => {
    fetchDepartments();
  }, []);

  useEffect(() => {
    fetchReports();
  }, [activeCategory, selectedDepartment]);

  useEffect(() => {
    filterReports();
  }, [reports, activeCategory, selectedDepartment]);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const allReports = [];
      
      // Fetch department reports (includes Finance reports)
      try {
        const deptResponse = await api.get('/department-reports');
        const deptReports = (deptResponse.data.reports || []).map(r => ({
          ...r,
          reportType: 'department',
          reportTypeLabel: 'Department Report'
        }));
        allReports.push(...deptReports);
      } catch (error) {
        console.error('Error fetching department reports:', error);
      }
      
      // Fetch staff client reports
      try {
        const staffResponse = await api.get('/staff-client-reports');
        const staffReports = (staffResponse.data.reports || []).map(r => ({
          ...r,
          title: r.report_title || 'Client Report',
          reportType: 'staff_client',
          reportTypeLabel: 'Staff Client Report',
          department_name: r.department_name || 'N/A',
          submitted_by_name: r.staff_name || 'N/A',
          created_at: r.created_at || r.submitted_at
        }));
        allReports.push(...staffReports);
      } catch (error) {
        console.error('Error fetching staff client reports:', error);
      }
      
      // Fetch progress reports
      try {
        const progressResponse = await api.get('/progress-reports');
        const progressReports = (progressResponse.data.reports || []).map(r => ({
          ...r,
          title: r.name || 'Progress Report',
          reportType: 'progress',
          reportTypeLabel: 'Progress Report',
          department_name: r.department_name || r.department_full_name || 'N/A',
          submitted_by_name: r.created_by_name || 'N/A',
          content: `Category: ${r.category}\nStatus: ${r.status}\nDate: ${r.date}`
        }));
        allReports.push(...progressReports);
      } catch (error) {
        console.error('Error fetching progress reports:', error);
      }
      
      // Fetch petty cash ledgers (Finance reports) - Admin only
      if (user?.role === 'Admin') {
        try {
          const pettyCashResponse = await api.get('/finance/petty-cash/ledgers');
          const pettyCashReports = (pettyCashResponse.data.ledgers || []).map(r => ({
            ...r,
            title: `Petty Cash Ledger - ${r.month}/${r.year}`,
            reportType: 'petty_cash',
            reportTypeLabel: 'Petty Cash Ledger',
            department_name: 'Finance',
            submitted_by_name: r.created_by_name || 'N/A',
            status: r.approval_status || 'Pending',
            content: `Starting Balance: ${r.starting_balance}\nTotal Deposited: ${r.total_deposited || 0}\nTotal Withdrawn: ${r.total_withdrawn || 0}\nClosing Balance: ${r.closing_balance || 0}`
          }));
          allReports.push(...pettyCashReports);
        } catch (error) {
          console.error('Error fetching petty cash ledgers:', error);
        }
        
        // Fetch assets (Finance reports) - Admin only
        try {
          const assetsResponse = await api.get('/finance/assets');
          const assetReports = (assetsResponse.data.assets || []).map(r => ({
            ...r,
            title: `${r.asset_name} - ${r.asset_id}`,
            reportType: 'asset',
            reportTypeLabel: 'Asset Registry',
            department_name: 'Finance',
            submitted_by_name: r.created_by_name || 'N/A',
            status: r.approval_status || 'Pending',
            content: `Asset ID: ${r.asset_id}\nCategory: ${r.category}\nPurchase Date: ${r.purchase_date}\nPurchase Cost: ${r.purchase_cost}\nCurrent Value: ${r.current_value}\nStatus: ${r.status}`
          }));
          allReports.push(...assetReports);
        } catch (error) {
          console.error('Error fetching assets:', error);
        }
      }
      
      // Filter by department if selected
      let reportsData = allReports;
      if (selectedDepartment !== 'all') {
        reportsData = allReports.filter(report => 
          report.department_name === selectedDepartment
        );
      }
      
      setReports(reportsData);
    } catch (error) {
      console.error('Error fetching reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await api.get('/departments');
      setDepartments(response.data.departments || []);
    } catch (error) {
      console.error('Error fetching departments:', error);
    }
  };

  const filterReports = () => {
    let filtered = [...reports];

    // Filter by category
    if (activeCategory !== 'all') {
      filtered = filtered.filter(report => {
        switch (activeCategory) {
          case 'departments':
            // Department reports (exclude staff client and progress)
            return report.reportType === 'department';
          case 'finance':
            // Finance reports (petty cash and assets)
            return report.reportType === 'petty_cash' || 
                   report.reportType === 'asset' ||
                   report.department_name?.toLowerCase().includes('finance');
          case 'clients':
            // Staff client reports
            return report.reportType === 'staff_client' ||
                   report.title?.toLowerCase().includes('client') || 
                   report.content?.toLowerCase().includes('client');
          case 'partners':
            return report.title?.toLowerCase().includes('partner') || 
                   report.content?.toLowerCase().includes('partner');
          case 'academy':
            return report.department_name?.toLowerCase().includes('academy') ||
                   report.title?.toLowerCase().includes('academy') || 
                   report.title?.toLowerCase().includes('student') ||
                   report.title?.toLowerCase().includes('course') ||
                   report.content?.toLowerCase().includes('academy') ||
                   report.content?.toLowerCase().includes('student') ||
                   report.content?.toLowerCase().includes('course');
          case 'staff':
            return report.reportType === 'staff_client' ||
                   report.reportType === 'progress' ||
                   report.title?.toLowerCase().includes('staff') || 
                   report.content?.toLowerCase().includes('staff');
          default:
            return true;
        }
      });
    }

    // Filter by department
    if (selectedDepartment !== 'all') {
      filtered = filtered.filter(report => report.department_name === selectedDepartment);
    }

    setFilteredReports(filtered);
  };

  const getCategoryCount = (category) => {
    // Use reports for accurate count (before department filter)
    let reportsToCount = reports;
    
    // Apply department filter if selected
    if (selectedDepartment !== 'all') {
      reportsToCount = reports.filter(report => report.department_name === selectedDepartment);
    }
    
    if (category === 'all') return reportsToCount.length;
    
    return reportsToCount.filter(report => {
      switch (category) {
        case 'departments':
          return report.reportType === 'department';
        case 'finance':
          return report.reportType === 'petty_cash' || 
                 report.reportType === 'asset' ||
                 report.department_name?.toLowerCase().includes('finance');
        case 'clients':
          return report.reportType === 'staff_client' ||
                 report.title?.toLowerCase().includes('client') || 
                 report.content?.toLowerCase().includes('client');
        case 'partners':
          return report.title?.toLowerCase().includes('partner') || 
                 report.content?.toLowerCase().includes('partner');
        case 'academy':
          return report.department_name?.toLowerCase().includes('academy') ||
                 report.title?.toLowerCase().includes('academy') || 
                 report.title?.toLowerCase().includes('student') ||
                 report.title?.toLowerCase().includes('course') ||
                 report.content?.toLowerCase().includes('academy') ||
                 report.content?.toLowerCase().includes('student') ||
                 report.content?.toLowerCase().includes('course');
        case 'staff':
          return report.reportType === 'staff_client' ||
                 report.reportType === 'progress' ||
                 report.title?.toLowerCase().includes('staff') || 
                 report.content?.toLowerCase().includes('staff');
        default:
          return true;
      }
    }).length;
  };

  const handleReview = async (reportId, status, comments) => {
    try {
      await api.put(`/department-reports/${reportId}/review`, { 
        status, 
        admin_notes: comments 
      });
      fetchReports();
    } catch (error) {
      console.error('Error reviewing report:', error);
      alert('Error reviewing report: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleViewReport = async (report) => {
    try {
      // If it's a department report, fetch full details
      if (report.reportType === 'department') {
        const response = await api.get(`/department-reports/${report.id}`);
        setViewingReport({ ...response.data.report, reportType: 'department', reportTypeLabel: 'Department Report' });
      } else if (report.reportType === 'petty_cash') {
        // Fetch full petty cash ledger with transactions
        const response = await api.get(`/finance/petty-cash/ledgers/${report.id}`);
        setViewingReport({ ...response.data.ledger, reportType: 'petty_cash', reportTypeLabel: 'Petty Cash Ledger', department_name: 'Finance' });
      } else if (report.reportType === 'asset') {
        // Fetch full asset details
        const response = await api.get(`/finance/assets/${report.id}`);
        setViewingReport({ ...response.data.asset, reportType: 'asset', reportTypeLabel: 'Asset Registry', department_name: 'Finance' });
      } else {
        // For other report types, use the data we already have
        setViewingReport(report);
      }
    } catch (error) {
      console.error('Error fetching report details:', error);
      setViewingReport(report); // Fallback to existing data
    }
  };

  const exportToWordReport = (report) => {
    const content = formatReportForExport(report, report.reportType || 'department');
    // Use centralized exportToWord from exportUtils
    exportToWord(report.title || 'Report', content);
  };

  const formatReportContent = (report) => {
    if (report.reportType === 'staff_client') {
      try {
        const data = JSON.parse(report.report_content || '{}');
        let content = `STAFF CLIENT REPORT\n`;
        content += `==================\n\n`;
        content += `Title: ${report.report_title || report.title}\n`;
        content += `Client: ${report.client_name}\n`;
        content += `Staff: ${report.staff_name}\n`;
        content += `Department: ${report.department_name}\n`;
        content += `Status: ${report.status}\n`;
        content += `Created: ${new Date(report.created_at).toLocaleString()}\n\n`;
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
    } else if (report.reportType === 'petty_cash') {
      let content = `PETTY CASH LEDGER\n`;
      content += `==================\n\n`;
      content += `Period: ${report.month}/${report.year}\n`;
      content += `Custodian: ${report.custodian_name || 'N/A'}\n`;
      content += `Starting Balance: ${report.starting_balance || 0}\n`;
      content += `Total Deposited: ${report.total_deposited || 0}\n`;
      content += `Total Withdrawn: ${report.total_withdrawn || 0}\n`;
      content += `Closing Balance: ${report.closing_balance || 0}\n`;
      content += `Status: ${report.approval_status || 'Pending'}\n`;
      if (report.approved_by_name) {
        content += `Approved By: ${report.approved_by_name}\n`;
      }
      if (report.transactions && report.transactions.length > 0) {
        content += `\nTransactions:\n`;
        report.transactions.forEach((t, idx) => {
          content += `${idx + 1}. Date: ${t.transaction_date}, `;
          if (t.amount_deposited) content += `Deposited: ${t.amount_deposited}, `;
          if (t.amount_withdrawn) content += `Withdrawn: ${t.amount_withdrawn}, `;
          content += `Description: ${t.description || 'N/A'}\n`;
        });
      }
      return content;
    } else if (report.reportType === 'asset') {
      let content = `ASSET REGISTRY\n`;
      content += `===============\n\n`;
      content += `Asset ID: ${report.asset_id}\n`;
      content += `Asset Name: ${report.asset_name}\n`;
      content += `Category: ${report.category}\n`;
      content += `Purchase Date: ${report.purchase_date || 'N/A'}\n`;
      content += `Purchase Cost: ${report.purchase_cost || 0}\n`;
      content += `Current Value: ${report.current_value || 0}\n`;
      content += `Status: ${report.status || 'N/A'}\n`;
      content += `Location: ${report.location || 'N/A'}\n`;
      content += `Custodian: ${report.custodian_name || 'N/A'}\n`;
      content += `Approval Status: ${report.approval_status || 'Pending'}\n`;
      if (report.description) {
        content += `Description: ${report.description}\n`;
      }
      return content;
    }
    return formatReportForExport(report, report.reportType || 'department');
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

  const categories = [
    { id: 'all', label: 'All Reports', icon: 'bi-list-ul' },
    { id: 'departments', label: 'Departments', icon: 'bi-building' },
    { id: 'finance', label: 'Finance', icon: 'bi-cash-coin' },
    { id: 'clients', label: 'Clients', icon: 'bi-person-badge' },
    { id: 'partners', label: 'Partners', icon: 'bi-handshake' },
    { id: 'academy', label: 'Academy', icon: 'bi-book' },
    { id: 'staff', label: 'Staff', icon: 'bi-people' }
  ];

  return (
    <div className="container-fluid">
      <div className="row mb-4">
        <div className="col-12 d-flex justify-content-between align-items-center">
          <h1 className="h3 mb-0">Reports Management</h1>
          {user?.role !== 'Admin' && (
            <button className="btn btn-primary">
              <i className="bi bi-plus-circle me-2"></i>Submit Report
            </button>
          )}
        </div>
      </div>

      {/* Category Tabs */}
      <div className="card mb-4">
        <div className="card-body">
          <div className="d-flex flex-wrap gap-2 mb-3">
            {categories.map((category) => (
              <button
                key={category.id}
                className={`btn ${activeCategory === category.id ? 'btn-primary' : 'btn-outline-primary'}`}
                onClick={() => setActiveCategory(category.id)}
              >
                <i className={`bi ${category.icon} me-2`}></i>
                {category.label}
                <span className="badge bg-light text-dark ms-2">{getCategoryCount(category.id)}</span>
              </button>
            ))}
          </div>

          {/* Department Filter */}
          {(activeCategory === 'departments' || activeCategory === 'all' || activeCategory === 'finance') ? (
            <div className="mb-3">
              <label className="form-label">Filter by Department:</label>
              <select
                className="form-select"
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                style={{ maxWidth: '300px' }}
              >
                <option value="all">All Departments</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.name}>
                    {dept.name}
                  </option>
                ))}
                {activeCategory === 'finance' && (
                  <option value="Finance">Finance</option>
                )}
              </select>
            </div>
          ) : null}
        </div>
      </div>

      {/* Export All Button - Admin Only */}
      {user?.role === 'Admin' && filteredReports.length > 0 && (
        <div className="card mb-4">
          <div className="card-body">
            <div className="d-flex gap-2 flex-wrap">
              <button
                className="btn btn-outline-secondary"
                onClick={() => {
                  const content = filteredReports.map(r => formatReportContent(r)).join('\n\n---\n\n');
                  printContent('All Reports', content);
                }}
              >
                <i className="bi bi-printer me-2"></i>Print All
              </button>
              <button
                className="btn btn-outline-danger"
                onClick={() => {
                  const content = filteredReports.map(r => formatReportContent(r)).join('\n\n---\n\n');
                  exportToPDF('All Reports', content);
                }}
              >
                <i className="bi bi-file-pdf me-2"></i>Export All to PDF
              </button>
              <button
                className="btn btn-outline-primary"
                onClick={() => {
                  filteredReports.forEach(r => exportToWord(r));
                }}
              >
                <i className="bi bi-file-word me-2"></i>Export All to Word
              </button>
              <button
                className="btn btn-outline-success"
                onClick={() => {
                  const excelData = [
                    ['REPORTS EXPORT'],
                    [],
                    ['Title', 'Type', 'Department', 'Submitted By', 'Status', 'Date'],
                    ...filteredReports.map(r => [
                      r.title || 'N/A',
                      r.reportTypeLabel || 'N/A',
                      r.department_name || 'N/A',
                      r.submitted_by_name || r.staff_name || 'N/A',
                      r.status || 'N/A',
                      new Date(r.created_at || r.submitted_at).toLocaleDateString()
                    ])
                  ];
                  exportToExcel('All Reports', excelData);
                }}
              >
                <i className="bi bi-file-excel me-2"></i>Export All to Excel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reports Table */}
      <div className="card">
        <div className="card-body">
          <div className="table-responsive">
            <table className="table table-hover">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Type</th>
                  <th>Department</th>
                  <th>Submitted By</th>
                  <th>Status</th>
                  <th>Submitted Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredReports.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center text-muted">
                      No reports found in this category
                    </td>
                  </tr>
                ) : (
                  filteredReports.map((report) => (
                    <tr key={`${report.reportType || 'dept'}-${report.id}`}>
                      <td>
                        <strong>{report.title}</strong>
                        {report.reportTypeLabel && (
                          <>
                            <br />
                            <small className="text-muted">{report.reportTypeLabel}</small>
                          </>
                        )}
                        {report.content && report.content.length > 50 && (
                          <>
                            <br />
                            <small className="text-muted">
                              {report.content.substring(0, 50)}...
                            </small>
                          </>
                        )}
                      </td>
                      <td>
                        <span className="badge bg-info">{report.reportTypeLabel || 'Department'}</span>
                      </td>
                      <td>{report.department_name || 'N/A'}</td>
                      <td>{report.submitted_by_name || report.staff_name || report.submitted_by_email || 'N/A'}</td>
                      <td>
                        <span className={`badge bg-${
                          report.status === 'Approved' || report.status === 'Final_Approved' || report.status === 'Marketing_Manager_Approved' ? 'success' :
                          report.status === 'Rejected' ? 'danger' : 'warning'
                        }`}>
                          {report.status}
                        </span>
                      </td>
                      <td>{report.submitted_at || report.created_at ? new Date(report.submitted_at || report.created_at).toLocaleDateString() : 'N/A'}</td>
                      <td>
                        <div className="btn-group" role="group">
                          <button 
                            className="btn btn-sm btn-outline-primary"
                            onClick={() => handleViewReport(report)}
                            title="View Report"
                          >
                            <i className="bi bi-eye"></i>
                          </button>
                          {(user?.role === 'Admin' || report.status === 'Approved' || report.status === 'Final_Approved' || report.status === 'Marketing_Manager_Approved') && (
                            <>
                              <button
                                className="btn btn-sm btn-outline-secondary"
                                onClick={() => printContent(report.title || 'Report', formatReportContent(report))}
                                title="Print"
                              >
                                <i className="bi bi-printer"></i>
                              </button>
                              <button
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => exportToPDF(report.title || 'Report', formatReportContent(report))}
                                title="Export to PDF"
                              >
                                <i className="bi bi-file-pdf"></i>
                              </button>
                              <button
                                className="btn btn-sm btn-outline-primary"
                                onClick={() => exportToWord(report)}
                                title="Export to Word"
                              >
                                <i className="bi bi-file-word"></i>
                              </button>
                              <button
                                className="btn btn-sm btn-outline-success"
                                onClick={() => {
                                  let excelData = [];
                                  if (report.reportType === 'petty_cash') {
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
                                    if (report.transactions && report.transactions.length > 0) {
                                      excelData.push([], ['TRANSACTIONS'], ['Date', 'Deposited', 'Withdrawn', 'Description']);
                                      report.transactions.forEach(t => {
                                        excelData.push([
                                          t.transaction_date,
                                          t.amount_deposited || 0,
                                          t.amount_withdrawn || 0,
                                          t.description || ''
                                        ]);
                                      });
                                    }
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
                                      ['Status', report.status || 'N/A'],
                                      ['Location', report.location || 'N/A'],
                                      ['Custodian', report.custodian_name || 'N/A'],
                                      ['Approval Status', report.approval_status || 'Pending']
                                    ];
                                  } else {
                                    excelData = [
                                      [report.title || 'Report'],
                                      [],
                                      ['Field', 'Value'],
                                      ['Type', report.reportTypeLabel || 'N/A'],
                                      ['Department', report.department_name || 'N/A'],
                                      ['Submitted By', report.submitted_by_name || report.staff_name || 'N/A'],
                                      ['Status', report.status || 'N/A'],
                                      ['Date', new Date(report.created_at || report.submitted_at).toLocaleDateString()],
                                      [],
                                      ['Content', formatReportContent(report)]
                                    ];
                                  }
                                  exportToExcel(report.title || 'Report', excelData);
                                }}
                                title="Export to Excel"
                              >
                                <i className="bi bi-file-excel"></i>
                              </button>
                            </>
                          )}
                        </div>
                        {user?.role === 'Admin' && report.reportType === 'department' && (report.status === 'Pending' || report.status === 'Pending_Admin') && (
                          <div className="mt-1">
                            <button
                              className="btn btn-sm btn-outline-success me-1"
                              onClick={() => {
                                const comments = prompt('Admin notes (optional):');
                                handleReview(report.id, 'Approved', comments || '');
                              }}
                            >
                              Approve
                            </button>
                            <button
                              className="btn btn-sm btn-outline-danger"
                              onClick={() => {
                                const comments = prompt('Rejection reason (required):');
                                if (comments) {
                                  handleReview(report.id, 'Rejected', comments);
                                }
                              }}
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* View Report Modal */}
      {viewingReport && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} tabIndex="-1">
          <div className="modal-dialog modal-lg modal-dialog-scrollable">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">{viewingReport.title || 'Report Details'}</h5>
                <button type="button" className="btn-close" onClick={() => setViewingReport(null)}></button>
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <strong>Type:</strong> {viewingReport.reportTypeLabel || 'Department Report'}<br />
                  <strong>Department:</strong> {viewingReport.department_name || 'N/A'}<br />
                  <strong>Submitted By:</strong> {viewingReport.submitted_by_name || viewingReport.staff_name || 'N/A'}<br />
                  <strong>Status:</strong> <span className={`badge bg-${
                    viewingReport.status === 'Approved' || viewingReport.status === 'Final_Approved' ? 'success' :
                    viewingReport.status === 'Rejected' ? 'danger' : 'warning'
                  }`}>{viewingReport.status}</span><br />
                  <strong>Date:</strong> {new Date(viewingReport.created_at || viewingReport.submitted_at).toLocaleString()}
                </div>
                <div className="border-top pt-3">
                  <strong>Content:</strong>
                  <pre className="mt-2 p-3 bg-light" style={{ whiteSpace: 'pre-wrap', maxHeight: '400px', overflow: 'auto' }}>
                    {formatReportContent(viewingReport)}
                  </pre>
                </div>
                {viewingReport.admin_notes && (
                  <div className="border-top pt-3 mt-3">
                    <strong>Admin Notes:</strong>
                    <p className="mt-2">{viewingReport.admin_notes}</p>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <div className="btn-group" role="group">
                  <button
                    className="btn btn-outline-secondary"
                    onClick={() => printContent(viewingReport.title || 'Report', formatReportContent(viewingReport))}
                  >
                    <i className="bi bi-printer me-2"></i>Print
                  </button>
                  <button
                    className="btn btn-outline-danger"
                    onClick={() => exportToPDF(viewingReport.title || 'Report', formatReportContent(viewingReport))}
                  >
                    <i className="bi bi-file-pdf me-2"></i>PDF
                  </button>
                  <button
                    className="btn btn-outline-primary"
                    onClick={() => exportToWord(viewingReport)}
                  >
                    <i className="bi bi-file-word me-2"></i>Word
                  </button>
                  <button
                    className="btn btn-outline-success"
                    onClick={() => {
                      let excelData = [];
                      if (viewingReport.reportType === 'petty_cash') {
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
                        if (viewingReport.transactions && viewingReport.transactions.length > 0) {
                          excelData.push([], ['TRANSACTIONS'], ['Date', 'Deposited', 'Withdrawn', 'Description']);
                          viewingReport.transactions.forEach(t => {
                            excelData.push([
                              t.transaction_date,
                              t.amount_deposited || 0,
                              t.amount_withdrawn || 0,
                              t.description || ''
                            ]);
                          });
                        }
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
                          ['Status', viewingReport.status || 'N/A'],
                          ['Location', viewingReport.location || 'N/A'],
                          ['Custodian', viewingReport.custodian_name || 'N/A'],
                          ['Approval Status', viewingReport.approval_status || 'Pending']
                        ];
                      } else {
                        excelData = [
                          [viewingReport.title || 'Report'],
                          [],
                          ['Field', 'Value'],
                          ['Type', viewingReport.reportTypeLabel || 'N/A'],
                          ['Department', viewingReport.department_name || 'N/A'],
                          ['Submitted By', viewingReport.submitted_by_name || viewingReport.staff_name || 'N/A'],
                          ['Status', viewingReport.status || 'N/A'],
                          ['Date', new Date(viewingReport.created_at || viewingReport.submitted_at).toLocaleDateString()],
                          [],
                          ['Content', formatReportContent(viewingReport)]
                        ];
                      }
                      exportToExcel(viewingReport.title || 'Report', excelData);
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

export default ReportsManagement;
