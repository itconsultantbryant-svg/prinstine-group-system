import React, { useState, useEffect } from 'react';
import api from '../../config/api';
import { useAuth } from '../../hooks/useAuth';
import RequisitionForm from './RequisitionForm';
import { exportToPDF, exportToWord, printContent } from '../../utils/exportUtils';
import { getSocket } from '../../config/socket';

const RequisitionHistory = () => {
  const { user } = useAuth();
  const [requisitions, setRequisitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingRequisition, setEditingRequisition] = useState(null);
  const [viewingRequisition, setViewingRequisition] = useState(null);
  const [filter, setFilter] = useState({
    request_type: '',
    status: '',
    dateFrom: '',
    dateTo: ''
  });
  const [approvingId, setApprovingId] = useState(null);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [approvalAction, setApprovalAction] = useState('');

  useEffect(() => {
    fetchRequisitions();
  }, []);

  // Real-time updates via socket.io
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleRequisitionCreated = (data) => {
      console.log('Requisition created event received:', data);
      // Refresh if it's the current user's requisition, if user is admin, if it's a work support for this user,
      // or if it's an office supplies requisition and user is Finance Department Head
      const isWorkSupportForMe = data.requisition?.request_type === 'work_support' && 
                                  data.requisition?.target_user_id === user.id;
      const isOfficeSuppliesForFinanceHead = data.requisition?.request_type === 'office_supplies' && 
                                             user.role === 'DepartmentHead';
      if (data.user_id === user.id || user.role === 'Admin' || isWorkSupportForMe || isOfficeSuppliesForFinanceHead) {
        setTimeout(() => {
          fetchRequisitions();
        }, 300);
      }
    };
<｜tool▁call▁begin｜>
run_terminal_cmd

    const handleRequisitionUpdated = (data) => {
      console.log('Requisition updated event received:', data);
      // Refresh if it's the current user's requisition, if user is admin/dept head, or if it's a work support for this user
      const isWorkSupportForMe = data.requisition?.request_type === 'work_support' && 
                                  data.requisition?.target_user_id === user.id;
      if (data.requisition?.user_id === user.id || user.role === 'Admin' || user.role === 'DepartmentHead' || isWorkSupportForMe) {
        setTimeout(() => {
          fetchRequisitions();
        }, 300);
      }
    };

    const handleRequisitionStatusUpdated = (data) => {
      console.log('Requisition status updated event received:', data);
      // Always refresh for status updates
      setTimeout(() => {
        fetchRequisitions();
      }, 300);
    };

    const handleRequisitionDeleted = (data) => {
      console.log('Requisition deleted event received:', data);
      // Remove from local state
      setRequisitions(prev => prev.filter(req => req.id !== data.requisition_id));
    };

    socket.on('requisition_created', handleRequisitionCreated);
    socket.on('requisition_updated', handleRequisitionUpdated);
    socket.on('requisition_status_updated', handleRequisitionStatusUpdated);
    socket.on('requisition_deleted', handleRequisitionDeleted);

    return () => {
      if (socket) {
        socket.off('requisition_created', handleRequisitionCreated);
        socket.off('requisition_updated', handleRequisitionUpdated);
        socket.off('requisition_status_updated', handleRequisitionStatusUpdated);
        socket.off('requisition_deleted', handleRequisitionDeleted);
      }
    };
  }, [user]);

  const fetchRequisitions = async () => {
    try {
      setLoading(true);
      const response = await api.get('/requisitions');
      setRequisitions(response.data.requisitions || []);
    } catch (error) {
      console.error('Error fetching requisitions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingRequisition(null);
    setShowForm(true);
  };

  const handleEdit = (requisition) => {
    setEditingRequisition(requisition);
    setShowForm(true);
  };

  const handleView = async (requisitionId) => {
    try {
      const response = await api.get(`/requisitions/${requisitionId}`);
      setViewingRequisition(response.data.requisition);
    } catch (error) {
      console.error('Error fetching requisition:', error);
    }
  };

  const handleDelete = async (requisitionId) => {
    if (!window.confirm('Are you sure you want to delete this requisition?')) {
      return;
    }

    try {
      await api.delete(`/requisitions/${requisitionId}`);
      fetchRequisitions();
    } catch (error) {
      console.error('Error deleting requisition:', error);
      alert('Failed to delete requisition');
    }
  };

  const handleApprove = async (requisitionId, action) => {
    if (action === 'Rejected' && !approvalNotes.trim()) {
      alert('Please provide notes for rejection');
      return;
    }

    try {
      const endpoint = user.role === 'DepartmentHead' 
        ? `/requisitions/${requisitionId}/dept-head-review`
        : `/requisitions/${requisitionId}/admin-review`;
      
      const status = action === 'Approved' 
        ? (user.role === 'DepartmentHead' ? 'DeptHead_Approved' : 'Admin_Approved')
        : (user.role === 'DepartmentHead' ? 'DeptHead_Rejected' : 'Admin_Rejected');
      
      const notesField = user.role === 'DepartmentHead' ? 'dept_head_notes' : 'admin_notes';
      
      await api.put(endpoint, {
        status,
        [notesField]: approvalNotes || null
      });
      
      alert(`Requisition ${action.toLowerCase()} successfully`);
      setApprovingId(null);
      setApprovalNotes('');
      setApprovalAction('');
      // Close viewing modal if open
      if (viewingRequisition && viewingRequisition.id === requisitionId) {
        setViewingRequisition(null);
      }
      // Refresh requisitions list with a slight delay to ensure backend transaction commits
      setTimeout(() => {
        fetchRequisitions();
      }, 300);
    } catch (error) {
      console.error('Error approving requisition:', error);
      alert(error.response?.data?.error || 'Failed to approve requisition');
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      'Pending_DeptHead': { color: 'warning', text: 'Pending Dept Head' },
      'DeptHead_Approved': { color: 'info', text: 'Dept Head Approved' },
      'DeptHead_Rejected': { color: 'danger', text: 'Dept Head Rejected' },
      'Pending_Admin': { color: 'warning', text: 'Pending Admin' },
      'Admin_Approved': { color: 'success', text: 'Approved' },
      'Admin_Rejected': { color: 'danger', text: 'Rejected' },
      'Approved': { color: 'success', text: 'Approved' }
    };
    return badges[status] || { color: 'secondary', text: status };
  };

  const getRequestTypeLabel = (type) => {
    const types = {
      'office_supplies': 'Office Supplies',
      'work_support': 'Work Support',
      'sick_leave': 'Sick Leave',
      'temporary_leave': 'Temporary Leave',
      'vacation': 'Vacation',
      'annual_leave': 'Annual Leave'
    };
    return types[type] || type;
  };

  const canApprove = (requisition) => {
    if (user.role === 'Admin') {
      return requisition.status === 'Pending_Admin';
    }
    if (user.role === 'DepartmentHead') {
      // Finance Department Head can approve office supplies requisitions
      // Other department heads cannot approve (leave requests go directly to Admin)
      const isOfficeSupplies = requisition.request_type === 'office_supplies';
      return isOfficeSupplies && requisition.status === 'Pending_DeptHead';
    }
    return false;
  };

  const formatRequisitionForExport = (req) => {
    return `
Requisition Details
===================

Date: ${new Date(req.requisition_date).toLocaleDateString()}
Type: ${getRequestTypeLabel(req.request_type)}
User: ${req.user_name || 'N/A'}
Department: ${req.department_name || 'N/A'}

${req.request_type === 'office_supplies' ? `
Materials: ${req.materials || 'N/A'}
Cost: ${req.cost || 'N/A'}
Quantity: ${req.quantity || 'N/A'}
` : ''}

${req.request_type === 'work_support' ? `
Purpose: ${req.purpose || 'N/A'}
` : ''}

${['sick_leave', 'temporary_leave', 'vacation', 'annual_leave'].includes(req.request_type) ? `
Period: ${req.period_from ? new Date(req.period_from).toLocaleDateString() : 'N/A'} - ${req.period_to ? new Date(req.period_to).toLocaleDateString() : 'N/A'}
Purpose: ${req.leave_purpose || 'N/A'}
` : ''}

Status: ${req.status}
${req.dept_head_reviewer_name ? `Dept Head Reviewer: ${req.dept_head_reviewer_name}` : ''}
${req.admin_reviewer_name ? `Admin Reviewer: ${req.admin_reviewer_name}` : ''}
${req.dept_head_notes ? `Dept Head Notes: ${req.dept_head_notes}` : ''}
${req.admin_notes ? `Admin Notes: ${req.admin_notes}` : ''}
    `.trim();
  };

  const filteredRequisitions = requisitions.filter(req => {
    if (filter.request_type && req.request_type !== filter.request_type) return false;
    if (filter.status && req.status !== filter.status) return false;
    if (filter.dateFrom && new Date(req.requisition_date) < new Date(filter.dateFrom)) return false;
    if (filter.dateTo && new Date(req.requisition_date) > new Date(filter.dateTo)) return false;
    return true;
  });

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
        <div className="col-12 d-flex justify-content-between align-items-center">
          <h2>Requisition History</h2>
          <button className="btn btn-primary" onClick={handleAdd}>
            <i className="bi bi-plus-circle me-2"></i>Create Requisition
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card mb-4">
        <div className="card-body">
          <div className="row g-3">
            <div className="col-md-3">
              <select
                className="form-select"
                value={filter.request_type}
                onChange={(e) => setFilter({ ...filter, request_type: e.target.value })}
              >
                <option value="">All Types</option>
                <option value="office_supplies">Office Supplies</option>
                <option value="work_support">Work Support</option>
                <option value="sick_leave">Sick Leave</option>
                <option value="temporary_leave">Temporary Leave</option>
                <option value="vacation">Vacation</option>
                <option value="annual_leave">Annual Leave</option>
              </select>
            </div>
            <div className="col-md-3">
              <select
                className="form-select"
                value={filter.status}
                onChange={(e) => setFilter({ ...filter, status: e.target.value })}
              >
                <option value="">All Statuses</option>
                <option value="Pending_DeptHead">Pending Dept Head</option>
                <option value="DeptHead_Approved">Dept Head Approved</option>
                <option value="DeptHead_Rejected">Dept Head Rejected</option>
                <option value="Pending_Admin">Pending Admin</option>
                <option value="Admin_Approved">Approved</option>
                <option value="Admin_Rejected">Rejected</option>
              </select>
            </div>
            <div className="col-md-2">
              <input
                type="date"
                className="form-control"
                placeholder="From Date"
                value={filter.dateFrom}
                onChange={(e) => setFilter({ ...filter, dateFrom: e.target.value })}
              />
            </div>
            <div className="col-md-2">
              <input
                type="date"
                className="form-control"
                placeholder="To Date"
                value={filter.dateTo}
                onChange={(e) => setFilter({ ...filter, dateTo: e.target.value })}
              />
            </div>
            <div className="col-md-2">
              <button
                className="btn btn-outline-secondary w-100"
                onClick={() => setFilter({ request_type: '', status: '', dateFrom: '', dateTo: '' })}
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Requisitions Table */}
      <div className="card">
        <div className="card-body">
          {filteredRequisitions.length === 0 ? (
            <div className="text-center py-5">
              <i className="bi bi-file-earmark-text text-muted" style={{ fontSize: '3rem' }}></i>
              <p className="text-muted mt-3">No requisitions found</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    {user.role === 'Admin' && <th>User</th>}
                    <th>Details</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRequisitions.map((req) => {
                    const statusBadge = getStatusBadge(req.status);
                    return (
                      <tr key={req.id}>
                        <td>{new Date(req.requisition_date).toLocaleDateString()}</td>
                        <td>
                          <span className="badge bg-info">
                            {getRequestTypeLabel(req.request_type)}
                          </span>
                        </td>
                        {user.role === 'Admin' && (
                          <td>{req.user_name || 'N/A'}</td>
                        )}
                        <td>
                          {req.request_type === 'office_supplies' && (
                            <div>
                              <strong>{req.materials}</strong>
                              <br />
                              <small className="text-muted">
                                Cost: ${req.cost || '0'} | Qty: {req.quantity || '0'}
                              </small>
                            </div>
                          )}
                          {req.request_type === 'work_support' && (
                            <div>
                              <small>{req.purpose?.substring(0, 50)}...</small>
                            </div>
                          )}
                          {['sick_leave', 'temporary_leave', 'vacation', 'annual_leave'].includes(req.request_type) && (
                            <div>
                              <small>
                                {req.period_from ? new Date(req.period_from).toLocaleDateString() : 'N/A'} - 
                                {req.period_to ? new Date(req.period_to).toLocaleDateString() : 'N/A'}
                              </small>
                            </div>
                          )}
                        </td>
                        <td>
                          <span className={`badge bg-${statusBadge.color}`}>
                            {statusBadge.text}
                          </span>
                        </td>
                        <td>
                          <div className="btn-group" role="group">
                            <button
                              className="btn btn-sm btn-outline-primary"
                              onClick={() => handleView(req.id)}
                              title="View"
                            >
                              <i className="bi bi-eye"></i>
                            </button>
                            {canApprove(req) && (
                              <>
                                <button
                                  className="btn btn-sm btn-outline-success"
                                  onClick={() => {
                                    setApprovingId(req.id);
                                    setApprovalAction('Approved');
                                    setApprovalNotes('');
                                  }}
                                  title="Approve"
                                >
                                  <i className="bi bi-check-circle"></i>
                                </button>
                                <button
                                  className="btn btn-sm btn-outline-danger"
                                  onClick={() => {
                                    setApprovingId(req.id);
                                    setApprovalAction('Rejected');
                                    setApprovalNotes('');
                                  }}
                                  title="Reject"
                                >
                                  <i className="bi bi-x-circle"></i>
                                </button>
                              </>
                            )}
                            {req.user_id === user.id && req.status === 'Pending_DeptHead' && (
                              <button
                                className="btn btn-sm btn-outline-warning"
                                onClick={() => handleEdit(req)}
                                title="Edit"
                              >
                                <i className="bi bi-pencil"></i>
                              </button>
                            )}
                            {(req.user_id === user.id || user.role === 'Admin') && (
                              <button
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => handleDelete(req.id)}
                                title="Delete"
                              >
                                <i className="bi bi-trash"></i>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* View Requisition Modal */}
      {viewingRequisition && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Requisition Details</h5>
                <button type="button" className="btn-close" onClick={() => setViewingRequisition(null)}></button>
              </div>
              <div className="modal-body">
                <div className="row mb-3">
                  <div className="col-md-6">
                    <strong>Date:</strong> {new Date(viewingRequisition.requisition_date).toLocaleDateString()}
                  </div>
                  <div className="col-md-6">
                    <strong>Type:</strong> {getRequestTypeLabel(viewingRequisition.request_type)}
                  </div>
                </div>
                <div className="row mb-3">
                  <div className="col-md-6">
                    <strong>User:</strong> {viewingRequisition.user_name || 'N/A'}
                  </div>
                  <div className="col-md-6">
                    <strong>Department:</strong> {viewingRequisition.department_name || 'N/A'}
                  </div>
                </div>

                {viewingRequisition.request_type === 'office_supplies' && (
                  <>
                    <div className="mb-3">
                      <strong>Materials:</strong> {viewingRequisition.materials || 'N/A'}
                    </div>
                    <div className="row mb-3">
                      <div className="col-md-6">
                        <strong>Cost:</strong> ${viewingRequisition.cost || '0.00'}
                      </div>
                      <div className="col-md-6">
                        <strong>Quantity:</strong> {viewingRequisition.quantity || '0'}
                      </div>
                    </div>
                  </>
                )}

                {viewingRequisition.request_type === 'work_support' && (
                  <div className="mb-3">
                    <strong>Purpose:</strong>
                    <div className="mt-2 p-3 bg-light rounded">
                      {viewingRequisition.purpose || 'N/A'}
                    </div>
                  </div>
                )}

                {['sick_leave', 'temporary_leave', 'vacation', 'annual_leave'].includes(viewingRequisition.request_type) && (
                  <>
                    <div className="row mb-3">
                      <div className="col-md-6">
                        <strong>Period From:</strong> {viewingRequisition.period_from ? new Date(viewingRequisition.period_from).toLocaleDateString() : 'N/A'}
                      </div>
                      <div className="col-md-6">
                        <strong>Period To:</strong> {viewingRequisition.period_to ? new Date(viewingRequisition.period_to).toLocaleDateString() : 'N/A'}
                      </div>
                    </div>
                    <div className="mb-3">
                      <strong>Purpose:</strong>
                      <div className="mt-2 p-3 bg-light rounded">
                        {viewingRequisition.leave_purpose || 'N/A'}
                      </div>
                    </div>
                  </>
                )}

                <div className="mb-3">
                  <strong>Status:</strong>
                  <span className={`badge bg-${getStatusBadge(viewingRequisition.status).color} ms-2`}>
                    {getStatusBadge(viewingRequisition.status).text}
                  </span>
                </div>

                {viewingRequisition.dept_head_notes && (
                  <div className="mb-3">
                    <strong>Dept Head Notes:</strong>
                    <div className="mt-2 p-3 bg-light rounded">
                      {viewingRequisition.dept_head_notes}
                    </div>
                  </div>
                )}

                {viewingRequisition.admin_notes && (
                  <div className="mb-3">
                    <strong>Admin Notes:</strong>
                    <div className="mt-2 p-3 bg-light rounded">
                      {viewingRequisition.admin_notes}
                    </div>
                  </div>
                )}

                {/* Action History Section */}
                <div className="mb-3">
                  <strong>Action History:</strong>
                  <div className="mt-2">
                    <div className="timeline">
                      {/* Created */}
                      <div className="timeline-item mb-2 p-2 border-start border-3 border-primary">
                        <div className="d-flex justify-content-between">
                          <div>
                            <strong className="text-primary">Created</strong>
                            <div className="text-muted small">
                              {viewingRequisition.user_name || 'User'} submitted this requisition
                            </div>
                          </div>
                          <div className="text-muted small">
                            {viewingRequisition.created_at ? new Date(viewingRequisition.created_at).toLocaleString() : 'N/A'}
                          </div>
                        </div>
                      </div>

                      {/* Department Head Review */}
                      {viewingRequisition.dept_head_reviewed_at && (
                        <div className={`timeline-item mb-2 p-2 border-start border-3 ${
                          viewingRequisition.status === 'DeptHead_Approved' || viewingRequisition.status === 'Pending_Admin' || viewingRequisition.status === 'Admin_Approved' || viewingRequisition.status === 'Approved'
                            ? 'border-success'
                            : 'border-danger'
                        }`}>
                          <div className="d-flex justify-content-between">
                            <div>
                              <strong className={viewingRequisition.status === 'DeptHead_Rejected' ? 'text-danger' : 'text-success'}>
                                {viewingRequisition.status === 'DeptHead_Rejected' ? 'Rejected' : 'Approved'} by Department Head
                              </strong>
                              <div className="text-muted small">
                                {viewingRequisition.dept_head_reviewer_name || 'Department Head'}
                                {viewingRequisition.dept_head_notes && (
                                  <div className="mt-1 p-2 bg-light rounded">
                                    {viewingRequisition.dept_head_notes}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="text-muted small">
                              {new Date(viewingRequisition.dept_head_reviewed_at).toLocaleString()}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Admin Review */}
                      {viewingRequisition.admin_reviewed_at && (
                        <div className={`timeline-item mb-2 p-2 border-start border-3 ${
                          viewingRequisition.status === 'Admin_Approved' || viewingRequisition.status === 'Approved'
                            ? 'border-success'
                            : 'border-danger'
                        }`}>
                          <div className="d-flex justify-content-between">
                            <div>
                              <strong className={viewingRequisition.status === 'Admin_Rejected' ? 'text-danger' : 'text-success'}>
                                {viewingRequisition.status === 'Admin_Rejected' ? 'Rejected' : 'Approved'} by Admin
                              </strong>
                              <div className="text-muted small">
                                {viewingRequisition.admin_reviewer_name || 'Admin'}
                                {viewingRequisition.admin_notes && (
                                  <div className="mt-1 p-2 bg-light rounded">
                                    {viewingRequisition.admin_notes}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="text-muted small">
                              {new Date(viewingRequisition.admin_reviewed_at).toLocaleString()}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Work Support - Auto Approved */}
                      {viewingRequisition.request_type === 'work_support' && viewingRequisition.status === 'Approved' && (
                        <div className="timeline-item mb-2 p-2 border-start border-3 border-success">
                          <div className="d-flex justify-content-between">
                            <div>
                              <strong className="text-success">Auto-Approved</strong>
                              <div className="text-muted small">
                                Work support requisitions are automatically approved
                              </div>
                            </div>
                            <div className="text-muted small">
                              {viewingRequisition.created_at ? new Date(viewingRequisition.created_at).toLocaleString() : 'N/A'}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {viewingRequisition.document_path && (
                  <div className="mb-3">
                    <strong>Document:</strong>
                    <br />
                    <a 
                      href={`http://localhost:3006${viewingRequisition.document_path}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="btn btn-sm btn-outline-primary mt-2"
                    >
                      <i className="bi bi-download me-1"></i>Download Document
                    </a>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-outline-secondary"
                  onClick={() => printContent('Requisition', formatRequisitionForExport(viewingRequisition))}
                >
                  <i className="bi bi-printer me-1"></i>Print
                </button>
                <button
                  className="btn btn-outline-danger"
                  onClick={() => exportToPDF('Requisition', formatRequisitionForExport(viewingRequisition))}
                >
                  <i className="bi bi-file-pdf me-1"></i>Export PDF
                </button>
                <button
                  className="btn btn-outline-primary"
                  onClick={() => exportToWord('Requisition', formatRequisitionForExport(viewingRequisition))}
                >
                  <i className="bi bi-file-word me-1"></i>Export Word
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setViewingRequisition(null)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Approval Modal */}
      {approvingId && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Approve/Reject Requisition</h5>
                <button type="button" className="btn-close" onClick={() => {
                  setApprovingId(null);
                  setApprovalNotes('');
                  setApprovalAction('');
                }}></button>
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label">Notes {approvalAction === 'Rejected' && <span className="text-danger">*</span>}</label>
                  <textarea
                    className="form-control"
                    rows="3"
                    value={approvalNotes}
                    onChange={(e) => setApprovalNotes(e.target.value)}
                    placeholder="Enter approval/rejection notes..."
                    required={approvalAction === 'Rejected'}
                  ></textarea>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => {
                  setApprovingId(null);
                  setApprovalNotes('');
                  setApprovalAction('');
                }}>Cancel</button>
                <button
                  type="button"
                  className="btn btn-danger me-2"
                  onClick={() => handleApprove(approvingId, 'Rejected')}
                >
                  Reject
                </button>
                <button
                  type="button"
                  className="btn btn-success"
                  onClick={() => handleApprove(approvingId, 'Approved')}
                >
                  Approve
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <RequisitionForm
          requisition={editingRequisition}
          onClose={() => {
            setShowForm(false);
            setEditingRequisition(null);
            fetchRequisitions();
          }}
        />
      )}
    </div>
  );
};

export default RequisitionHistory;

