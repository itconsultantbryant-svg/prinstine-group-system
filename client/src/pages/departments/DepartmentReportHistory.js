import React, { useState, useEffect } from 'react';
import api from '../../config/api';
import { useAuth } from '../../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import ReportTemplateRouter from './ReportTemplateRouter';
import { exportToPDF, exportToExcel, printContent, formatReportForExport, convertReportsToExcel } from '../../utils/exportUtils';

const DepartmentReportHistory = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState(null);
  const [editingReport, setEditingReport] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState('all'); // all, pending, approved, rejected
  const [department, setDepartment] = useState(null);

  useEffect(() => {
    fetchDepartment();
    fetchReports();
  }, [filter]);

  const fetchDepartment = async () => {
    try {
      const response = await api.get('/departments');
      const userEmailLower = user.email.toLowerCase().trim();
      const dept = response.data.departments.find(d => 
        d.manager_id === user.id || 
        (d.head_email && d.head_email.toLowerCase().trim() === userEmailLower)
      );
      setDepartment(dept);
    } catch (error) {
      console.error('Error fetching department:', error);
    }
  };

  const fetchReports = async () => {
    try {
      setLoading(true);
      const response = await api.get('/department-reports');
      let reportsData = response.data.reports || [];
      
      // Apply filter
      if (filter !== 'all') {
        reportsData = reportsData.filter(r => r.status.toLowerCase() === filter.toLowerCase());
      }
      
      // Sort by created_at descending (newest first)
      reportsData.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      
      setReports(reportsData);
    } catch (error) {
      console.error('Error fetching reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      'Pending': 'warning',
      'Approved': 'success',
      'Rejected': 'danger'
    };
    return badges[status] || 'secondary';
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleEditReport = async (reportId) => {
    try {
      const response = await api.get(`/department-reports/${reportId}`);
      const report = response.data.report;
      
      // Only allow editing if status is Pending
      if (report.status !== 'Pending') {
        alert('You can only edit reports with Pending status');
        return;
      }
      
      setEditingReport(report);
      setShowForm(true);
      setSelectedReport(null);
    } catch (error) {
      console.error('Error fetching report:', error);
      alert('Failed to load report for editing');
    }
  };

  const handleDeleteReport = async (reportId) => {
    if (!window.confirm('Are you sure you want to delete this report? This action cannot be undone.')) {
      return;
    }

    try {
      await api.delete(`/department-reports/${reportId}`);
      alert('Report deleted successfully');
      fetchReports();
      if (selectedReport && selectedReport.id === reportId) {
        setSelectedReport(null);
      }
    } catch (error) {
      console.error('Error deleting report:', error);
      const errorMsg = error.response?.data?.error || 'Failed to delete report';
      alert(errorMsg);
    }
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingReport(null);
    fetchReports();
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

  const filteredCounts = {
    all: reports.length,
    pending: reports.filter(r => r.status === 'Pending').length,
    approved: reports.filter(r => r.status === 'Approved').length,
    rejected: reports.filter(r => r.status === 'Rejected').length
  };

  return (
    <div className="container-fluid">
      <div className="row mb-4">
        <div className="col-12 d-flex justify-content-between align-items-center">
          <div>
            <h1 className="h3 mb-0">Report History</h1>
            {department && (
              <p className="text-muted mb-0">
                <i className="bi bi-building me-2"></i>{department.name}
              </p>
            )}
          </div>
          <button 
            className="btn btn-primary" 
            onClick={() => navigate('/department-dashboard')}
          >
            <i className="bi bi-plus-circle me-2"></i>Submit New Report
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="card mb-4">
        <div className="card-body">
          <div className="btn-group" role="group">
            <button
              type="button"
              className={`btn ${filter === 'all' ? 'btn-primary' : 'btn-outline-primary'}`}
              onClick={() => setFilter('all')}
            >
              All ({filteredCounts.all})
            </button>
            <button
              type="button"
              className={`btn ${filter === 'pending' ? 'btn-warning' : 'btn-outline-warning'}`}
              onClick={() => setFilter('pending')}
            >
              Pending ({filteredCounts.pending})
            </button>
            <button
              type="button"
              className={`btn ${filter === 'approved' ? 'btn-success' : 'btn-outline-success'}`}
              onClick={() => setFilter('approved')}
            >
              Approved ({filteredCounts.approved})
            </button>
            <button
              type="button"
              className={`btn ${filter === 'rejected' ? 'btn-danger' : 'btn-outline-danger'}`}
              onClick={() => setFilter('rejected')}
            >
              Rejected ({filteredCounts.rejected})
            </button>
          </div>
        </div>
      </div>

      {/* Reports List */}
      <div className="row">
        <div className={selectedReport ? 'col-md-8' : 'col-md-12'}>
          <div className="card">
            <div className="card-header">
              <h5 className="mb-0">
                {filter === 'all' ? 'All Reports' : `${filter.charAt(0).toUpperCase() + filter.slice(1)} Reports`}
              </h5>
            </div>
            <div className="card-body">
              {reports.length === 0 ? (
                <div className="text-center py-5">
                  <i className="bi bi-file-text" style={{ fontSize: '3rem', color: '#ccc' }}></i>
                  <p className="text-muted mt-3">
                    {filter === 'all' 
                      ? 'No reports submitted yet' 
                      : `No ${filter} reports found`}
                  </p>
                  {filter === 'all' && (
                    <button 
                      className="btn btn-primary" 
                      onClick={() => navigate('/department-dashboard')}
                    >
                      Submit Your First Report
                    </button>
                  )}
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-hover">
                    <thead>
                      <tr>
                        <th>Title</th>
                        <th>Status</th>
                        <th>Submitted Date</th>
                        <th>Reviewed Date</th>
                        <th>Reviewed By</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reports.map((report) => (
                        <tr key={report.id}>
                          <td>
                            <strong>{report.title}</strong>
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
                            <span className={`badge bg-${getStatusBadge(report.status)}`}>
                              {report.status}
                            </span>
                          </td>
                          <td>{formatDate(report.created_at)}</td>
                          <td>{formatDate(report.reviewed_at)}</td>
                          <td>{report.reviewed_by_name || '-'}</td>
                          <td>
                            <div className="btn-group" role="group">
                              <button
                                className="btn btn-sm btn-outline-primary"
                                onClick={() => setSelectedReport(report)}
                                title="View Details"
                              >
                                <i className="bi bi-eye"></i>
                              </button>
                              {report.status === 'Pending' && (
                                <button
                                  className="btn btn-sm btn-outline-warning"
                                  onClick={() => handleEditReport(report.id)}
                                  title="Edit Report"
                                >
                                  <i className="bi bi-pencil"></i>
                                </button>
                              )}
                              <button
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => handleDeleteReport(report.id)}
                                title="Delete Report"
                              >
                                <i className="bi bi-trash"></i>
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

        {/* Report Details Sidebar */}
        {selectedReport && (
          <div className="col-md-4">
            <div className="card">
              <div className="card-header d-flex justify-content-between align-items-center">
                <h5 className="mb-0">Report Details</h5>
                <button
                  className="btn btn-sm btn-close"
                  onClick={() => setSelectedReport(null)}
                ></button>
              </div>
              <div className="card-body">
                <div className="mb-3">
                  <strong>Title:</strong>
                  <p className="mt-1">{selectedReport.title}</p>
                </div>
                
                <div className="mb-3">
                  <strong>Status:</strong>
                  <div className="mt-1">
                    <span className={`badge bg-${getStatusBadge(selectedReport.status)}`}>
                      {selectedReport.status}
                    </span>
                  </div>
                </div>

                <div className="mb-3">
                  <strong>Content:</strong>
                  <div className="border p-3 mt-2 bg-light" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                    <pre style={{ whiteSpace: 'pre-wrap', margin: 0, fontFamily: 'inherit' }}>
                      {selectedReport.content}
                    </pre>
                  </div>
                </div>

                <div className="mb-3">
                  <strong>Submitted:</strong>
                  <p className="mt-1 mb-0">{formatDate(selectedReport.created_at)}</p>
                </div>

                {selectedReport.reviewed_at && (
                  <>
                    <div className="mb-3">
                      <strong>Reviewed:</strong>
                      <p className="mt-1 mb-0">{formatDate(selectedReport.reviewed_at)}</p>
                    </div>
                    <div className="mb-3">
                      <strong>Reviewed By:</strong>
                      <p className="mt-1 mb-0">{selectedReport.reviewed_by_name || 'N/A'}</p>
                    </div>
                  </>
                )}

                {selectedReport.admin_notes && (
                  <div className="mb-3">
                    <strong>Admin Notes:</strong>
                    <div className="border p-2 mt-2 bg-light">
                      {selectedReport.admin_notes}
                    </div>
                  </div>
                )}

                <div className="d-grid gap-2">
                  {selectedReport.status === 'Pending' && (
                    <>
                      <button
                        className="btn btn-warning"
                        onClick={() => {
                          setSelectedReport(null);
                          handleEditReport(selectedReport.id);
                        }}
                      >
                        <i className="bi bi-pencil me-2"></i>Edit Report
                      </button>
                      <button
                        className="btn btn-danger"
                        onClick={() => {
                          const reportId = selectedReport.id;
                          setSelectedReport(null);
                          handleDeleteReport(reportId);
                        }}
                      >
                        <i className="bi bi-trash me-2"></i>Delete Report
                      </button>
                    </>
                  )}
                  <button
                    className="btn btn-secondary"
                    onClick={() => setSelectedReport(null)}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Edit Report Form */}
      {showForm && (
        <ReportTemplateRouter
          department={department}
          report={editingReport}
          reportType={
            editingReport?.title?.toLowerCase().includes('monthly') ? 'monthly' :
            editingReport?.title?.toLowerCase().includes('client-specific activities') ||
            editingReport?.title?.toLowerCase().includes('client activity report') ||
            editingReport?.title?.toLowerCase().includes('client-specific') ? 'client-specific-activities' :
            editingReport?.title?.toLowerCase().includes('weekly client officer') || 
            editingReport?.title?.toLowerCase().includes('client officer report') ? 'weekly-client-officer' :
            editingReport?.title?.toLowerCase().includes('weekly') ? 'weekly' : null
          }
          onClose={handleFormClose}
        />
      )}
    </div>
  );
};

export default DepartmentReportHistory;

