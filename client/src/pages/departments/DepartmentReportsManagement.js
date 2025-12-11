import React, { useState, useEffect } from 'react';
import api from '../../config/api';
import { exportToPDF, exportToExcel, printContent, formatReportForExport, convertReportsToExcel } from '../../utils/exportUtils';
import './DepartmentReportsManagement.css';

const getFileIcon = (mimetype) => {
  if (!mimetype) return 'bi-file-earmark';
  if (mimetype.includes('pdf')) return 'bi-file-pdf';
  if (mimetype.includes('word') || mimetype.includes('document')) return 'bi-file-word';
  if (mimetype.includes('excel') || mimetype.includes('spreadsheet')) return 'bi-file-excel';
  if (mimetype.includes('powerpoint') || mimetype.includes('presentation')) return 'bi-file-ppt';
  if (mimetype.includes('image')) return 'bi-file-image';
  if (mimetype.includes('zip') || mimetype.includes('rar')) return 'bi-file-zip';
  return 'bi-file-earmark';
};

const DepartmentReportsManagement = () => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState(null);
  const [viewingReport, setViewingReport] = useState(null);
  const [reviewData, setReviewData] = useState({
    status: 'Approved',
    admin_notes: ''
  });

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const response = await api.get('/department-reports');
      setReports(response.data.reports || []);
    } catch (error) {
      console.error('Error fetching reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async (reportId) => {
    try {
      await api.put(`/department-reports/${reportId}/review`, reviewData);
      alert(`Report ${reviewData.status.toLowerCase()} successfully`);
      setSelectedReport(null);
      setReviewData({ status: 'Approved', admin_notes: '' });
      fetchReports();
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to review report');
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      'Pending': 'warning',
      'Pending_DeptHead': 'info',
      'DepartmentHead_Approved': 'info',
      'DepartmentHead_Rejected': 'danger',
      'Approved': 'success',
      'Rejected': 'danger',
      'Final_Approved': 'success'
    };
    return badges[status] || 'secondary';
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const parseReportContent = (content) => {
    if (!content) return [];
    
    const lines = content.split('\n');
    const sections = [];
    let currentSection = null;
    
    lines.forEach((line) => {
      const trimmed = line.trim();
      
      // Detect section headers (numbered sections or all caps headers)
      if (trimmed.match(/^\d+\.\s+[A-Z]/) || 
          (trimmed.length > 0 && trimmed === trimmed.toUpperCase() && 
           trimmed.length < 60 && !trimmed.includes(':') && 
           !trimmed.startsWith('•') && !trimmed.startsWith('-'))) {
        if (currentSection) {
          sections.push(currentSection);
        }
        currentSection = {
          type: 'section',
          title: trimmed,
          content: []
        };
      } else if (trimmed.startsWith('---') || trimmed.startsWith('===')) {
        if (currentSection) {
          currentSection.content.push({ type: 'divider' });
        }
      } else if (trimmed.length > 0) {
        if (!currentSection) {
          currentSection = { type: 'section', title: 'Report Content', content: [] };
        }
        
        if (trimmed.startsWith('•') || trimmed.startsWith('-')) {
          currentSection.content.push({ type: 'bullet', text: trimmed.substring(1).trim() });
        } else if (trimmed.match(/^\d+\.\s/)) {
          currentSection.content.push({ type: 'numbered', text: trimmed });
        } else if (trimmed.includes(':')) {
          const [key, ...valueParts] = trimmed.split(':');
          const value = valueParts.join(':').trim();
          currentSection.content.push({ type: 'field', key: key.trim(), value });
        } else {
          currentSection.content.push({ type: 'text', text: trimmed });
        }
      } else if (currentSection) {
        currentSection.content.push({ type: 'spacer' });
      }
    });
    
    if (currentSection) {
      sections.push(currentSection);
    }
    
    return sections;
  };

  const handleViewFullReport = async (reportId) => {
    try {
      const response = await api.get(`/department-reports/${reportId}`);
      setViewingReport(response.data.report);
    } catch (error) {
      console.error('Error fetching report:', error);
      alert('Failed to load report details');
    }
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
          <h1 className="h3 mb-0">Department Reports Management</h1>
          <p className="text-muted">Review and approve/reject department reports</p>
        </div>
      </div>

      <div className="row mb-3">
        <div className="col-12">
          <div className="btn-group" role="group">
            <button
              className="btn btn-outline-primary"
              onClick={() => {
                if (reports.length > 0) {
                  exportToPDF('All Department Reports', reports.map(r => formatReportForExport(r, 'department')).join('\n\n---\n\n'));
                }
              }}
              disabled={reports.length === 0}
            >
              <i className="bi bi-file-pdf me-2"></i>Export All to PDF
            </button>
            <button
              className="btn btn-outline-success"
              onClick={() => {
                if (reports.length > 0) {
                  exportToExcel('All Department Reports', convertReportsToExcel(reports, 'department'));
                }
              }}
              disabled={reports.length === 0}
            >
              <i className="bi bi-file-excel me-2"></i>Export All to Excel
            </button>
          </div>
        </div>
      </div>

      <div className="row">
        <div className="col-md-8">
          <div className="card">
            <div className="card-header">
              <h5 className="mb-0">All Reports</h5>
            </div>
            <div className="card-body">
              {reports.length === 0 ? (
                <div className="text-center py-5">
                  <i className="bi bi-file-text" style={{ fontSize: '3rem', color: '#ccc' }}></i>
                  <p className="text-muted mt-3">No reports available</p>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-hover">
                    <thead>
                      <tr>
                        <th>Department</th>
                        <th>Title</th>
                        <th>Submitted By</th>
                        <th>Dept Head Status</th>
                        <th>Admin Status</th>
                        <th>Date</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reports.map((report) => (
                        <tr key={report.id}>
                          <td>{report.department_name}</td>
                          <td>
                            <strong>{report.title}</strong>
                          </td>
                          <td>{report.submitted_by_name}</td>
                          <td>
                            {report.dept_head_status ? (
                              <span className={`badge bg-${getStatusBadge(report.dept_head_status)}`}>
                                {report.dept_head_status === 'DepartmentHead_Approved' ? 'Approved' : 
                                 report.dept_head_status === 'DepartmentHead_Rejected' ? 'Rejected' : 'Pending'}
                              </span>
                            ) : (
                              <span className="badge bg-secondary">N/A</span>
                            )}
                          </td>
                          <td>
                            <span className={`badge bg-${getStatusBadge(report.status)}`}>
                              {report.status}
                            </span>
                          </td>
                          <td>{new Date(report.created_at).toLocaleDateString()}</td>
                          <td>
                            <div className="btn-group" role="group">
                              <button
                                className="btn btn-sm btn-outline-info"
                                onClick={() => handleViewFullReport(report.id)}
                                title="View Full Report"
                              >
                                <i className="bi bi-eye"></i> View
                              </button>
                              <button
                                className="btn btn-sm btn-outline-primary"
                                onClick={() => setSelectedReport(report)}
                                title="Quick Review"
                              >
                                <i className="bi bi-clipboard-check"></i> Review
                              </button>
                              <button
                                className="btn btn-sm btn-outline-secondary"
                                onClick={() => {
                                  handleViewFullReport(report.id);
                                  setTimeout(() => {
                                    if (viewingReport) {
                                      printContent(report.title, formatReportForExport(report, 'department'));
                                    }
                                  }, 500);
                                }}
                                title="Print Report"
                              >
                                <i className="bi bi-printer"></i>
                              </button>
                              <button
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => exportToPDF(report.title, formatReportForExport(report, 'department'))}
                                title="Export to PDF"
                              >
                                <i className="bi bi-file-pdf"></i>
                              </button>
                              <button
                                className="btn btn-sm btn-outline-success"
                                onClick={() => exportToExcel(report.title, convertReportsToExcel([report], 'department'))}
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
        </div>

        <div className="col-md-4">
          {selectedReport ? (
            <div className="card">
              <div className="card-header">
                <h5 className="mb-0">Review Report</h5>
              </div>
              <div className="card-body">
                <div className="mb-3">
                  <strong>Department:</strong> {selectedReport.department_name}
                </div>
                <div className="mb-3">
                  <strong>Submitted By:</strong> {selectedReport.submitted_by_name}
                  <br />
                  <small className="text-muted">{selectedReport.submitted_by_email}</small>
                </div>
                <div className="mb-3">
                  <strong>Title:</strong> {selectedReport.title}
                </div>
                <div className="mb-3">
                  <strong>Content:</strong>
                  <div className="border p-3 mt-2 bg-light" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                    <pre style={{ whiteSpace: 'pre-wrap', margin: 0, fontFamily: 'inherit', fontSize: '0.9rem' }}>
                      {selectedReport.content}
                    </pre>
                  </div>
                  <button
                    className="btn btn-sm btn-outline-info mt-2"
                    onClick={() => handleViewFullReport(selectedReport.id)}
                  >
                    <i className="bi bi-arrows-fullscreen me-1"></i>View Full Report
                  </button>
                </div>
                <div className="mb-3">
                  <strong>Status:</strong>
                  <span className={`badge bg-${getStatusBadge(selectedReport.status)} ms-2`}>
                    {selectedReport.status}
                  </span>
                </div>
                {selectedReport.admin_notes && (
                  <div className="mb-3">
                    <strong>Admin Notes:</strong>
                    <div className="border p-2 mt-2 bg-light">
                      {selectedReport.admin_notes}
                    </div>
                  </div>
                )}
                {selectedReport.dept_head_status && (
                  <div className="mb-3">
                    <strong>Department Head Review:</strong>
                    <span className={`badge bg-${getStatusBadge(selectedReport.dept_head_status)} ms-2`}>
                      {selectedReport.dept_head_status === 'DepartmentHead_Approved' ? 'Approved' : 
                       selectedReport.dept_head_status === 'DepartmentHead_Rejected' ? 'Rejected' : 'Pending'}
                    </span>
                    {selectedReport.dept_head_reviewed_by_name && (
                      <div className="text-muted small mt-1">
                        Reviewed by: {selectedReport.dept_head_reviewed_by_name}
                        {selectedReport.dept_head_reviewed_at && (
                          <> on {new Date(selectedReport.dept_head_reviewed_at).toLocaleDateString()}</>
                        )}
                      </div>
                    )}
                    {selectedReport.dept_head_notes && (
                      <div className="border p-2 mt-2 bg-light small">
                        {selectedReport.dept_head_notes}
                      </div>
                    )}
                  </div>
                )}
                {selectedReport.status === 'Pending' && (
                  <>
                    <div className="mb-3">
                      <label className="form-label">Decision *</label>
                      <select
                        className="form-select"
                        value={reviewData.status}
                        onChange={(e) => setReviewData({ ...reviewData, status: e.target.value })}
                      >
                        <option value="Approved">Approve</option>
                        <option value="Rejected">Reject</option>
                        <option value="Final_Approved">Final Approve</option>
                      </select>
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Admin Notes</label>
                      <textarea
                        className="form-control"
                        rows="3"
                        value={reviewData.admin_notes}
                        onChange={(e) => setReviewData({ ...reviewData, admin_notes: e.target.value })}
                        placeholder="Optional notes for the department head..."
                      />
                    </div>
                    <div className="d-grid gap-2">
                      <button
                        className={`btn btn-${reviewData.status === 'Approved' ? 'success' : 'danger'}`}
                        onClick={() => handleReview(selectedReport.id)}
                      >
                        {reviewData.status === 'Approved' ? 'Approve' : 'Reject'} Report
                      </button>
                      <button
                        className="btn btn-secondary"
                        onClick={() => {
                          setSelectedReport(null);
                          setReviewData({ status: 'Approved', admin_notes: '' });
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="card">
              <div className="card-body text-center text-muted">
                <i className="bi bi-info-circle" style={{ fontSize: '3rem' }}></i>
                <p className="mt-3">Select a report to review</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Full Report View Modal */}
      {viewingReport && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
          <div className="modal-dialog modal-fullscreen">
            <div className="modal-content">
              <div className="modal-header bg-primary text-white">
                <h5 className="modal-title">
                  <i className="bi bi-file-text me-2"></i>
                  Full Report Details - {viewingReport.department_name}
                </h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setViewingReport(null)}></button>
              </div>
              <div className="modal-body" style={{ maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
                {/* Report Header Information */}
                <div className="card mb-4">
                  <div className="card-header bg-light">
                    <h6 className="mb-0">Report Information</h6>
                  </div>
                  <div className="card-body">
                    <div className="row">
                      <div className="col-md-6 mb-3">
                        <strong>Department:</strong>
                        <p className="mb-0">{viewingReport.department_name}</p>
                      </div>
                      <div className="col-md-6 mb-3">
                        <strong>Status:</strong>
                        <div>
                          <span className={`badge bg-${getStatusBadge(viewingReport.status)}`}>
                            {viewingReport.status}
                          </span>
                        </div>
                      </div>
                      <div className="col-md-6 mb-3">
                        <strong>Submitted By:</strong>
                        <p className="mb-0">
                          {viewingReport.submitted_by_name}
                          <br />
                          <small className="text-muted">{viewingReport.submitted_by_email}</small>
                        </p>
                      </div>
                      <div className="col-md-6 mb-3">
                        <strong>Submitted Date:</strong>
                        <p className="mb-0">{formatDate(viewingReport.created_at)}</p>
                      </div>
                      {viewingReport.reviewed_at && (
                        <>
                          <div className="col-md-6 mb-3">
                            <strong>Reviewed By:</strong>
                            <p className="mb-0">{viewingReport.reviewed_by_name || 'N/A'}</p>
                          </div>
                          <div className="col-md-6 mb-3">
                            <strong>Reviewed Date:</strong>
                            <p className="mb-0">{formatDate(viewingReport.reviewed_at)}</p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Report Title */}
                <div className="card mb-4">
                  <div className="card-header bg-light">
                    <h6 className="mb-0">Report Title</h6>
                  </div>
                  <div className="card-body">
                    <h4 className="mb-0">{viewingReport.title}</h4>
                  </div>
                </div>

                {/* Report Content */}
                <div className="card mb-4">
                  <div className="card-header bg-light d-flex justify-content-between align-items-center">
                    <h6 className="mb-0">Report Content</h6>
                    <button
                      className="btn btn-sm btn-outline-secondary"
                      onClick={() => {
                        const blob = new Blob([viewingReport.content], { type: 'text/plain' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `${viewingReport.title.replace(/[^a-z0-9]/gi, '_')}.txt`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                      }}
                    >
                      <i className="bi bi-download me-1"></i>Download
                    </button>
                  </div>
                  <div className="card-body">
                    <div className="report-content">
                      {parseReportContent(viewingReport.content).map((section, sectionIndex) => (
                        <div key={sectionIndex} className="report-section">
                          <h5 className="section-header">{section.title}</h5>
                          <div className="section-content">
                            {section.content.map((item, itemIndex) => {
                              if (item.type === 'divider') {
                                return <hr key={itemIndex} className="section-divider" />;
                              } else if (item.type === 'spacer') {
                                return <br key={itemIndex} />;
                              } else if (item.type === 'bullet') {
                                return (
                                  <div key={itemIndex} className="report-item">
                                    <span className="bullet">•</span>
                                    <span>{item.text}</span>
                                  </div>
                                );
                              } else if (item.type === 'numbered') {
                                return (
                                  <div key={itemIndex} className="report-item numbered">
                                    {item.text}
                                  </div>
                                );
                              } else if (item.type === 'field') {
                                return (
                                  <div key={itemIndex} className="report-field">
                                    <strong>{item.key}:</strong> {item.value || 'N/A'}
                                  </div>
                                );
                              } else {
                                return (
                                  <div key={itemIndex} className="report-line">
                                    {item.text}
                                  </div>
                                );
                              }
                            })}
                          </div>
                        </div>
                      ))}
                      {parseReportContent(viewingReport.content).length === 0 && (
                        <div className="text-muted">
                          <pre style={{ whiteSpace: 'pre-wrap', margin: 0, fontFamily: 'inherit' }}>
                            {viewingReport.content}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Attachments */}
                {viewingReport.attachments && viewingReport.attachments.length > 0 && (
                  <div className="card mb-4">
                    <div className="card-header bg-light">
                      <h6 className="mb-0">
                        <i className="bi bi-paperclip me-2"></i>Attachments ({viewingReport.attachments.length})
                      </h6>
                    </div>
                    <div className="card-body">
                      <div className="list-group">
                        {viewingReport.attachments.map((file, index) => (
                          <div key={index} className="list-group-item d-flex justify-content-between align-items-center">
                            <div>
                              <i className={`bi ${getFileIcon(file.mimetype || file.url)} me-2`}></i>
                              <a 
                                href={file.url} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="text-decoration-none"
                              >
                                {file.originalName || file.filename}
                              </a>
                              {file.size && (
                                <small className="text-muted ms-2">
                                  ({(file.size / 1024).toFixed(2)} KB)
                                </small>
                              )}
                            </div>
                            <div className="btn-group" role="group">
                              <a
                                href={file.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-sm btn-outline-primary"
                                title="View File"
                              >
                                <i className="bi bi-eye"></i>
                              </a>
                              <a
                                href={file.url}
                                download
                                className="btn btn-sm btn-outline-secondary"
                                title="Download File"
                              >
                                <i className="bi bi-download"></i>
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Admin Notes */}
                {viewingReport.admin_notes && (
                  <div className="card mb-4">
                    <div className="card-header bg-warning text-dark">
                      <h6 className="mb-0">Admin Notes</h6>
                    </div>
                    <div className="card-body">
                      <div className="alert alert-warning mb-0">
                        {viewingReport.admin_notes}
                      </div>
                    </div>
                  </div>
                )}

                {/* Review Section (if Pending) */}
                {viewingReport.status === 'Pending' && (
                  <div className="card">
                    <div className="card-header bg-info text-white">
                      <h6 className="mb-0">Review & Decision</h6>
                    </div>
                    <div className="card-body">
                      <div className="mb-3">
                        <label className="form-label">Decision *</label>
                        <select
                          className="form-select"
                          value={reviewData.status}
                          onChange={(e) => setReviewData({ ...reviewData, status: e.target.value })}
                        >
                          <option value="Approved">Approve</option>
                          <option value="Rejected">Reject</option>
                        </select>
                      </div>
                      <div className="mb-3">
                        <label className="form-label">Admin Notes</label>
                        <textarea
                          className="form-control"
                          rows="4"
                          value={reviewData.admin_notes}
                          onChange={(e) => setReviewData({ ...reviewData, admin_notes: e.target.value })}
                          placeholder="Optional notes for the department head..."
                        />
                      </div>
                      <div className="d-grid gap-2">
                        <button
                          className={`btn btn-lg btn-${reviewData.status === 'Approved' ? 'success' : 'danger'}`}
                          onClick={() => {
                            handleReview(viewingReport.id);
                            setViewingReport(null);
                          }}
                        >
                          <i className={`bi bi-${reviewData.status === 'Approved' ? 'check-circle' : 'x-circle'} me-2`}></i>
                          {reviewData.status === 'Approved' ? 'Approve' : 'Reject'} Report
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                {viewingReport.status === 'Pending' && (
                  <button
                    className="btn btn-secondary"
                    onClick={() => {
                      setViewingReport(null);
                      setSelectedReport(viewingReport);
                    }}
                  >
                    <i className="bi bi-arrow-left me-2"></i>Back to Quick Review
                  </button>
                )}
                <button
                  className="btn btn-primary"
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

export default DepartmentReportsManagement;

