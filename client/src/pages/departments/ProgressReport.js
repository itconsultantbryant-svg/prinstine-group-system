import React, { useState, useEffect } from 'react';
import api from '../../config/api';
import { useAuth } from '../../hooks/useAuth';
import { getSocket } from '../../config/socket';
import { exportToPDF, exportToExcel, exportToWord, printContent, formatReportForExport, convertReportsToExcel } from '../../utils/exportUtils';

const ProgressReport = ({ onClose }) => {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    no: '',
    name: '',
    date: new Date().toISOString().split('T')[0],
    category: '',
    status: '',
    amount: ''
  });
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [filteredReports, setFilteredReports] = useState([]);

  useEffect(() => {
    fetchReports();
    
    // Set up real-time socket connection for progress report updates
    const socket = getSocket();
    if (socket) {
      const handleProgressReportUpdated = () => {
        console.log('Progress report updated event received, refreshing...');
        setTimeout(() => {
          fetchReports();
        }, 300);
      };

      const handleProgressReportApproved = (data) => {
        console.log('Progress report approved event received:', data);
        setTimeout(() => {
          fetchReports();
        }, 300);
      };

      socket.on('progress_report_updated', handleProgressReportUpdated);
      socket.on('progress_report_approved', handleProgressReportApproved);

      return () => {
        socket.off('progress_report_updated', handleProgressReportUpdated);
        socket.off('progress_report_approved', handleProgressReportApproved);
      };
    }
  }, []);

  useEffect(() => {
    // Filter reports locally when date filters change
    filterReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reports, fromDate, toDate]);

  const fetchReports = async (dateFilters = null) => {
    try {
      setLoading(true);
      // Include date filters in API call if provided
      const params = {};
      const from = dateFilters?.fromDate || fromDate;
      const to = dateFilters?.toDate || toDate;
      
      if (from) params.from_date = from;
      if (to) params.to_date = to;
      
      const queryString = new URLSearchParams(params).toString();
      const url = `/progress-reports${queryString ? `?${queryString}` : ''}`;
      const response = await api.get(url);
      
      // Convert API response to progress reports format
      const progressReports = (response.data.reports || []).map((report, index) => ({
        id: report.id,
        no: index + 1,
        name: report.name || 'N/A',
        date: report.date || '',
        category: report.category || '',
        status: report.status || '',
        amount: report.amount || 0,
        department: report.department_name || report.department_full_name || 'N/A',
        created_by: report.created_by_name || 'N/A',
        created_by_email: report.created_by_email || '',
        created_at: report.created_at
      }));
      setReports(progressReports);
      setFilteredReports(progressReports);
    } catch (error) {
      console.error('Error fetching reports:', error);
      setError('Failed to load progress reports');
    } finally {
      setLoading(false);
    }
  };

  const filterReports = () => {
    let filtered = [...reports];
    
    if (fromDate) {
      filtered = filtered.filter(r => r.date >= fromDate);
    }
    if (toDate) {
      filtered = filtered.filter(r => r.date <= toDate);
    }
    
    // Re-number after filtering
    filtered = filtered.map((report, index) => ({
      ...report,
      no: index + 1
    }));
    
    setFilteredReports(filtered);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Create progress report using the new API
      const reportData = {
        name: formData.name,
        date: formData.date,
        category: formData.category,
        status: formData.status,
        amount: formData.amount ? parseFloat(formData.amount) : 0
      };

      await api.post('/progress-reports', reportData);
      setFormData({
        no: '',
        name: '',
        date: new Date().toISOString().split('T')[0],
        category: '',
        status: '',
        amount: ''
      });
      fetchReports();
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.errors?.[0]?.msg || 'Failed to save progress report');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const [editingReport, setEditingReport] = useState(null);
  const [editFormData, setEditFormData] = useState({
    name: '',
    date: '',
    category: '',
    status: '',
    amount: ''
  });

  const handleEditReport = (report) => {
    setEditingReport(report);
    setEditFormData({
      name: report.name || '',
      date: report.date ? new Date(report.date).toISOString().split('T')[0] : '',
      category: report.category || '',
      status: report.status || '',
      amount: report.amount || ''
    });
  };

  const handleSaveEdit = async () => {
    if (!editingReport) return;
    
    try {
      setError('');
      setLoading(true);
      await api.put(`/progress-reports/${editingReport.id}`, editFormData);
      
      // Refresh reports after edit
      await fetchReports();
      setEditingReport(null);
      
      // Show success message
      alert('Progress report updated successfully. Target progress has been updated in real-time.');
    } catch (err) {
      console.error('Error editing report:', err);
      setError(err.response?.data?.error || 'Failed to update progress report');
    } finally {
      setLoading(false);
    }
  };

  const handleApproveReport = async (reportId, status) => {
    if (!window.confirm(`Are you sure you want to ${status.toLowerCase()} this progress report?`)) {
      return;
    }

    try {
      setError('');
      setLoading(true);
      await api.put(`/progress-reports/${reportId}/approve`, {
        status: status,
        admin_notes: `Progress report ${status.toLowerCase()} by ${user?.name || 'Admin'}`
      });
      
      // Refresh reports after approval
      await fetchReports();
      
      // Show success message
      alert(`Progress report ${status.toLowerCase()} successfully. ${status === 'Approved' ? 'Target progress has been updated in real-time.' : ''}`);
    } catch (err) {
      console.error('Error approving report:', err);
      setError(err.response?.data?.error || `Failed to ${status.toLowerCase()} progress report`);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const statusLower = (status || '').toLowerCase();
    const badges = {
      'signed contract': 'success',
      'pipeline client': 'warning',
      'submit': 'info',
      'submitted': 'info'
    };
    return badges[statusLower] || 'secondary';
  };

  const getCategoryBadge = (category) => {
    const categoryLower = (category || '').toLowerCase();
    const badges = {
      'student': 'primary',
      'client for consultancy': 'info',
      'client for audit': 'warning',
      'others': 'secondary'
    };
    return badges[categoryLower] || 'secondary';
  };

  return (
    <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
      <div className="modal-dialog modal-xl">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Progress Report</h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <div className="modal-body">
            {error && <div className="alert alert-danger">{error}</div>}

            {/* Add New Entry Form */}
            <div className="card mb-4">
              <div className="card-header">
                <h6 className="mb-0">Add New Entry</h6>
              </div>
              <div className="card-body">
                <form onSubmit={handleSubmit}>
                  <div className="row">
                    <div className="col-md-3 mb-3">
                      <label className="form-label">Name *</label>
                      <input
                        type="text"
                        className="form-control"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        required
                      />
                    </div>
                    <div className="col-md-3 mb-3">
                      <label className="form-label">Date *</label>
                      <input
                        type="date"
                        className="form-control"
                        name="date"
                        value={formData.date}
                        onChange={handleChange}
                        required
                      />
                    </div>
                    <div className="col-md-3 mb-3">
                      <label className="form-label">Category *</label>
                      <select
                        className="form-select"
                        name="category"
                        value={formData.category}
                        onChange={handleChange}
                        required
                      >
                        <option value="">Select Category</option>
                        <option value="Student">Student</option>
                        <option value="Client for Consultancy">Client for Consultancy</option>
                        <option value="Client for Audit">Client for Audit</option>
                        <option value="Others">Others</option>
                      </select>
                    </div>
                    <div className="col-md-3 mb-3">
                      <label className="form-label">Status *</label>
                      <select
                        className="form-select"
                        name="status"
                        value={formData.status}
                        onChange={handleChange}
                        required
                      >
                        <option value="">Select Status</option>
                        <option value="Signed Contract">Signed Contract</option>
                        <option value="Pipeline Client">Pipeline Client</option>
                        <option value="Submitted">Submitted</option>
                      </select>
                    </div>
                  </div>
                  <div className="row">
                    <div className="col-md-3 mb-3">
                      <label className="form-label">Amount Paid</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="form-control"
                        name="amount"
                        value={formData.amount}
                        onChange={handleChange}
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  <div className="text-end">
                    <button type="submit" className="btn btn-primary" disabled={loading}>
                      {loading ? 'Saving...' : 'Add Entry'}
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {/* Date Filter */}
            <div className="card mb-4">
              <div className="card-body">
                <div className="row align-items-end">
                  <div className="col-md-4">
                    <label className="form-label">From Date</label>
                    <input
                      type="date"
                      className="form-control"
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">To Date</label>
                    <input
                      type="date"
                      className="form-control"
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                    />
                  </div>
                  <div className="col-md-4">
                    <button
                      className="btn btn-outline-secondary w-100"
                      onClick={() => {
                        setFromDate('');
                        setToDate('');
                        fetchReports();
                      }}
                    >
                      Clear Filter
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Progress Report Table */}
            <div className="table-responsive">
              <table className="table table-striped table-hover">
                <thead className="table-dark">
                  <tr>
                    <th>No.</th>
                    <th>Name</th>
                    <th>Date</th>
                    <th>Category</th>
                    <th>Status</th>
                    <th>Amount</th>
                    <th>Department</th>
                    <th>Reported By</th>
                    {user?.role === 'Admin' && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={user?.role === 'Admin' ? 9 : 8} className="text-center">
                        <div className="spinner-border spinner-border-sm" role="status">
                          <span className="visually-hidden">Loading...</span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredReports.length === 0 ? (
                    <tr>
                      <td colSpan={user?.role === 'Admin' ? 9 : 8} className="text-center text-muted">
                        No progress reports found
                      </td>
                    </tr>
                  ) : (
                    filteredReports.map((report) => (
                      <tr key={report.id}>
                        <td>{report.no}</td>
                        <td>{report.name}</td>
                        <td>{report.date ? new Date(report.date).toLocaleDateString() : 'N/A'}</td>
                        <td>
                          {report.category ? (
                            <span className={`badge bg-${getCategoryBadge(report.category.toLowerCase())}`}>
                              {report.category}
                            </span>
                          ) : (
                            <span className="text-muted">-</span>
                          )}
                        </td>
                        <td>
                          {report.status ? (
                            <span className={`badge bg-${
                              report.status === 'Pending' ? 'warning' :
                              report.status === 'Approved' ? 'success' :
                              report.status === 'Rejected' ? 'danger' :
                              getStatusBadge(report.status.toLowerCase())
                            }`}>
                              {report.status}
                            </span>
                          ) : (
                            <span className="text-muted">-</span>
                          )}
                        </td>
                        <td>
                          {report.amount ? (
                            <span className="text-success fw-bold">
                              ${parseFloat(report.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          ) : (
                            <span className="text-muted">$0.00</span>
                          )}
                        </td>
                        <td>
                          <span className="badge bg-info">
                            {report.department}
                          </span>
                        </td>
                        <td>
                          <div>
                            <strong>{report.created_by}</strong>
                            {report.created_by_email && (
                              <div className="small text-muted">{report.created_by_email}</div>
                            )}
                          </div>
                        </td>
                        <td>
                          <div className="btn-group" role="group">
                            {user?.role === 'Admin' && (
                              <>
                                {report.status === 'Pending' && (
                                  <>
                                    <button
                                      className="btn btn-sm btn-success"
                                      onClick={() => handleApproveReport(report.id, 'Approved')}
                                      title="Approve"
                                    >
                                      <i className="bi bi-check-circle"></i>
                                    </button>
                                    <button
                                      className="btn btn-sm btn-danger"
                                      onClick={() => handleApproveReport(report.id, 'Rejected')}
                                      title="Reject"
                                    >
                                      <i className="bi bi-x-circle"></i>
                                    </button>
                                  </>
                                )}
                                <button
                                  className="btn btn-sm btn-outline-primary"
                                  onClick={() => handleEditReport(report)}
                                  title="Edit"
                                >
                                  <i className="bi bi-pencil"></i>
                                </button>
                              </>
                            )}
                            <button
                              className="btn btn-sm btn-outline-secondary"
                              onClick={() => printContent(report.name, formatReportForExport(report, 'progress'))}
                              title="Print"
                            >
                              <i className="bi bi-printer"></i>
                            </button>
                            <button
                              className="btn btn-sm btn-outline-danger"
                              onClick={() => exportToPDF(report.name, formatReportForExport(report, 'progress'))}
                              title="Export to PDF"
                            >
                              <i className="bi bi-file-pdf"></i>
                            </button>
                            <button
                              className="btn btn-sm btn-outline-primary"
                              onClick={() => exportToWord(report.name, formatReportForExport(report, 'progress'))}
                              title="Export to Word"
                            >
                              <i className="bi bi-file-word"></i>
                            </button>
                            <button
                              className="btn btn-sm btn-outline-success"
                              onClick={() => exportToExcel(report.name, convertReportsToExcel([report], 'progress'))}
                              title="Export to Excel"
                            >
                              <i className="bi bi-file-excel"></i>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Edit Progress Report Modal */}
      {editingReport && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1051 }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Edit Progress Report</h5>
                <button type="button" className="btn-close" onClick={() => setEditingReport(null)}></button>
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label">Name *</label>
                  <input
                    type="text"
                    className="form-control"
                    value={editFormData.name}
                    onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Date *</label>
                  <input
                    type="date"
                    className="form-control"
                    value={editFormData.date}
                    onChange={(e) => setEditFormData({ ...editFormData, date: e.target.value })}
                    required
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Category *</label>
                  <select
                    className="form-select"
                    value={editFormData.category}
                    onChange={(e) => setEditFormData({ ...editFormData, category: e.target.value })}
                    required
                  >
                    <option value="">Select Category</option>
                    <option value="Student">Student</option>
                    <option value="Client for Consultancy">Client for Consultancy</option>
                    <option value="Client for Audit">Client for Audit</option>
                    <option value="Others">Others</option>
                  </select>
                </div>
                <div className="mb-3">
                  <label className="form-label">Status *</label>
                  <select
                    className="form-select"
                    value={editFormData.status}
                    onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                    required
                  >
                    <option value="">Select Status</option>
                    <option value="Signed Contract">Signed Contract</option>
                    <option value="Pipeline Client">Pipeline Client</option>
                    <option value="Submitted">Submitted</option>
                  </select>
                </div>
                <div className="mb-3">
                  <label className="form-label">Amount Paid</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="form-control"
                    value={editFormData.amount}
                    onChange={(e) => setEditFormData({ ...editFormData, amount: e.target.value })}
                    placeholder="0.00"
                  />
                  <small className="text-muted">Editing this amount will update the target progress in real-time.</small>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setEditingReport(null)}>
                  Cancel
                </button>
                <button type="button" className="btn btn-primary" onClick={handleSaveEdit} disabled={loading}>
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProgressReport;

