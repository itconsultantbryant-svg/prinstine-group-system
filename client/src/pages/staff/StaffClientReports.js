import React, { useState, useEffect } from 'react';
import api from '../../config/api';
import { useAuth } from '../../hooks/useAuth';
import StaffClientReportForm from './StaffClientReportForm';
import { exportToPDF, exportToExcel, exportToWord, printContent, formatStaffClientReportForExport, convertReportsToExcel } from '../../utils/exportUtils';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';

const StaffClientReports = () => {
  const { user } = useAuth();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingReport, setEditingReport] = useState(null);
  const [viewingReport, setViewingReport] = useState(null);
  const [isMarketingDeptHead, setIsMarketingDeptHead] = useState(false);

  useEffect(() => {
    fetchReports();
    checkMarketingDeptHead();
  }, []);

  const checkMarketingDeptHead = async () => {
    if (user?.role === 'DepartmentHead') {
      try {
        const response = await api.get('/departments');
        const userEmailLower = user.email.toLowerCase().trim();
        const dept = response.data.departments.find(d => 
          (d.manager_id === user.id || 
           (d.head_email && d.head_email.toLowerCase().trim() === userEmailLower)) &&
          d.name && d.name.toLowerCase().includes('marketing')
        );
        setIsMarketingDeptHead(!!dept);
      } catch (error) {
        console.error('Error checking marketing department head:', error);
      }
    }
  };

  const handleMarketingReview = async (reportId, approved) => {
    if (!window.confirm(`Are you sure you want to ${approved ? 'approve' : 'reject'} this report?`)) {
      return;
    }

    try {
      await api.put(`/staff-client-reports/${reportId}/marketing-review`, {
        status: approved ? 'Marketing_Manager_Approved' : 'Marketing_Manager_Rejected',
        notes: approved ? 'Approved by Marketing Manager' : 'Rejected by Marketing Manager'
      });
      fetchReports();
    } catch (error) {
      console.error('Error reviewing report:', error);
      alert(error.response?.data?.error || 'Failed to review report');
    }
  };

  const fetchReports = async () => {
    try {
      setLoading(true);
      const response = await api.get('/staff-client-reports');
      setReports(response.data.reports || []);
    } catch (error) {
      console.error('Error fetching reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (report) => {
    setEditingReport(report);
    setShowForm(true);
  };

  const handleView = (report) => {
    setViewingReport(report);
  };

  const handleDelete = async (reportId) => {
    if (!window.confirm('Are you sure you want to delete this report?')) {
      return;
    }

    try {
      await api.delete(`/staff-client-reports/${reportId}`);
      fetchReports();
    } catch (error) {
      console.error('Error deleting report:', error);
      alert('Failed to delete report');
    }
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingReport(null);
    fetchReports();
  };

  const handleExportPDF = (report) => {
    const content = formatStaffClientReportForExport(report);
    exportToPDF(report.report_title || 'Client Report', content);
  };

  const handleExportExcel = (report) => {
    const excelData = [
      ['STAFF CLIENT REPORT'],
      [],
      ['Field', 'Value'],
      ['Title', report.report_title || 'N/A'],
      ['Client', report.client_name || 'N/A'],
      ['Staff', report.staff_name || 'N/A'],
      ['Department', report.department_name || 'N/A'],
      ['Status', report.status || 'N/A'],
      ['Created', new Date(report.created_at || report.submitted_at).toLocaleDateString()],
      [],
      ['Content', formatStaffClientReportForExport(report)]
    ];
    exportToExcel(report.report_title || 'Client Report', excelData);
  };

  const handleExportWord = (report) => {
    const content = formatStaffClientReportForExport(report);
    exportToWord(report.report_title || 'Client Report', content);
  };

  const handlePrint = (report) => {
    const content = formatStaffClientReportForExport(report);
    printContent(report.report_title || 'Client Report', content);
  };

  const getStatusBadge = (status) => {
    const badges = {
      'Draft': 'bg-secondary',
      'Submitted': 'bg-info',
      'Marketing_Manager_Approved': 'bg-success',
      'Marketing_Manager_Rejected': 'bg-danger',
      'Admin_Approved': 'bg-success',
      'Admin_Rejected': 'bg-danger',
      'Final_Approved': 'bg-primary'
    };
    return badges[status] || 'bg-secondary';
  };

  if (loading) {
    return (
      <div className="container-fluid">
        <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '400px' }}>
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>Client-Specific Reports</h2>
        <button
          className="btn btn-primary"
          onClick={() => {
            setEditingReport(null);
            setShowForm(true);
          }}
        >
          <i className="bi bi-plus-circle me-2"></i>New Report
        </button>
      </div>

      {reports.length === 0 ? (
        <div className="alert alert-info">
          <i className="bi bi-info-circle me-2"></i>
          No reports found. Create your first client-specific report.
        </div>
      ) : (
        <div className="table-responsive">
          <table className="table table-striped table-hover">
            <thead className="table-dark">
              <tr>
                <th>Report Title</th>
                <th>Client Name</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {reports.map(report => (
                <tr key={report.id}>
                  <td>{report.report_title}</td>
                  <td>{report.client_name}</td>
                  <td>
                    <span className={`badge ${getStatusBadge(report.status)}`}>
                      {report.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td>{new Date(report.created_at).toLocaleDateString()}</td>
                  <td>
                    <div className="btn-group" role="group">
                      <button
                        className="btn btn-sm btn-outline-primary"
                        onClick={() => handleView(report)}
                        title="View Report"
                      >
                        <i className="bi bi-eye"></i>
                      </button>
                      {['Draft', 'Submitted'].includes(report.status) && (
                        <button
                          className="btn btn-sm btn-outline-secondary"
                          onClick={() => handleEdit(report)}
                          title="Edit Report"
                        >
                          <i className="bi bi-pencil"></i>
                        </button>
                      )}
                      <button
                        className="btn btn-sm btn-outline-secondary"
                        onClick={() => handlePrint(report)}
                        title="Print Report"
                      >
                        <i className="bi bi-printer"></i>
                      </button>
                      <button
                        className="btn btn-sm btn-outline-danger"
                        onClick={() => handleExportPDF(report)}
                        title="Export to PDF"
                      >
                        <i className="bi bi-file-pdf"></i>
                      </button>
                      <button
                        className="btn btn-sm btn-outline-primary"
                        onClick={() => handleExportWord(report)}
                        title="Export to Word"
                      >
                        <i className="bi bi-file-word"></i>
                      </button>
                      <button
                        className="btn btn-sm btn-outline-success"
                        onClick={() => handleExportExcel(report)}
                        title="Export to Excel"
                      >
                        <i className="bi bi-file-excel"></i>
                      </button>
                      {/* Marketing Department Head approval buttons */}
                      {isMarketingDeptHead && ['Submitted', 'Draft'].includes(report.status) && (
                        <>
                          <button
                            className="btn btn-sm btn-outline-success"
                            onClick={() => handleMarketingReview(report.id, true)}
                            title="Approve Report"
                          >
                            <i className="bi bi-check-circle"></i>
                          </button>
                          <button
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => handleMarketingReview(report.id, false)}
                            title="Reject Report"
                          >
                            <i className="bi bi-x-circle"></i>
                          </button>
                        </>
                      )}
                      {['Draft', 'Submitted'].includes(report.status) && (
                        <button
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => handleDelete(report.id)}
                          title="Delete Report"
                        >
                          <i className="bi bi-trash"></i>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <StaffClientReportForm
          report={editingReport}
          onClose={handleFormClose}
        />
      )}

      {viewingReport && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg modal-dialog-scrollable">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">{viewingReport.report_title}</h5>
                <div className="d-flex gap-2">
                  <button
                    className="btn btn-sm btn-outline-primary"
                    onClick={() => handlePrint(viewingReport)}
                  >
                    <i className="bi bi-printer"></i>
                  </button>
                  <button
                    className="btn btn-sm btn-outline-danger"
                    onClick={() => exportToPDF(viewingReport)}
                  >
                    <i className="bi bi-file-pdf"></i>
                  </button>
                  <button
                    className="btn btn-sm btn-outline-success"
                    onClick={() => exportToExcel(viewingReport)}
                  >
                    <i className="bi bi-file-excel"></i>
                  </button>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setViewingReport(null)}
                  ></button>
                </div>
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <strong>Title:</strong> {viewingReport.report_title}<br />
                  <strong>Client:</strong> {viewingReport.client_name}<br />
                  <strong>Staff:</strong> {viewingReport.staff_name}<br />
                  <strong>Department:</strong> {viewingReport.department_name || 'N/A'}<br />
                  <strong>Status:</strong> <span className={`badge ${getStatusBadge(viewingReport.status)}`}>
                    {viewingReport.status.replace(/_/g, ' ')}
                  </span><br />
                  <strong>Created:</strong> {new Date(viewingReport.created_at).toLocaleString()}
                </div>
                <div className="border-top pt-3">
                  <strong>Content:</strong>
                  <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'Arial, sans-serif', maxHeight: '400px', overflow: 'auto', padding: '10px', backgroundColor: '#f5f5f5' }}>
                    {formatStaffClientReportForExport(viewingReport)}
                  </pre>
                </div>
              </div>
              <div className="modal-footer">
                <div className="btn-group" role="group">
                  <button
                    className="btn btn-outline-secondary"
                    onClick={() => handlePrint(viewingReport)}
                  >
                    <i className="bi bi-printer me-2"></i>Print
                  </button>
                  <button
                    className="btn btn-outline-danger"
                    onClick={() => handleExportPDF(viewingReport)}
                  >
                    <i className="bi bi-file-pdf me-2"></i>PDF
                  </button>
                  <button
                    className="btn btn-outline-primary"
                    onClick={() => handleExportWord(viewingReport)}
                  >
                    <i className="bi bi-file-word me-2"></i>Word
                  </button>
                  <button
                    className="btn btn-outline-success"
                    onClick={() => handleExportExcel(viewingReport)}
                  >
                    <i className="bi bi-file-excel me-2"></i>Excel
                  </button>
                </div>
                <button
                  type="button"
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

export default StaffClientReports;

